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

# A CAPABILITY'S OWN WORDS.
#
# A capability used to be a name and a list of actions, so everything the
# reading learned lived on the actions and the capability card itself arrived
# with nothing of its own. Capability cards are two thirds of a mapped board.
# Reported after a re-read: "they do seem to be in there, but is very thin."
#
# The consumer has been asking for this field for a while — it reads
# `capability.purpose` and falls back to a template sentence with a page name
# dropped into it. Nothing has ever produced it, because the template had no
# line to write it on.
CAP_PURPOSE_LABELS = {"what it's for", "what its for", "purpose"}

# A DEFECT THE TRACE TURNED UP.
#
# The template's field is "**⚠ Defect worth knowing about:**". The glyph is the
# point on the page and a nuisance here, so labels are normalised before
# matching — leading non-letters stripped — rather than the marker being matched
# literally in five places.
DEFECT_LABEL = re.compile(r"^defect\b|^\W*defect\b", re.I)
# Evidence is separated from the sentence by an em dash in the template's own
# example: "<what is broken, in user terms> — Evidence: file:line".
DEFECT_EVIDENCE = re.compile(r"\s*[—-]?\s*Evidence:\s*(?P<ev>.+)$", re.I)


def norm_label(label):
    """Strip decoration so '⚠ Defect worth knowing about' matches 'defect'."""
    return re.sub(r"^[^A-Za-z]+", "", label).strip().lower()


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
    page = {"capabilities": [], "notes": {}, "readOnly": False, "defects": []}
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
            cap = {"name": m.group("name").strip(), "purpose": None, "actions": []}
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
            flat = norm_label(label)

            # A DEFECT IS A LIST, NOT A LABEL.
            #
            # These used to land in `notes`, which is a dict keyed on the label —
            # so a page that turned up TWO defects reported one, and the second
            # was overwritten by a key it happened to share. A page with two
            # things wrong is exactly the page you want to hear about twice.
            #
            # Recorded at page level even when found mid-action: the field is
            # about the app, and the consumer attaches it to the place. Its
            # evidence is split out so the claim can be checked without a person
            # parsing prose.
            if DEFECT_LABEL.match(flat) or DEFECT_LABEL.match(label):
                ev = DEFECT_EVIDENCE.search(value)
                page["defects"].append({
                    "text": DEFECT_EVIDENCE.sub("", value).strip(" —-").strip(),
                    "evidence": cites(ev.group("ev")) if ev else cites(value),
                    "action": act["name"] if act else None,
                    "capability": cap["name"] if cap else None,
                })
                continue

            # A CAPABILITY SAYS WHAT IT IS FOR.
            #
            # A capability was a NAME and a list of actions and nothing else, so
            # everything the reading learned about it lived on its actions and
            # the capability itself arrived on the board with no words of its
            # own — a card whose whole description was a template sentence with
            # a page name in it. Capability cards are two thirds of a mapped
            # board, so two thirds of the board read as empty.
            #
            # Only when a capability is open and no action is: page-level fields
            # all precede the first capability heading, so this cannot swallow
            # one of them.
            if cap is not None and act is None and flat in CAP_PURPOSE_LABELS:
                cap["purpose"] = value
                continue

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


# WHAT THE SCAN LEARNED ABOUT THE APP AS A WHOLE.
#
# assemble.py has taken --harvest for a long time and builds ten MAP.md sections
# from it: what runs on its own, what the app emails out, the journeys records
# take, what dies when you delete, the sign-in path, where free stops, the
# shared error machinery, findings, who is allowed to do what, and the keys it
# needs. This script did not take the flag at all, so every one of those reached
# a human reader and NOTHING reached an importer. Half the reading stopped at
# the page files.
#
# Renamed on the way out. `_meta` is a scratch key in an intermediate file;
# `app` is what the thing IS, and the consumer should not have to know the name
# of our working directory to read it.
META_TO_APP = {
    "data_layers": "dataLayers",
    "schema_tables": "schemaTables",
    "schema_columns": "schemaColumns",
    "scheduled": "scheduled",
    "state_enums": "stateEnums",
    "delete_cascades": "deleteCascades",
    "soft_delete_files": "softDeleteFiles",
    "rls_enabled": "rlsEnabled",
    "rls_policies": "rlsPolicies",
    "tables_without_rls": "tablesWithoutRls",
    "orphan_tables": "orphanTables",
    "env_vars": "envVars",
    "services": "services",
    "global_feedback": "globalFeedback",
}

# PER-PAGE SIGNALS, CARRIED AS SIGNALS.
#
# These are regex hits, and the skill is emphatic that the harvest is "a list of
# CANDIDATES, not a list of claims" — a page resolving 45 files may be offered
# 23 tables while truly touching 8. They still belong in the file: "this page
# sends mail" and "free stops here" are worth knowing even unconfirmed.
#
# So they travel under `signals`, separately from the prose a person wrote and
# checked, and the consumer must never render them as agreed shape. Capped the
# way assemble.py caps them, because a board does not become truer at hit 200.
SIGNAL_KEYS = {
    "outbound": "outbound",
    "paid_gates": "paidGates",
    "auth": "auth",
    "validation": "validation",
    "live_sync": "liveSync",
    "feedback": "feedback",
    "state_literals": "stateLiterals",
}
SIGNAL_CAP = 20


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("map_dir")
    ap.add_argument("-o", "--out", default="map.json")
    ap.add_argument(
        "--harvest",
        default=None,
        help="map/_harvest.json - carries what runs on its own, what the app "
             "sends out, record journeys, delete cascades, access rules, keys "
             "and services through to the importer. Without it the importer "
             "sees pages and nothing else.",
    )
    args = ap.parse_args()

    mp = pathlib.Path(args.map_dir)
    routes = json.loads((mp / "_routes.json").read_text(encoding="utf-8"))
    edges_f = mp / "_edges.json"
    edges = json.loads(edges_f.read_text(encoding="utf-8")) if edges_f.is_file() else []
    notes_f = mp / "_machine_notes.json"
    machine_notes = json.loads(notes_f.read_text(encoding="utf-8")) if notes_f.is_file() else {}
    stack_f = mp / "_stack.md"
    stack = stack_f.read_text(encoding="utf-8").strip() if stack_f.is_file() else None

    # Default to the conventional location, so the common invocation carries the
    # whole reading without anyone having to know the flag exists. An explicit
    # --harvest still wins, and a missing file is not an error: a map assembled
    # without a harvest is still a map.
    harvest_f = pathlib.Path(args.harvest) if args.harvest else (mp / "_harvest.json")
    harvest = json.loads(harvest_f.read_text(encoding="utf-8")) if harvest_f.is_file() else {}
    hmeta = harvest.get("_meta", {})
    app = {out_key: hmeta[key] for key, out_key in META_TO_APP.items() if hmeta.get(key)}

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

        hv = harvest.get(path, {})
        signals = {
            out_key: hv[key][:SIGNAL_CAP]
            for key, out_key in SIGNAL_KEYS.items()
            if hv.get(key)
        }
        if signals:
            rec["signals"] = signals

        pg = pages.get(path)
        if pg:
            for k in ("title", "purpose", "whoCanSeeIt", "arrivesFrom",
                      "reachedFromOutside", "showsOnLoad", "capabilities",
                      "readOnly", "notes", "pageFile", "defects"):
                if k in pg and pg[k] not in (None, [], {}):
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
    defects = sum(len(r.get("defects", [])) for r in out_routes)
    doc = {
        # NOT renamed with the skill. This is a FORMAT identifier: anything
        # holding a map.json already written matches on it, and the importer
        # checks it. Branding churn must not invalidate existing files.
        #
        # /2 ADDS `app`, `signals`, `defects` AND `capabilities[].purpose`.
        # Every /1 field is unchanged and still present, so a /2 reader handles
        # both. The bump is for the OTHER direction: a /1 reader given this file
        # would silently drop all four, and the consumer's version check exists
        # precisely so it says so instead. Adding fields under the old number is
        # what makes that check worthless.
        "schema": "user-lens-map/2",
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
            "defects": defects,
            "capabilities": sum(len(r.get("capabilities", [])) for r in out_routes),
            "capabilitiesWithPurpose": sum(
                1 for r in out_routes for c in r.get("capabilities", []) if c.get("purpose")
            ),
        },
        "routes": out_routes,
        "tables": dict(sorted(table_index.items())),
    }
    if app:
        doc["app"] = app
    pathlib.Path(args.out).write_text(json.dumps(doc, indent=2), encoding="utf-8")

    c = doc["counts"]
    print(f"wrote {args.out}: {c['mapped']}/{c['userFacing']} user pages mapped, "
          f"{c['machineOnly']} machine, {c['redirects']} redirect, "
          f"{c['tables']} tables")
    # SAY WHETHER THE APP-WIDE HALF TRAVELLED.
    #
    # Silence is how this went unnoticed: the file looked complete, the counts
    # looked right, and ten sections of what the scan learned were simply not in
    # it. A run that quietly ships half a reading must not read as a clean run.
    if app:
        print(f"  app-wide: {', '.join(sorted(app))}")
    else:
        print(f"  WARNING: no harvest read ({harvest_f}) — the importer gets pages")
        print( "           and nothing else: no scheduled work, no outbound mail, no")
        print( "           record journeys, no delete cascades, no access rules, no keys.")
    print(f"  {c['defects']} defect(s); {c['capabilitiesWithPurpose']}/{c['capabilities']} "
          f"capabilities say what they are for")
    if c["capabilities"] and not c["capabilitiesWithPurpose"]:
        print("  WARNING: no capability states its purpose — every capability card will")
        print("           arrive on the board with a template sentence and nothing else.")
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
