#!/usr/bin/env python3
"""Evidence gate for vibeassist-map (Phase 4).

Checks every Evidence line in map/pages/*.md:
  1. each cited file exists (relative to the repo root)
  2. each cited line/range is within the file
  3. the cited range CONTAINS the backticked symbols/tables named on that line
     (existence alone is not enough - a citation can point at a real file and
     the wrong line)

Usage:
    python scripts/check_evidence.py map/pages/ [--repo-root .]

Exit code 0 = all claims verified; 1 = failures listed on stdout.
A failed check means RE-TRACE the claim, never soften its wording.
"""
import argparse
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pages_dir")
    ap.add_argument("--repo-root", default=".")
    args = ap.parse_args()
    repo = pathlib.Path(args.repo_root).resolve()
    pages = sorted(pathlib.Path(args.pages_dir).glob("*.md"))
    if not pages:
        print(f"no page files found in {args.pages_dir}", file=sys.stderr)
        sys.exit(2)

    failures = 0
    checked = 0
    for page in pages:
        for n, line in enumerate(page.read_text(encoding="utf-8").splitlines(), 1):
            if "Evidence:" not in line:
                continue
            checked += 1
            for ok, msg in check_line(line, repo):
                if not ok:
                    failures += 1
                    print(f"FAIL {page.name}:{n}  {msg}")
                    print(f"     {line.strip()}")

    print(f"\n{checked} evidence lines checked, {failures} failure(s).")
    if failures:
        print("Re-trace each failing claim against the code. Do NOT reword to vagueness.")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
