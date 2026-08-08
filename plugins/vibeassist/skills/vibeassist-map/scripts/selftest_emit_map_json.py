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
]
EDGES = [{"from": "«global navigation»", "to": "/account",
          "trigger": "shared component (AppSidebar)"}]
HARVEST = {
    "/account": {
        "outbound": [{"file": "src/lib/mail.ts", "line": 12, "snippet": "resend.emails.send("}],
        "paid_gates": [{"file": "src/lib/plan.ts", "line": 8, "snippet": "if (!isPro)"}],
    },
    "_meta": {
        "data_layers": ["supabase"],
        "scheduled": [{"name": "nightly-digest", "schedule": "0 3 * * *"}],
        "state_enums": {"tasks": ["draft", "backlog", "complete"]},
        "delete_cascades": [{"table": "tasks", "on": "projects"}],
        "tables_without_rls": ["audit_log"],
        "orphan_tables": ["legacy_notes"],
        "services": ["Stripe"],
        "env_vars": {"STRIPE_KEY": "src/lib/pay.ts:4"},
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

        print("the version says what changed")
        check("stamped /2", doc["schema"] == "user-lens-map/2", doc["schema"])

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

    print()
    if failures:
        print(f"FAILED: {len(failures)} — {', '.join(failures)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
