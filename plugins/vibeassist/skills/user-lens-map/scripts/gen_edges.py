#!/usr/bin/env python3
"""Phase 2 link-edge builder, generalized from the VA run's gen_edges.py.
The original hardcoded which files are 'chrome' and which rails are computed;
here both are derived:

  - literal links: every  to:/href= "/path"  string in src/, matched against
    known routes with parameter syntax normalized on both sides
    ($x, [x], :x, ${...} all become :p before comparing)
  - attribution: if the file IS a route's own file, the edge belongs to that
    page; otherwise it is «global navigation» (shared chrome), with the file
    stem as the trigger
  - automatic redirects: redirect({to}) calls in route files
  - computed rails (Phase 2 place 4): template literals like
    to: `/projects/${p.id}/config/${t.slug}` - take the fixed prefix before
    the first ${, normalize it, and connect every known route beneath that
    prefix, labelled "rail built from a list"

Usage:
    python scripts/gen_edges.py map/_routes.json --repo-root . -o map/_edges.json
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

LIT = re.compile(r"""(?:to|href)\s*[:=]\s*[{(]?\s*["'`](/[A-Za-z0-9_\-./$:\[\]{}]*)["'`]""")
TEMPLATE = re.compile(r"""(?:to|href)\s*[:=]\s*[{(]?\s*`(/[^`$]*)\$\{""")
REDIR = re.compile(r"""redirect\(\{\s*to:\s*["'`](/[^"'`]*)""")


def canon(p: str) -> str:
    p = re.sub(r"\$\{[^}]+\}", ":p", p)
    p = re.sub(r"\$(\w+)", ":p", p)
    p = re.sub(r"\[(\w+)\]", ":p", p)
    p = re.sub(r":(\w+)", ":p", p)
    return p.rstrip("/") or "/"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("routes_json")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--src-dir", default="src")
    ap.add_argument("-o", "--out", default="map/_edges.json")
    args = ap.parse_args()
    repo = pathlib.Path(args.repo_root).resolve()
    routes = json.loads(pathlib.Path(args.routes_json).read_text(encoding="utf-8"))
    if isinstance(routes, dict):
        routes = routes.get("routes", [])
    known = {r["path"] for r in routes}
    canon_known = {}
    for k in known:
        canon_known.setdefault(canon(k), []).append(k)
    route_by_file = {r["source_file"]: r for r in routes}

    edges, seen = [], set()

    def add(src, dst, trig):
        key = (src, dst, trig)
        if key not in seen:
            seen.add(key)
            edges.append({"from": src, "to": dst, "trigger": trig})

    scan = [p for pat in ("**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js")
            for p in (repo / args.src_dir).glob(pat) if "node_modules" not in p.parts]
    for f in scan:
        rel = str(f.relative_to(repo)).replace("\\", "/")
        try:
            txt = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        r = route_by_file.get(rel)
        src_label = r["path"] if r else "«global navigation»"
        trig = "link on the page" if r else f"shared component ({f.stem})"
        for m in set(LIT.findall(txt)):
            for real in canon_known.get(canon(m), []):
                if r and real == r["path"]:
                    continue
                add(src_label, real, trig)
        # computed rails: fixed prefix before the first ${
        for pref in set(TEMPLATE.findall(txt)):
            cp = canon(pref).rstrip("/")
            hits = [k for k in known if canon(k).startswith(cp + "/") or canon(k) == cp]
            if cp not in ("", "/") and 0 < len(hits) <= 40:  # a bare "/" prefix would match everything
                for real in hits:
                    add(src_label, real, ("rail built from a list" if not r else "rail on the page, built from a list"))
        if r:
            for m in set(REDIR.findall(txt)):
                for real in canon_known.get(canon(m), []):
                    add(r["path"], real, "automatic redirect")

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(edges, indent=2), encoding="utf-8")
    inbound = {e["to"] for e in edges}
    no_in = sorted(p for p in known if p not in inbound
                   and next(r for r in routes if r["path"] == p).get("audience") == "user" and p != "/")
    print(f"{len(edges)} edges -> {out}")
    if no_in:
        print("NO INBOUND (a claim, not an observation - check chrome, config arrays, computed rails, and 'reached from outside'):")
        for p in no_in:
            print("  ", p)


if __name__ == "__main__":
    main()
