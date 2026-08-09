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
# AN OPERATION AND EVERY TABLE IT NAMES.
#
# This was `\b(OP)\b[^`\n]*?`(\w+)`` — one operation, ONE table, and no dots.
# Both halves lost real tables silently:
#
#   READ `projects`, `asks`   ->  [projects]   `asks` was dropped
#   READ `public.users`       ->  []           dropped entirely
#
# The second is the case harvest.py goes out of its way to support ("Schema-
# qualified names allowed: [\w.]+ not \w+, public.users would truncate") and the
# emitter put back. A table lost here is lost from the card's `touches`, from
# the data appendix, and from the read/write index — three places, no warning.
#
# So: find the operation, then take every backticked name that follows it up to
# the next operation on the line.
OP_WORD = re.compile(r"\b(?P<op>READS?|INSERT(?:/UPDATE)?|UPDATE|DELETE)\b")
TICKED_NAME = re.compile(r"`(?P<table>[\w.]+)`")
CODE_SUFFIX = re.compile(
    r"\.(?:tsx?|jsx?|mjs|cjs|py|rb|go|rs|java|php|sql|md|json|ya?ml|toml|css|html?|svelte|vue)$",
    re.I)

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


def plugin_version():
    """The skill's own version, read from the plugin manifest.

    Single-sourced from `.claude-plugin/plugin.json` — the same file SKILL.md's
    version marker is stamped from — rather than written here, because two
    hand-kept copies of a version number is one copy too many. None when the
    scripts have been vendored somewhere without the manifest, which is honest:
    a missing answer beats a stale one.
    """
    here = pathlib.Path(__file__).resolve()
    for parent in here.parents:
        manifest = parent / ".claude-plugin" / "plugin.json"
        if manifest.is_file():
            try:
                return json.loads(manifest.read_text(encoding="utf-8")).get("version")
            except (json.JSONDecodeError, OSError):
                return None
    return None


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
    ops = list(OP_WORD.finditer(text))
    for i, m in enumerate(ops):
        op = m.group("op").upper()
        op = "READ" if op.startswith("READ") else op
        # Everything this operation names, up to wherever the next one starts.
        stop = ops[i + 1].start() if i + 1 < len(ops) else len(text)
        for t in TICKED_NAME.finditer(text, m.end(), stop):
            name = t.group("table")
            # A file path in backticks is not a table. The template says not to
            # backtick file names, and runs do it anyway. Matched on a KNOWN
            # extension rather than "has a dot", because `public.users` has a dot
            # and is exactly the schema-qualified name this is here to keep.
            if "/" in name or CODE_SUFFIX.search(name):
                continue
            key = (name, op)
            if key not in seen:
                seen.add(key)
                out.append({"name": name, "op": op})
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

    # A REPOSITORY THAT HAS NO PAGES (schema /3).
    #
    #   "the plug-in is placing asks at the page level but the plug-in does not
    #    have any pages"
    #
    # Some repositories are not apps with screens. A plugin is skills and a
    # manifest; a library is exported functions; a CLI is commands. Every phase
    # above this line is about routes, so a reading of one of those had exactly
    # one slot to put its surface in and filed each skill as a page. It was not
    # wrong to try — a format with one slot gets everything put in that slot.
    #
    # `_capabilities.json` is the second slot: things a person can DO with the
    # repository that do not happen anywhere in particular. See SKILL.md Phase 1b.
    caps_f = mp / "_capabilities.json"
    pageless = json.loads(caps_f.read_text(encoding="utf-8")) if caps_f.is_file() else []

    # FAIL CLOSED ON A MISSING ROUTE LIST.
    #
    # "There are no routes" and "the route enumerator never ran" are different
    # facts and must never produce the same file. Defaulting a missing
    # `_routes.json` to [] would turn a reading that never happened into a
    # confident empty map. So it is required — UNLESS the run said, by writing
    # `_capabilities.json`, that this repository has no routes to enumerate.
    routes_f = mp / "_routes.json"
    if routes_f.is_file():
        routes = json.loads(routes_f.read_text(encoding="utf-8"))
    elif pageless:
        routes = []
    else:
        raise SystemExit(
            f"{routes_f} is missing and no {caps_f.name} was written.\n"
            "  Either Phase 1 never ran (enumerate the routes, then re-run this),\n"
            "  or this repository genuinely has no routes — in which case write\n"
            "  its surface to map/_capabilities.json (SKILL.md Phase 1b). An empty\n"
            "  map.json must never be the way we find out the reading did not happen."
        )
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
    unreadable_pages = []
    for f in sorted((mp / "pages").glob("*.md")):
        p = parse_page(f.read_text(encoding="utf-8"))
        p["pageFile"] = f.name
        if p.get("path"):
            pages[p["path"]] = p
        else:
            # No `# /path — Title` heading, so nothing can attach it to a route.
            unreadable_pages.append(f.name)

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
        # Only meaningful for a page a person opens AND that somebody actually
        # read. On an unmapped route there is no "Reached from outside" line to
        # consult, so the noWayIn test below has nothing to weigh the missing
        # link against and would answer "nothing links here" about a page nobody
        # examined. On this repo that flagged /auth/confirm (you arrive from an
        # email) and /checkout/success (the payment provider sends you) — the two
        # pages whose way in is external by design. A claim nobody checked must
        # not arrive on the owner's board as something to triage.
        if r.get("audience") == "user" and rec["mapped"]:
            rec["noInboundEdge"] = not rec["inbound"]
        # WHERE A REDIRECT SENDS YOU.
        #
        # Phase 1 reads it, `_routes.json` carries it, and assemble.py prints it
        # in MAP.md — "an old address, kept working — sends you to /new/path".
        # This file dropped it, so the human half of the reading knew the
        # destination and the importer got a redirect with nowhere to go. The
        # same one-sided loss as the harvest, one field smaller.
        if r.get("redirect_to"):
            rec["redirectTo"] = r["redirect_to"]
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
        # /2 ADDED `app`, `signals`, `defects` AND `capabilities[].purpose`.
        # /3 ADDS top-level `capabilities` — the surface of a repository that
        # has no pages at all. Every earlier field is unchanged and still
        # present, so a /3 reader handles all three. The bump is for the OTHER
        # direction: an older reader given this file would silently drop what
        # was added, and the consumer's version check exists precisely so it
        # says so instead. Adding fields under the old number is what makes
        # that check worthless.
        "schema": "user-lens-map/3",
        "generator": "emit_map_json.py (reference implementation)",
        # WHICH MAPPER WROTE THIS.
        #
        # `schema` says which FORMAT the file is in; it does not say which
        # release of the skill produced it, and those are different questions
        # with different answers. A reading written by an older plugin is a
        # perfectly valid /2 or /3 file — the consumer reads it in full and has
        # nothing to complain about — while carrying none of the defects, none
        # of the app-wide facts, or none of the page-less capabilities that a
        # newer mapper would have found. Without this, "your reading is thin
        # because your plugin is old" is a diagnosis nobody can make, and the
        # owner re-runs a half-hour pass to get the same thin file back.
        #
        # NEITHER THIS NOR `redirectTo` BUMPS THE SCHEMA, and that is a decision
        # rather than an oversight. The number moves when an older reader would
        # DROP SOMETHING IT NEEDED — the app's own words: a /1 file "is read in
        # full… it simply carries less", and the complaint is reserved for a
        # NEWER file, "the case where this reader would drop something and never
        # know it had". A /3 reader given this file builds precisely the same
        # board; it just cannot tell you which mapper wrote it. Bumping for that
        # would refuse every reading until the app shipped a reader for a version
        # that changes nothing about what a card IS.
        "generatorVersion": plugin_version(),
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
            "capabilities": (
                sum(len(r.get("capabilities", [])) for r in out_routes) + len(pageless)
            ),
            "capabilitiesWithPurpose": (
                sum(1 for r in out_routes for c in r.get("capabilities", []) if c.get("purpose"))
                + sum(1 for c in pageless if c.get("purpose"))
            ),
            "pagelessCapabilities": len(pageless),
        },
        "routes": out_routes,
        "tables": dict(sorted(table_index.items())),
    }
    if pageless:
        doc["capabilities"] = pageless
    if app:
        doc["app"] = app
    pathlib.Path(args.out).write_text(json.dumps(doc, indent=2), encoding="utf-8")

    c = doc["counts"]
    print(f"wrote {args.out}: {c['mapped']}/{c['userFacing']} user pages mapped, "
          f"{c['machineOnly']} machine, {c['redirects']} redirect, "
          f"{c['tables']} tables")
    # A PAGE-LESS READING MUST NOT READ AS A FAILED ONE.
    #
    # "0/0 user pages mapped" is what a broken run prints. It is also, for a
    # plugin or a library, the correct answer — and the two must not look
    # identical on the terminal, or the right answer gets re-run all night.
    if pageless:
        print(f"  no pages: {len(pageless)} capability/capabilities carry this "
              f"repository's surface instead")
        for cap in pageless[:8]:
            print(f"    {cap.get('name') or '(unnamed)'}"
                  f"{'  ' + cap['file'] if cap.get('file') else ''}")
    elif not out_routes:
        print("  WARNING: no routes AND no capabilities — this map says the repository")
        print("           has no user-visible surface at all. That is almost never true.")
        print("           If it genuinely has no pages, write its surface to")
        print("           map/_capabilities.json (SKILL.md Phase 1b) rather than shipping")
        print("           an empty map: an empty board is indistinguishable from a")
        print("           reading that never happened.")
    # A PAGE FILE THAT MATCHED NO ROUTE IS WORK THROWN AWAY IN SILENCE.
    #
    # Pages are keyed by the `# /path — Title` heading and routes are iterated
    # from _routes.json, so a page whose heading does not match a route is read,
    # parsed, and never looked at again. Everything in it goes: its capabilities,
    # its actions, its defects, its verified citations — a full Phase 3 pass on
    # one page, gone for a trailing slash or a route renamed mid-run. Tested with
    # a one-character typo in the heading: the run printed an identical clean
    # summary and the file was one page lighter.
    #
    # Loud, and listing them, because the fix is a one-word edit ONLY if you know
    # which file to make it in.
    orphans = sorted(set(pages) - {r["path"] for r in out_routes})
    if orphans or unreadable_pages:
        print("")
        print("WARNING: page file(s) that reached nothing — their capabilities, actions")
        print("         and defects are NOT in this map:")
        for path in orphans:
            print(f"    {pages[path]['pageFile']}  heading says {path}, which is not a route")
        for name in unreadable_pages:
            print(f"    {name}  no '# /path — Title' heading to attach it by")
        print("         Fix the heading to match _routes.json exactly (or the route list),")
        print("         then re-run. A map that silently drops a page is worse than one")
        print("         that refuses.")
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
