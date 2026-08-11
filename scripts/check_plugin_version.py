#!/usr/bin/env python3
"""The version has to move when the plugin does.

On 11 August 2026 the map emitter was changed — a change to what a reading
CONTAINS — and shipped under 0.9.0, the version it already had. Claude Code
compares the version you have installed against the version on offer, saw the
same number, and correctly refused to update. The user's report was "I'm trying
to update the plugin version in Claude, but it does not seem to want to."

That is the second time. `6396814` records the first ("Bump to 0.8.0 — three
skills changed under a version that never moved"), and its message already said
why it matters: a version that does not move reports agreement that is not
there. Saying it in a commit message did not stop it happening again, so it is
a check now.

Two invariants, deliberately separate:

  MARKERS   Every SKILL.md's `vibeassist-skill-version` marker equals the
            version in plugin.json. Needs no git history — a bump that edits
            plugin.json and forgets a marker ships four skills claiming a
            version their own plugin does not.

  MOVED     If anything under plugins/ changed against the base branch, the
            version in plugin.json must differ from the base's. This is the one
            that catches the failure above.

MOVED needs a base to compare against, so it only runs when `--base` is given
(CI passes the pull request's base). MARKERS always runs. A local run with no
arguments therefore checks what it can and says what it skipped, rather than
passing silently and implying more than it looked at.

Exit 0 = every invariant it could check held. Exit 1 = a real disagreement.
Exit 2 = the check could not run (bad ref, unreadable manifest) — which is NOT
the same as passing, and CI must treat it as failure.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PLUGIN_DIR = Path("plugins/vibeassist")
MANIFEST = PLUGIN_DIR / ".claude-plugin" / "plugin.json"

# The marker each packaged SKILL.md carries, which the app's connected session
# compares against the version VA serves. Captured, so a mismatch can name both
# numbers rather than just saying "wrong".
MARKER = re.compile(r"<!--\s*vibeassist-skill-version:\s*(?P<version>[0-9][0-9.]*)")

# Files under the plugin that do NOT change what an installed copy does. A
# version bump for a typo in the README is noise, and a check that cries wolf
# gets bypassed — which costs more than the typo. Everything else counts.
IGNORED = {MANIFEST}


def fail(msg: str) -> None:
    print(f"FAIL  {msg}")


def run_git(args: list[str]) -> tuple[int, str]:
    p = subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=False
    )
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def version_of(text: str, where: str) -> str | None:
    try:
        v = json.loads(text).get("version")
    except json.JSONDecodeError as e:
        fail(f"{where} is not valid JSON: {e}")
        return None
    if not isinstance(v, str) or not v.strip():
        fail(f"{where} has no `version` string.")
        return None
    return v.strip()


def check_markers(version: str) -> bool:
    """Every SKILL.md marker equals the manifest version."""
    skills = sorted((REPO_ROOT / PLUGIN_DIR / "skills").glob("*/SKILL.md"))
    if not skills:
        fail(f"no SKILL.md found under {PLUGIN_DIR / 'skills'} — has the layout moved?")
        return False

    ok = True
    for path in skills:
        rel = path.relative_to(REPO_ROOT)
        m = MARKER.search(path.read_text(encoding="utf-8"))
        if not m:
            fail(
                f"{rel} carries no `vibeassist-skill-version` marker, so an installed "
                f"copy cannot tell the app which version it is running."
            )
            ok = False
            continue
        found = m.group("version")
        if found != version:
            fail(
                f"{rel} says {found}, but {MANIFEST} says {version}. "
                f"One of them is lying to whoever installed it."
            )
            ok = False
    if ok:
        print(f"ok    {len(skills)} SKILL.md marker(s) agree with {MANIFEST}: {version}")
    return ok


def check_moved(base: str, version: str) -> bool:
    """Anything changed under plugins/ ⇒ the version differs from the base's."""
    code, out = run_git(["rev-parse", "--verify", f"{base}^{{commit}}"])
    if code != 0:
        fail(f"cannot resolve base ref {base!r} — nothing to compare against.\n{out.strip()}")
        sys.exit(2)

    code, out = run_git(["diff", "--name-only", f"{base}...HEAD", "--", str(PLUGIN_DIR)])
    if code != 0:
        fail(f"could not diff against {base}.\n{out.strip()}")
        sys.exit(2)

    changed = [Path(line) for line in out.splitlines() if line.strip()]
    material = [p for p in changed if p not in IGNORED]
    if not material:
        print(f"ok    nothing under {PLUGIN_DIR} changed against {base} — no bump needed")
        return True

    code, base_manifest = run_git(["show", f"{base}:{MANIFEST}"])
    if code != 0:
        # The manifest not existing on the base is a new plugin, not a stalled
        # version. Nothing to compare, nothing to complain about.
        print(f"ok    {MANIFEST} is new against {base} — no previous version to move from")
        return True

    was = version_of(base_manifest, f"{MANIFEST} at {base}")
    if was is None:
        sys.exit(2)

    if was == version:
        listing = "\n".join(f"        {p}" for p in material)
        fail(
            f"{len(material)} file(s) under {PLUGIN_DIR} changed, but the version is still "
            f"{version}:\n{listing}\n"
            f"        Anyone already on {version} keeps a different {version} and "
            f"`/plugin update vibeassist` has nothing to move to.\n"
            f"        Bump `version` in {MANIFEST} and the marker in every SKILL.md."
        )
        return False

    print(f"ok    {len(material)} file(s) changed under {PLUGIN_DIR}, and {was} -> {version}")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--base",
        help="Ref to compare against (a pull request's base). Omit to check markers only.",
    )
    args = ap.parse_args()

    manifest = REPO_ROOT / MANIFEST
    if not manifest.exists():
        fail(f"{MANIFEST} not found.")
        return 2
    version = version_of(manifest.read_text(encoding="utf-8"), str(MANIFEST))
    if version is None:
        return 2

    ok = check_markers(version)
    if args.base:
        ok = check_moved(args.base, version) and ok
    else:
        print("skip  version-moved check (no --base given, so there is nothing to compare)")

    print("\nall checks passed" if ok else "\nchecks failed")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
