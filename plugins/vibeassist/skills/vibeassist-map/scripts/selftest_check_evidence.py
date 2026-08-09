#!/usr/bin/env python3
"""Self-test for check_evidence.py — the gate.

    python3 selftest_check_evidence.py

Exits 0 on pass, 1 with the failing assertions on fail. No pytest, no deps, for
the same reason as selftest_emit_map_json.py: this repo has no test harness and
one dependency would be a reason not to run it.

WHY THIS EXISTS. The gate is the thing standing between "I traced this" and "I
remember this", and nothing was checking the gate. Two holes went unnoticed
because they are both about what the gate CANNOT SEE:

  * it only read lines containing "Evidence:", so an action with no citation at
    all was invisible to it — while the quality bar said "every action has
    Evidence";
  * SKILL.md documents `⚠ UNVERIFIED` as the way to record a claim you could
    not check, and the gate failed those lines anyway, so the documented way out
    led nowhere.

Both are absences. A test that only feeds it good and bad citations passes
against a gate with either hole in it.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
GATE = HERE / "check_evidence.py"

failures = []


def check(label, cond, detail=""):
    if cond:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label} {detail}")
        failures.append(label)


def run(tmp, pages, source=None, caps=None, extra=()):
    """Write a fixture repo and run the gate over it."""
    repo = tmp / "repo"
    (repo / "map" / "pages").mkdir(parents=True, exist_ok=True)
    (repo / "src").mkdir(parents=True, exist_ok=True)
    (repo / "src" / "account.ts").write_text(
        source or "\n".join(f"line {i}" for i in range(1, 10)) + "\n", encoding="utf-8")
    for name, body in pages.items():
        (repo / "map" / "pages" / name).write_text(body, encoding="utf-8")
    if caps is not None:
        (repo / "map" / "_capabilities.json").write_text(json.dumps(caps), encoding="utf-8")
    r = subprocess.run(
        [sys.executable, str(GATE), str(repo / "map" / "pages"), "--repo-root", str(repo), *extra],
        capture_output=True, text=True,
    )
    return r


SOURCE = """export function updateProfile() {
  return supabase.from('profiles').update({})
}
"""

GOOD = """# /account — Account

## Capability: Manage your account
### Action: Update your username
- What happens: You type a new name and save.
- Evidence: src/account.ts:1 → `updateProfile` → UPDATE `profiles`
"""


def main():
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)

        print("a citation that checks out passes")
        r = run(tmp / "a", {"account.md": GOOD}, source=SOURCE)
        check("exit 0", r.returncode == 0, r.stdout)
        check("counts what it checked", "1 evidence lines checked" in r.stdout, r.stdout)

        print("a citation pointing at the wrong line fails")
        r = run(tmp / "b", {"account.md": GOOD.replace("src/account.ts:1", "src/account.ts:99")},
                source=SOURCE)
        check("exit 1", r.returncode == 1)
        check("says out of bounds", "out of bounds" in r.stdout, r.stdout)

        print("a symbol that is not in the cited range fails")
        r = run(tmp / "c", {"account.md": GOOD.replace("`updateProfile`", "`deleteEverything`")},
                source=SOURCE)
        check("exit 1", r.returncode == 1)
        check("names the symbol", "deleteEverything" in r.stdout, r.stdout)

        # THE HOLE THE GATE COULD NOT SEE — an absence, not a bad citation.
        print("an action with NO Evidence line fails")
        no_ev = """# /account — Account

## Capability: Manage your account
### Action: Update your username
- What happens: You type a new name and save.
- Trigger: "Save" button
"""
        r = run(tmp / "d", {"account.md": no_ev}, source=SOURCE)
        check("exit 1", r.returncode == 1, r.stdout)
        check("names the action", "Update your username" in r.stdout, r.stdout)
        check("says what is missing", "NO Evidence line" in r.stdout, r.stdout)

        print("the last action in a file is checked too")
        # The block-end scan has to close the final action at end-of-file, or the
        # one place a citation is most often forgotten is the one place unchecked.
        r = run(tmp / "e", {"account.md": GOOD + "\n### Action: Close your account\n"
                                                 "- What happens: it closes.\n"},
                source=SOURCE)
        check("exit 1", r.returncode == 1, r.stdout)
        check("names the last action", "Close your account" in r.stdout, r.stdout)

        # SKILL.md's own escape hatch, which the gate used to fail anyway.
        print("a claim marked UNVERIFIED is reported, not failed")
        unver = GOOD.replace(
            "- Evidence: src/account.ts:1 → `updateProfile` → UPDATE `profiles`",
            "- Evidence: ⚠ UNVERIFIED — the handler is generated at build time")
        r = run(tmp / "f", {"account.md": unver}, source=SOURCE)
        check("exit 0", r.returncode == 0, r.stdout)
        check("said out loud", "UNVERIFIED" in r.stdout, r.stdout)
        check("counted", "1 marked unverified" in r.stdout, r.stdout)
        check("and the cost is stated", "a real cost" in r.stdout, r.stdout)

        print("a page-less reading checks its capabilities instead of erroring")
        caps = [{"name": "Map a repository", "purpose": "Read a codebase.",
                 "file": "src/account.ts"}]
        r = run(tmp / "g", {}, source=SOURCE, caps=caps)
        check("exit 0", r.returncode == 0, r.stdout + r.stderr)
        check("says which gate it ran", "Phase 1b" in r.stdout, r.stdout)
        check("still demands the hand pass", "by hand" in r.stdout, r.stdout)

        print("a capability citing nothing, or nothing real, fails")
        r = run(tmp / "h", {}, source=SOURCE,
                caps=[{"name": "Map a repository", "file": "src/does-not-exist.ts"}])
        check("exit 1", r.returncode == 1, r.stdout)
        check("says what is missing", "does not exist" in r.stdout, r.stdout)
        r = run(tmp / "i", {}, source=SOURCE, caps=[{"name": "Map a repository"}])
        check("a capability with no file at all fails", r.returncode == 1, r.stdout)

        print("no pages and no capabilities is still an error")
        r = run(tmp / "j", {}, source=SOURCE)
        check("exit 2", r.returncode == 2, r.stdout + r.stderr)
        check("says what to do", "_capabilities.json" in r.stderr, r.stderr)

    print()
    if failures:
        print(f"FAILED: {len(failures)} — {', '.join(failures)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
