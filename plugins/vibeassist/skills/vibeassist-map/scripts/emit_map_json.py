#!/usr/bin/env python3
"""Emit map.json from a vibeassist-map working directory.

Reference implementation for the importer's input. Reads the same files
assemble.py reads and produces structured data instead of prose.

  python emit_map_json.py <map-dir> -o map.json

Deliberately generic: no vocabulary from any particular product. A consumer
decides what a "page" or a "capability" becomes on its own side.

Intended to be folded into assemble.py (it duplicates that file's parsing) and
ported to Node with the rest of the scripts.
"""
import argparse
import json
import pathlib
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Same class as check_evidence.py — $ and [] included, or every dynamic route
# in a file-based router silently reads as a missing file.
CITE = re.compile(r"(?P<file>[\w./\\$\[\]-]+\.[A-Za-z]{1,10}):(?P<start>\d+)(?:-(?P<end>\d+))?")
FIELD = re.compile(r"^\*\*(?P<label>[^:*]+):\*\*\s*(?P<value>.*)$")
H1 = re.compile(r"^#\s+(?P<path>\S+)\s*(?:[—-]\s*(?P<title>.*))?$")
CAP = re.compile(r"^##\s+Capability:\s*(?P<name>.+)$")
ACT = re.compile(r"^###\s+Action:\s*(?P<name>.+)$")
BULLET = re.compile(r"^\s*-\s+(?P<key>What happens|Trigger|Feedback|Evidence|READS):\s*(?P<value>.*)$", re.I)
OP_TABLE = re.compile(r"\b(?P<op>READS?|INSERT(?:/UPDATE)?|UPDATE|DELETE)\b[^`\n]*?`(?P<table>\w+)`")

# The five fields the template mandates. Anything else a run invents is kept
# verbatim under `notes` rather than dropped — see the note this script prints.
CORE = {
    "purpose": "Purpose",
    "whoCanSeeIt": "Who can see it",
    "arrivesFrom": "Arrives from",
    "reachedFromOutside": "Reached from outside",
    "showsOnLoad": "Shows on load",
}
CORE_BY_LABEL = {v.lower(): k for k, v in CORE.items()}


def cites(text):
    out = []
    for m in CITE.finditer(text):
        start = int(m.group("start"))
        end = int(m.group("end")) if m.group("end") else start
        out.append({"file": m.group("file").replace("\\", "/"), "start": start, "end": end})
    return out


def tables(text):
    seen, out = set(), []
    for m in OP_TABLE.finditer(text):
        op = m.group("op").upper()
        op = "READ" if op.startswith("READ") else op
        key = (m.group("table"), op)
        if key not in seen:
            seen.add(key)
            out.append({"name": m.group("table"), "op": op})
    return out


def parse_page(md):
    """One page file -> dict. Unknown **Label:** fields are preserved."""
    page = {"capabilities": [], "notes": {}, "readOnly": False}
    cap = act = None
    for raw in md.splitlines():
        line = raw.rstrip()

        m = H1.match(line)
        if m and "path" not in page:
            page["path"] = m.group("path")
            page["title"] = (m.group("title") or "").strip() or None
            continue

        m = CAP.match(line)
        if m:
            cap = {"name": m.group("name").strip(), "actions": []}
            page["capabilities"].append(cap)
            act = None
            continue

        m = ACT.match(line)
        if m:
            act = {"name": m.group("name").strip(), "evidence": [], "tables": []}
            if cap is None:  # an Action before any Capability heading
                cap = {"name": None, "actions": []}
                page["capabilities"].append(cap)
            cap["actions"].append(act)
            continue

        m = FIELD.match(line)
        if m:
            label, value = m.group("label").strip(), m.group("value").strip()
            key = CORE_BY_LABEL.get(label.lower())
            if key == "showsOnLoad":
                page["showsOnLoad"] = {"text": value, "reads": [], "evidence": []}
            elif key:
                page[key] = value
            elif label.lower() == "capabilities":
                # "**Capabilities:** None — this page is for reading."
                page["readOnly"] = value.lower().startswith("none")
                page["notes"]["Capabilities"] = value
            else:
                page["notes"][label] = value
            continue

        m = BULLET.match(line)
        if m:
            key, value = m.group("key").lower(), m.group("value").strip()
            target = act if act is not None else page.get("showsOnLoad")
            if target is None:
                continue
            if key == "evidence":
                target.setdefault("evidence", []).extend(cites(value))
                target.setdefault("tables", []).extend(tables(value))
                target["evidenceText"] = value
            elif key == "reads":
                if value.lower() not in ("none", "none.", "nothing"):
                    target.setdefault("reads", []).append(value)
                    target.setdefault("tables", []).extend(
                        {"name": t, "op": "READ"} for t in re.findall(r"`(\w+)`", value)
                    )
            elif key == "what happens":
                target["whatHappens"] = value
            else:
                target[key] = value
    return page


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("map_dir")
    ap.add_argument("-o", "--out", default="map.json")
    args = ap.parse_args()

    mp = pathlib.Path(args.map_dir)
    routes = json.loads((mp / "_routes.json").read_text(encoding="utf-8"))
    edges_f = mp / "_edges.json"
    edges = json.loads(edges_f.read_text(encoding="utf-8")) if edges_f.is_file() else []
    notes_f = mp / "_machine_notes.json"
    machine_notes = json.loads(notes_f.read_text(encoding="utf-8")) if notes_f.is_file() else {}
    stack_f = mp / "_stack.md"
    stack = stack_f.read_text(encoding="utf-8").strip() if stack_f.is_file() else None

    # slug rule from SKILL.md Phase 3, so both ends agree
    def slug(p):
        s = p.lstrip("/").replace("/", "-")
        for ch in ":$[]":
            s = s.replace(ch, "")
        return s or "index"

    pages = {}
    for f in sorted((mp / "pages").glob("*.md")):
        p = parse_page(f.read_text(encoding="utf-8"))
        p["pageFile"] = f.name
        if p.get("path"):
            pages[p["path"]] = p

    inbound = {}
    for e in edges:
        inbound.setdefault(e.get("to"), []).append(
            {"from": e.get("from"), "trigger": e.get("trigger")}
        )

    out_routes, table_index, invented = [], {}, {}
    for r in routes:
        path = r["path"]
        rec = {
            "path": path,
            "slug": slug(path),
            "sourceFile": str(r.get("source_file", "")).replace("\\", "/"),
            "audience": r.get("audience"),
            "authRequired": r.get("auth_required"),
            "layoutChain": r.get("layout_chain"),
            "inbound": inbound.get(path, []),
            "mapped": path in pages,
        }
        if r.get("audience") == "user":
            # only meaningful for pages a person opens
            rec["noInboundEdge"] = not rec["inbound"]
        if path in machine_notes:
            rec["note"] = machine_notes[path]

        pg = pages.get(path)
        if pg:
            for k in ("title", "purpose", "whoCanSeeIt", "arrivesFrom",
                      "reachedFromOutside", "showsOnLoad", "capabilities",
                      "readOnly", "notes", "pageFile"):
                if k in pg:
                    rec[k] = pg[k]
            for label in pg.get("notes", {}):
                if label != "Capabilities":
                    invented.setdefault(label, []).append(path)

            def index(tbls, write_side):
                for t in tbls:
                    e = table_index.setdefault(t["name"], {"readBy": [], "writtenBy": []})
                    side = "writtenBy" if (write_side and t["op"] != "READ") else "readBy"
                    if path not in e[side]:
                        e[side].append(path)

            index(pg.get("showsOnLoad", {}).get("tables", []), False)
            for c in pg.get("capabilities", []):
                for a in c["actions"]:
                    index(a.get("tables", []), True)

        # "No inbound link" is NOT the same as "no way in". A page reached by an
        # emailed link, a search engine, or a payment provider's return URL has
        # no internal edge and is perfectly reachable. Only flag a page when the
        # template's own "Reached from outside" line says there is nothing.
        if rec.get("noInboundEdge"):
            outside = (rec.get("reachedFromOutside") or "").strip().strip('"\'')
            rec["externalEntry"] = None if outside.lower().startswith("none") else outside or None
            rec["noWayIn"] = rec["externalEntry"] is None
        out_routes.append(rec)

    user = [r for r in out_routes if r["audience"] == "user"]
    doc = {
        # NOT renamed with the skill. This is a FORMAT identifier: anything
        # holding a map.json already written matches on it, and the importer
        # checks it. Branding churn must not invalidate existing files.
        "schema": "user-lens-map/1",
        "generator": "emit_map_json.py (reference implementation)",
        "stack": stack,
        "counts": {
            "routes": len(out_routes),
            "userFacing": len(user),
            "mapped": sum(1 for r in user if r["mapped"]),
            "machineOnly": sum(1 for r in out_routes if r["audience"] == "machine"),
            "redirects": sum(1 for r in out_routes if r["audience"] == "redirect"),
            "edges": len(edges),
            "tables": len(table_index),
            "noInboundEdge": sum(1 for r in user if r.get("noInboundEdge")),
            "noWayIn": sum(1 for r in user if r.get("noWayIn")),
        },
        "routes": out_routes,
        "tables": dict(sorted(table_index.items())),
    }
    pathlib.Path(args.out).write_text(json.dumps(doc, indent=2), encoding="utf-8")

    c = doc["counts"]
    print(f"wrote {args.out}: {c['mapped']}/{c['userFacing']} user pages mapped, "
          f"{c['machineOnly']} machine, {c['redirects']} redirect, "
          f"{c['tables']} tables")
    print(f"  {c['noInboundEdge']} with no internal link, of which "
          f"{c['noWayIn']} have NO way in at all:")
    for r in out_routes:
        if r.get("noWayIn"):
            print(f"    {r['path']}")
    unmapped = [r["path"] for r in user if not r["mapped"]]
    if unmapped:
        print(f"WARNING: {len(unmapped)} user-facing route(s) have no page file: "
              + ", ".join(unmapped[:5]))
    if invented:
        print("\nNon-template fields found (the template has no home for these,")
        print("so each run invents a label and an importer keyed on labels loses them):")
        for label, paths in sorted(invented.items()):
            print(f"  **{label}:**  x{len(paths)}  e.g. {paths[0]}")


if __name__ == "__main__":
    main()
