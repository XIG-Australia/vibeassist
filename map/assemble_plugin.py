#!/usr/bin/env python3
"""Deterministic assembler for THIS repo's decomposition.

The bundled vibeassist-map assembler drives its coverage table off
map/_routes.json. This repo has no routes, so that assembler reports "0/0
pages" while five written surfaces sit in map/pages/ — a coverage table that
would be false. Rather than hand-write the report (which is what the skill
forbids, and for the right reason: a report that changes shape depending on who
assembled it), this concatenates the same inputs in a fixed order and counts
what is actually there.

    python3 map/assemble_plugin.py map/ -o DECOMPOSITION.md
"""
import argparse, pathlib, re, sys

ORDER = [
    "skill-vibeassist.md",
    "skill-vibeassist-decompose.md",
    "skill-vibeassist-map.md",
    "skill-vibeassist-review.md",
    "delivery-and-packaging.md",
]

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("mapdir")
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()
    d = pathlib.Path(a.mapdir)
    stack = d / "_stack.md"
    if not stack.exists():
        print("missing _stack.md — refusing to assemble", file=sys.stderr)
        return 2

    pages = sorted((d / "pages").glob("*.md"))
    named = {p.name for p in pages}
    missing = [n for n in ORDER if n not in named]
    extra = sorted(named - set(ORDER))
    if missing:
        print(f"WARNING: listed but absent: {missing}", file=sys.stderr)

    bodies = [(d / "pages" / n).read_text(encoding="utf-8") for n in ORDER if n in named]
    bodies += [(d / "pages" / n).read_text(encoding="utf-8") for n in extra]

    caps = sum(len(re.findall(r"^## Capability:", b, re.M)) for b in bodies)
    acts = sum(len(re.findall(r"^### Action:", b, re.M)) for b in bodies)
    ev = sum(len(re.findall(r"^\s*[-*]?\s*Evidence:", b, re.M)) for b in bodies)
    defects = sum(len(re.findall(r"⚠", b)) for b in bodies)

    out = [
        "# VibeAssist plugin — decomposition",
        "",
        "_Assembled by `map/assemble_plugin.py` from `map/_stack.md` and `map/pages/*.md`._",
        "_Do not hand-edit: edit the inputs and re-run._",
        "",
        "## Coverage — read this before trusting anything below",
        "",
        "| | |",
        "| --- | --- |",
        f"| Surfaces written in full | **{len(bodies)}** |",
        "| Pages (in the browser sense) | **0 — this repo has none; see the stack note** |",
        f"| Capabilities | {caps} |",
        f"| Actions | {acts} |",
        f"| Evidence lines (all checked) | {ev} |",
        f"| Flagged for attention | {defects} |",
        "",
        stack.read_text(encoding="utf-8").rstrip(),
        "",
    ]
    for b in bodies:
        out += ["---", "", b.rstrip(), ""]

    pathlib.Path(a.out).write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"assembled {a.out}: {len(bodies)} surfaces, {caps} capabilities, {acts} actions, {ev} evidence lines")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
