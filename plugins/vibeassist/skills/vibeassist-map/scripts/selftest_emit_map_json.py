#!/usr/bin/env python3
"""Self-test for emit_map_json.py — the contract an importer consumes.

    python3 selftest_emit_map_json.py

Exits 0 on pass, 1 with the failing assertion on fail. No pytest, no deps: this
repo has no test harness and one dependency would be a reason not to run it.

WHY THIS EXISTS. map.json is a contract between two repositories that are
released separately, and nothing was checking it. The drift that prompted this
file went unnoticed for a long time and was invisible from either side alone:

  * this script never read _harvest.json, while assemble.py did — so ten
    sections of what the scan learned reached a human reader and reached an
    importer not at all;
  * the consumer read `capability.purpose` and nothing had ever produced it,
    because the page template had no line to write it on;
  * two defects on one page became one, because they were stored in a dict
    keyed on the label they shared.

Each half was correct on its own. That is exactly the class of bug a unit test
of either half cannot see, so this asserts on the FILE — the thing both sides
actually agree about.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent

ROUTES = [
    {"path": "/account", "source_file": "src/routes/account.tsx",
     "audience": "user", "auth_required": True, "layout_chain": []},
    {"path": "/webhooks/stripe", "source_file": "src/routes/wh.ts",
     "audience": "machine", "layout_chain": []},
    # An old address kept alive. Phase 1 reads where it sends you and the
    # emitter used to drop it, so MAP.md knew the destination and the importer
    # got a redirect with nowhere to go.
    {"path": "/old-account", "source_file": "src/routes/old-account.tsx",
     "audience": "redirect", "redirect_to": "/account", "layout_chain": []},
    # A user-facing route with NO page file — a partial run, which SKILL.md
    # explicitly allows ("stop at a page boundary and state coverage"). Nothing
    # read it, so nothing may claim anything about how it is reached.
    {"path": "/unread", "source_file": "src/routes/unread.tsx",
     "audience": "user", "layout_chain": []},
]
EDGES = [{"from": "«global navigation»", "to": "/account",
          "trigger": "shared component (AppSidebar)"}]
HARVEST = {
    "/account": {
        "outbound": [{"file": "src/lib/mail.ts", "line": 12, "snippet": "resend.emails.send("}],
        "paid_gates": [{"file": "src/lib/plan.ts", "line": 8, "snippet": "if (!isPro)"}],
    },
    # THE SHAPES HERE ARE THE SHAPES harvest.py ACTUALLY WRITES.
    #
    # They were not. `scheduled` was `{name, schedule}` with no file or line,
    # `delete_cascades` was `{table, on}`, `env_vars` was a string — three
    # inventions that made this file agree with the consumer's TYPES while the
    # producer wrote something else entirely. A fixture nobody generates is a
    # contract nobody holds: the app's own v2 test carried the same invented
    # `scheduled` shape, both sides passed, and every real cron was dropped on
    # arrival for want of a `name` the producer never wrote.
    #
    # Anything changed here must be changed in harvest.py's output first.
    "_meta": {
        "data_layers": ["supabase"],
        "scheduled": [{"name": "nightly-digest", "schedule": "0 3 * * *",
                       "file": "supabase/migrations/0001_cron.sql", "line": 12}],
        "scheduled_unnamed": 2,
        "state_enums": {"tasks": ["draft", "backlog", "complete"]},
        "delete_cascades": [{"references": "projects", "on_delete": "cascade",
                             "file": "supabase/migrations/0001_init.sql", "line": 40}],
        "tables_without_rls": ["audit_log"],
        "orphan_tables": ["legacy_notes"],
        "services": ["Stripe"],
        "env_vars": {"STRIPE_KEY": {"file": "src/lib/pay.ts", "line": 4}},
        "rls_enabled": ["profiles"],
        "schema_tables": ["profiles", "tasks"],
    },
}
# TWO defects on one page, deliberately: one at page level, one under an action.
# A single-defect fixture passes against the dict-keyed version this replaces.
PAGE = """# /account — Account Settings

**Purpose:** Where you manage your personal account details.
**Who can see it:** Signed-in users only.
**Arrives from:** Header avatar menu.
**Reached from outside:** None — internal only.
**Shows on load:** Your profile details.
  - READS: `profiles`
  - Evidence: src/routes/account.tsx:14-31

**⚠ Defect worth knowing about:** Saving a name longer than 40 characters fails silently — Evidence: src/lib/profile.ts:22

## Capability: Manage your account
**What it's for:** Everything to do with your own login and details.

### Action: Update your username
- What happens: You type a new name and save.
- Trigger: "Display name" field + "Save changes" button
- Evidence: handler src/components/ProfileForm.tsx:42 → UPDATE `profiles`

**⚠ Defect worth knowing about:** The avatar upload button does nothing at all — Evidence: src/components/ProfileForm.tsx:88

### Action: Close your account
- What happens: Your account is closed and your sessions end.
- Trigger: "Close account" button
- Evidence: src/lib/account.ts:10 → READ `profiles`, `public.sessions` → DELETE `sessions`, `profiles`
"""

failures = []


def check(label, cond, detail=""):
    if cond:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label} {detail}")
        failures.append(label)


def build(tmp, with_harvest=True):
    mp = tmp / "map"
    (mp / "pages").mkdir(parents=True, exist_ok=True)
    (mp / "_routes.json").write_text(json.dumps(ROUTES), encoding="utf-8")
    (mp / "_edges.json").write_text(json.dumps(EDGES), encoding="utf-8")
    (mp / "_stack.md").write_text("TanStack Start; Supabase.", encoding="utf-8")
    (mp / "pages" / "account.md").write_text(PAGE, encoding="utf-8")
    if with_harvest:
        (mp / "_harvest.json").write_text(json.dumps(HARVEST), encoding="utf-8")
    out = tmp / "map.json"
    r = subprocess.run(
        [sys.executable, str(HERE / "emit_map_json.py"), str(mp), "-o", str(out)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(r.stdout, r.stderr)
        raise SystemExit(f"emitter exited {r.returncode}")
    return json.loads(out.read_text(encoding="utf-8")), r.stdout


# PAGELESS is what a plugin's reading looks like: no router, no routes, and
# a surface made of things you invoke rather than places you go.
PAGELESS = [
    {"name": "Map a repository",
     "purpose": "Read a codebase the way its users meet it and produce a map.",
     "file": "plugins/vibeassist/skills/vibeassist-map/SKILL.md",
     "actions": [{"name": "Run the mapper", "whatHappens": "map.json is written"}]},
    {"name": "Review what got built",
     "file": "plugins/vibeassist/skills/vibeassist-review/SKILL.md"},
]


def build_pageless(tmp):
    """A repo with NO routes at all — the plugin's own shape."""
    mp = tmp / "map"
    (mp / "pages").mkdir(parents=True, exist_ok=True)
    (mp / "_stack.md").write_text("A Claude Code plugin: skills, no router.", encoding="utf-8")
    (mp / "_capabilities.json").write_text(json.dumps(PAGELESS), encoding="utf-8")
    out = tmp / "map.json"
    r = subprocess.run(
        [sys.executable, str(HERE / "emit_map_json.py"), str(mp), "-o", str(out)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(r.stdout, r.stderr)
        raise SystemExit(f"emitter exited {r.returncode}")
    return json.loads(out.read_text(encoding="utf-8")), r.stdout


def main():
    with tempfile.TemporaryDirectory() as td:
        doc, stdout = build(pathlib.Path(td))
        route = next(r for r in doc["routes"] if r["path"] == "/account")

        print("the app-wide half travels")
        app = doc.get("app", {})
        for key in ("dataLayers", "scheduled", "stateEnums", "deleteCascades",
                    "tablesWithoutRls", "orphanTables", "services", "envVars",
                    "rlsEnabled", "schemaTables"):
            check(f"app.{key}", key in app)
        check("run says so out loud", "app-wide:" in stdout)

        print("a capability says what it is for")
        cap = route["capabilities"][0]
        check("purpose parsed", cap.get("purpose") == "Everything to do with your own login and details.",
              f"got {cap.get('purpose')!r}")
        check("counted", doc["counts"]["capabilitiesWithPurpose"] == 1)

        print("defects are a list, and keep their evidence")
        d = route.get("defects", [])
        check("BOTH defects survive", len(d) == 2, f"got {len(d)}")
        check("evidence split from the sentence",
              all(x["evidence"] and "Evidence:" not in x["text"] for x in d))
        check("attached to what it is about",
              d[1].get("action") == "Update your username" and d[0].get("action") is None)
        check("counted", doc["counts"]["defects"] == 2)

        print("per-page signals, marked as signals not shape")
        sig = route.get("signals", {})
        check("outbound", "outbound" in sig)
        check("paidGates", "paidGates" in sig)
        check("kept out of capabilities", "signals" not in json.dumps(route["capabilities"]))

        print("an Evidence line keeps EVERY table it names")
        act = next(a for c in route["capabilities"] for a in c["actions"]
                   if a["name"] == "Close your account")
        got = {(t["name"], t["op"]) for t in act["tables"]}
        # One operation, two tables: the second was silently dropped, because the
        # pattern stopped at the first backtick after the verb.
        check("a second table on the same operation", ("public.sessions", "READ") in got, got)
        # A schema-qualified name, which harvest.py goes out of its way to keep
        # ([\w.]+, "public.users would truncate") and this file put back.
        check("a schema-qualified name", ("public.sessions", "READ") in got, got)
        check("both sides of the arrow", ("sessions", "DELETE") in got and
              ("profiles", "DELETE") in got, got)
        check("the handler symbol is not a table",
              not any("/" in n or n.endswith(".ts") for n, _ in got), got)
        check("the data index has it",
              "public.sessions" in doc["tables"], sorted(doc["tables"]))

        print("nothing is claimed about a page nobody read")
        unread = next(r for r in doc["routes"] if r["path"] == "/unread")
        check("unmapped", unread["mapped"] is False)
        # A partial run is allowed. What it may NOT do is tell the owner that
        # nothing links to a page nobody opened — /auth/confirm arrives from an
        # email and /checkout/success from the payment provider, and both were
        # being flagged on a run that had not read either.
        check("no 'nothing links here' claim", "noWayIn" not in unread)
        check("no inbound claim either", "noInboundEdge" not in unread)
        check("and the mapped page still gets one", "noInboundEdge" in route)

        print("a redirect says where it sends you")
        old = next(r for r in doc["routes"] if r["path"] == "/old-account")
        check("redirectTo travels", old.get("redirectTo") == "/account", old.get("redirectTo"))

        print("the version says what changed")
        check("stamped /3", doc["schema"] == "user-lens-map/3", doc["schema"])
        check("a repo WITH pages grows no capabilities array",
              "capabilities" not in doc)
        # `schema` says which FORMAT this is. It cannot say that a thin reading
        # is thin because the plugin that wrote it is old — which is the question
        # somebody actually asks when a board arrives with no defects on it.
        check("stamps the mapper's own version",
              doc.get("generatorVersion") and doc["generatorVersion"][0].isdigit(),
              doc.get("generatorVersion"))

        print("every /1 field is still there")
        for key in ("path", "sourceFile", "audience", "authRequired", "title",
                    "purpose", "whoCanSeeIt", "arrivesFrom", "reachedFromOutside",
                    "showsOnLoad", "capabilities", "readOnly", "inbound", "mapped"):
            check(f"route.{key}", key in route)
        for key in ("schema", "generator", "stack", "counts", "routes", "tables"):
            check(f"doc.{key}", key in doc)

        print("a run with no harvest SAYS so rather than looking clean")
        with tempfile.TemporaryDirectory() as td2:
            doc2, stdout2 = build(pathlib.Path(td2), with_harvest=False)
            check("warns", "WARNING: no harvest read" in stdout2)
            check("no app section invented", "app" not in doc2)
            check("pages still work", doc2["routes"][0]["capabilities"][0]["purpose"] is not None)

    # ── A repository that has no pages ──────────────────────────────────────
    #
    #   "the plug-in is placing asks at the page level but the plug-in does not
    #    have any pages"
    #
    # The consumer end of this is held in the app's map-json.pageless.test.ts.
    # This is the producer end, and it is the half that could not be checked
    # from over there: that the emitter writes the field at all, that a repo
    # WITH pages does not grow one, and that "no routes" and "the enumerator
    # never ran" produce different outcomes.
    print()
    print("a repository that has no pages")
    with tempfile.TemporaryDirectory() as td3:
        doc3, stdout3 = build_pageless(pathlib.Path(td3))
        check("capabilities travel", len(doc3.get("capabilities", [])) == 2)
        check("no routes invented", doc3["routes"] == [])
        check("named", doc3["capabilities"][0]["name"] == "Map a repository")
        check("the file it came from survives",
              doc3["capabilities"][0]["file"].endswith("SKILL.md"))
        check("counted separately", doc3["counts"]["pagelessCapabilities"] == 2)
        check("counted in the total too", doc3["counts"]["capabilities"] == 2)
        check("purposes counted", doc3["counts"]["capabilitiesWithPurpose"] == 1)
        # "0/0 user pages mapped" is what a BROKEN run prints. It is also the
        # right answer here, and the two must not look identical on a terminal.
        check("the run says it found no pages", "no pages:" in stdout3)
        check("and does not warn about an empty map",
              "no user-visible surface at all" not in stdout3)

    print()
    print("a page file that reached nothing is SAID, not swallowed")
    with tempfile.TemporaryDirectory() as td5:
        tmp5 = pathlib.Path(td5)
        mp5 = tmp5 / "map"
        (mp5 / "pages").mkdir(parents=True, exist_ok=True)
        (mp5 / "_routes.json").write_text(json.dumps(ROUTES), encoding="utf-8")
        (mp5 / "_stack.md").write_text("TanStack Start; Supabase.", encoding="utf-8")
        # One character wrong in the heading — a route renamed between Phase 1
        # and Phase 3, or a trailing slash. Everything in the file goes: its
        # capability, its action, its verified citation. It printed a clean
        # summary and was one page lighter.
        (mp5 / "pages" / "typo.md").write_text(
            PAGE.replace("# /account —", "# /acount —"), encoding="utf-8")
        out5 = tmp5 / "map.json"
        r5 = subprocess.run(
            [sys.executable, str(HERE / "emit_map_json.py"), str(mp5), "-o", str(out5)],
            capture_output=True, text=True,
        )
        doc5 = json.loads(out5.read_text(encoding="utf-8"))
        check("warns", "page file(s) that reached nothing" in r5.stdout, r5.stdout)
        check("names the file", "typo.md" in r5.stdout)
        check("says what it does not match", "/acount" in r5.stdout)
        check("and it really did lose the work", doc5["counts"]["capabilities"] == 0)
        # A page file with no heading at all cannot attach to anything either,
        # and used to be just as quiet.
        (mp5 / "pages" / "headless.md").write_text("Some notes.\n", encoding="utf-8")
        r5b = subprocess.run(
            [sys.executable, str(HERE / "emit_map_json.py"), str(mp5), "-o", str(out5)],
            capture_output=True, text=True,
        )
        check("a page with no heading is named too", "headless.md" in r5b.stdout)

    print()
    print("no routes AND no capabilities is a reading that did not happen")
    with tempfile.TemporaryDirectory() as td4:
        # `_routes.json` absent and nothing else written: the enumerator never
        # ran. Emitting an empty map here would turn a failed reading into a
        # confident empty board — "I could not look" printed as "I looked and
        # there is nothing", which is the confusion this codebase keeps closing.
        mp4 = pathlib.Path(td4) / "map"
        (mp4 / "pages").mkdir(parents=True, exist_ok=True)
        (mp4 / "_stack.md").write_text("A plugin.", encoding="utf-8")
        r4 = subprocess.run(
            [sys.executable, str(HERE / "emit_map_json.py"), str(mp4),
             "-o", str(pathlib.Path(td4) / "map.json")],
            capture_output=True, text=True,
        )
        check("refuses rather than writing an empty map", r4.returncode != 0, r4.stdout)
        check("says which file is missing", "_routes.json" in (r4.stderr + r4.stdout))
        check("says what to do instead", "_capabilities.json" in (r4.stderr + r4.stdout))

    # THE COLUMNS THE TEMPLATE MANDATES.
    #
    # "READS: `profiles` (display_name, email, avatar_url)" and "UPDATE
    # `profiles` (display_name)" are both template lines, and the parenthesis
    # was being thrown away — so every reading wrote down which FIELDS a page
    # touches and the consumer's Data tab said "the reading does not produce
    # fields". It does.
    print("\nthe columns a page touches survive the emitter")
    from emit_map_json import tables as _tables
    reads = _tables("READS: `profiles` (display_name, email, avatar_url), `notification_prefs`")
    check("columns kept for the table that named them",
          reads[0] == {"name": "profiles", "op": "READ",
                       "columns": ["display_name", "email", "avatar_url"]}, reads)
    check("and ABSENT for the one that did not — never an empty list standing "
          "in for 'we looked and found none'",
          "columns" not in reads[1], reads)
    wrote = _tables("handler onSave src/x.tsx:42 -> UPDATE `profiles` (display_name)")
    check("evidence lines carry them too", wrote[0].get("columns") == ["display_name"], wrote)
    prose = _tables("READS: `orders` (whatever the reader wrote here; not columns)")
    check("prose in the parenthesis is not mistaken for a column",
          "columns" not in prose[0], prose)

    print()
    if failures:
        print(f"FAILED: {len(failures)} — {', '.join(failures)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
