#!/usr/bin/env python3
"""Evidence gate for vibeassist-map (Phase 4).

Checks every Evidence line in map/pages/*.md:
  1. each cited file exists (relative to the repo root)
  2. each cited line/range is within the file
  3. the cited range CONTAINS the backticked symbols/tables named on that line
     (existence alone is not enough - a citation can point at a real file and
     the wrong line)

It also checks what is NOT there:
  4. an Action with no Evidence line at all — the quality bar says "every action
     has Evidence" and nothing was enforcing it, because a gate that only reads
     lines containing "Evidence:" cannot see a missing one
  5. a page-less reading (SKILL.md Phase 1b) — no page files, so the checks
     above have nothing to read. It verifies each capability's source file
     instead of exiting with an error.

Usage:
    python scripts/check_evidence.py map/pages/ [--repo-root .]
    python scripts/check_evidence.py map/pages/ --capabilities map/_capabilities.json

Exit code 0 = all claims verified; 1 = failures listed on stdout.
A failed check means RE-TRACE the claim, never soften its wording.

A claim you genuinely cannot verify is marked `⚠ UNVERIFIED` in the page file.
That is SKILL.md's own escape hatch and this counts it as one rather than as a
failure — see the note above UNVERIFIED below for why it had to.
"""
import argparse
import json
import pathlib
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# `$` and `[]` belong in the class: file-based routers put route parameters IN
# the filename (projects.$projectId.tsx, [projectId]/page.tsx), and without them
# the path silently truncates to a "missing file" on every dynamic route.
CITE = re.compile(r"(?P<file>[\w./\\$\[\]-]+\.[A-Za-z]{1,10}):(?P<start>\d+)(?:-(?P<end>\d+))?")
TICKED = re.compile(r"`([^`]+)`")
# tokens that are prose markers, not symbols to look up
SKIP_TOKENS = {"READ", "INSERT", "UPDATE", "DELETE", "READS", "WRITES", "None"}

# THE ESCAPE HATCH THE SKILL DOCUMENTS AND THE GATE DID NOT HAVE.
#
# SKILL.md: "Anything you cannot re-verify gets an explicit ⚠ UNVERIFIED
# marker", and its quality bar passes a run whose "failures are marked ⚠
# UNVERIFIED". This script had no such branch — a marked line still counted as
# a failure and still exited 1 — so the documented way out led nowhere and the
# only ways forward were to delete the claim or edit this script, both of which
# the same page forbids. A gate you have to go around is not a gate.
#
# Counted and REPORTED rather than ignored: an unverified claim is a real cost
# and a run that has ten of them must not read like a run that has none.
UNVERIFIED = re.compile(r"UNVERIFIED", re.I)
ACTION_H = re.compile(r"^###\s+Action:\s*(?P<name>.+?)\s*$")
# Any heading ends the action's block — the next action, the next capability,
# the next page-level field.
BLOCK_END = re.compile(r"^(#{1,6}\s|\*\*)")


def check_line(line: str, repo: pathlib.Path):
    """Yield (ok, message) for one Evidence line."""
    cites = list(CITE.finditer(line))
    if not cites:
        yield False, "no file:line citation on Evidence line"
        return
    def looks_like_path(t):
        return "/" in t or "\\" in t or re.search(r"\.[A-Za-z]{1,10}$", t)
    symbols = [t for t in TICKED.findall(line) if t not in SKIP_TOKENS and not looks_like_path(t)]
    # strip column lists like (display_name) from table tokens
    symbols = [s.split("(")[0].strip() for s in symbols]
    cited_text = ""
    for m in cites:
        f = repo / m["file"].replace("\\", "/")
        if not f.is_file():
            yield False, f"missing file: {m['file']}"
            continue
        lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
        start = int(m["start"])
        end = int(m["end"] or start)
        if start < 1 or end > len(lines):
            yield False, f"range out of bounds: {m['file']}:{start}-{end} (file has {len(lines)} lines)"
            continue
        # widen a little: a symbol may sit a couple of lines from the cited anchor
        lo, hi = max(0, start - 3), min(len(lines), end + 3)
        cited_text += "\n".join(lines[lo:hi]) + "\n"
        yield True, f"ok: {m['file']}:{start}-{end}"
    for sym in symbols:
        if sym and sym not in cited_text:
            yield False, f"symbol `{sym}` not found in any cited range on this line"


def actions_without_evidence(text):
    """Actions in one page file that carry no Evidence line at all.

    THE GATE COULD NOT SEE A MISSING CITATION. It read only lines containing
    "Evidence:", so an Action with none was invisible to it — while the quality
    bar claimed "Every action has Evidence". The one failure the gate existed to
    prevent, a claim published with nothing behind it, was the one shape it could
    not detect.
    """
    out, current, seen_evidence, start = [], None, False, 0
    for n, line in enumerate(text.splitlines(), 1):
        m = ACTION_H.match(line)
        if m:
            if current and not seen_evidence:
                out.append((start, current))
            current, seen_evidence, start = m.group("name"), False, n
            continue
        if current is None:
            continue
        if "Evidence:" in line:
            seen_evidence = True
        elif BLOCK_END.match(line) and not line.startswith("###"):
            # A capability heading or a page-level field closed the block.
            if not seen_evidence:
                out.append((start, current))
            current = None
    if current and not seen_evidence:
        out.append((start, current))
    return out


def check_capabilities(caps_file, repo):
    """Phase 1b: a reading with no pages still has to be checkable.

    The gate reads `map/pages/` and a page-less repository has none, so this
    script used to exit 2 — an ERROR — on a perfectly good reading of a plugin.
    SKILL.md Phase 1b tells the runner to skip Phase 4 and verify by hand, and
    PR 1002 tightened the job instruction to "nothing is returned unchecked".
    Hand-verification is still the rule for what a capability SAYS; what a
    machine can check is that the file it names exists at all, so it does.
    """
    try:
        caps = json.loads(caps_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"cannot read {caps_file}: {exc}")
        return 1
    failures = 0
    for cap in caps:
        name = (cap.get("name") or "").strip()
        if not name:
            print(f"FAIL {caps_file.name}  a capability with no name")
            failures += 1
            continue
        src = (cap.get("file") or "").strip()
        if not src:
            print(f"FAIL {caps_file.name}  '{name}' names no file — nothing to check it against")
            failures += 1
        elif not (repo / src).exists():
            print(f"FAIL {caps_file.name}  '{name}' cites {src}, which does not exist")
            failures += 1
    print(f"\n{len(caps)} capability/capabilities checked, {failures} failure(s).")
    if not failures:
        print("Their FILES exist. What each one SAYS is not machine-checkable — Phase 1b")
        print("asks you to re-read each source and confirm it by hand, and to say in your")
        print("feedback that you did and how many. A run that skipped the only verification")
        print("step must not read like one that passed it.")
    return failures


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pages_dir")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument(
        "--capabilities",
        default=None,
        help="map/_capabilities.json — checked instead of pages on a Phase 1b "
             "(page-less) reading. Defaults to _capabilities.json beside the pages dir.",
    )
    args = ap.parse_args()
    repo = pathlib.Path(args.repo_root).resolve()
    pages_dir = pathlib.Path(args.pages_dir)
    pages = sorted(pages_dir.glob("*.md"))

    caps_file = (pathlib.Path(args.capabilities) if args.capabilities
                 else pages_dir.parent / "_capabilities.json")
    if not pages:
        # A PAGE-LESS READING IS NOT A BROKEN ONE.
        if caps_file.is_file():
            print(f"no page files — checking {caps_file} instead (SKILL.md Phase 1b)")
            sys.exit(1 if check_capabilities(caps_file, repo) else 0)
        print(f"no page files found in {args.pages_dir}, and no {caps_file.name} either.",
              file=sys.stderr)
        print("If this repository has no pages, write its surface to _capabilities.json",
              file=sys.stderr)
        print("(SKILL.md Phase 1b). If it has pages, Phase 3 has not run yet.", file=sys.stderr)
        sys.exit(2)

    failures = 0
    checked = 0
    unverified = 0
    uncited = []
    for page in pages:
        text = page.read_text(encoding="utf-8")
        for n, line in enumerate(text.splitlines(), 1):
            if "Evidence:" not in line:
                continue
            checked += 1
            # Marked as unverifiable BY THE AUTHOR. Reported, never silently
            # accepted, and never counted as a pass.
            if UNVERIFIED.search(line):
                unverified += 1
                print(f"UNVERIFIED {page.name}:{n}  {line.strip()}")
                continue
            for ok, msg in check_line(line, repo):
                if not ok:
                    failures += 1
                    print(f"FAIL {page.name}:{n}  {msg}")
                    print(f"     {line.strip()}")
        for n, name in actions_without_evidence(text):
            failures += 1
            uncited.append(f"{page.name}:{n}")
            print(f"FAIL {page.name}:{n}  action '{name}' has NO Evidence line")

    print(f"\n{checked} evidence lines checked, {failures} failure(s), "
          f"{unverified} marked unverified.")
    if uncited:
        print(f"{len(uncited)} action(s) carry no citation at all: {', '.join(uncited[:8])}")
        print("An action with no Evidence is a claim with nothing behind it. Trace it or")
        print("delete it — those are the two honest endings.")
    if failures:
        print("Re-trace each failing claim against the code. Do NOT reword to vagueness.")
    if unverified and not failures:
        print("Marked-unverified claims are a real cost: they reach the board as claims")
        print("nobody could check. Say how many in your feedback.")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
