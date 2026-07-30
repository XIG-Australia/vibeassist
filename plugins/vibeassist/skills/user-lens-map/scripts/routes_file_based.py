#!/usr/bin/env python3
"""Phase 1 route enumeration for FILE-BASED routers (TanStack Start, Expo
Router for React Native, Next-style dirs for simple cases). Generalized from the VA run's gen_routes.py: the
original hardcoded its layout list and redirect table by hand - here both are
DERIVED from the code, so the script works on repos it has never seen.

Rules carried over:
  - dot-nesting flattens: settings.account.tsx -> /settings/account
  - a trailing underscore un-nests: projects_.$projectId... escapes the
    /projects layout
  - pathless _segments (e.g. _authenticated) never appear in the URL
  - [.] protects a literal dot in a filename (sitemap[.]xml)
  Expo Router (React Native) conventions, auto-applied when the routes dir is
  app/ or expo-router is a dependency:
  - (group) segments are organizational only - stripped from the path
  - [param] -> :param, [...rest] -> a catch-all
  - _layout files are the layout itself, never a route
  - +not-found -> the not-found screen (flagged); name+api files -> machine
  - screens have no URLs: "reached from outside" means deep links and push
    notifications - note that in _stack.md
Derived (was hardcoded):
  - LAYOUT: a file whose segments are all pathless is the layout itself (drop);
    a file with dot-children siblings or a same-name sibling dir is a layout
    for them - it stays a route ONLY if it also renders its own component
  - REDIRECT: the file throws redirect({to}) in beforeLoad/loader ->
    audience "redirect" with redirect_to read from the code
  - MACHINE: the route declares no rendered component (structural test),
    with naming conventions as fallback
  - auth_required: true when wrapped by a pathless segment whose name
    contains "auth" (e.g. _authenticated); null otherwise - state the
    app's real guard in _stack.md

Usage:
    python scripts/routes_file_based.py --repo-root . -o map/_routes.json
    [--routes-dir src/routes]
"""
import argparse
import json
import pathlib
import re
import sys
from collections import Counter

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

REDIRECT_TO = re.compile(r"""(?:throw\s+)?redirect\(\s*\{\s*to:\s*["'`]([^"'`]+)""")
HAS_COMPONENT = re.compile(r"component\s*:\s*\w+|export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{[^}]*return\s*\(?\s*<|=>\s*\(?\s*<")
MACHINE_NAMES = re.compile(r"\.well-known|sitemap|robots|webhook|callback|\bfeed\b|healthz?", re.I)


def to_path(rel_after_routes: str) -> str:
    s = re.sub(r"\.(tsx|ts|jsx|js)$", "", rel_after_routes)
    s = s.replace("[.]", "\x00")  # protect literal dots
    parts = []
    for d in s.split("/"):
        parts.extend(d.split("."))
    parts = [p.replace("\x00", ".") for p in parts]
    segs = []
    for p in parts:
        if p.startswith("(") and p.endswith(")"):
            continue  # Expo group segment - organizational, not in the URL
        if p.startswith("[...") and p.endswith("]"):
            p = "*"  # catch-all
        elif p.startswith("[") and p.endswith("]"):
            p = ":" + p[1:-1]  # [id] -> :id
        if p.startswith("_") or p == "__root":
            continue  # pathless layout segment
        if p.endswith("_") and len(p) > 1:
            p = p[:-1]  # trailing underscore un-nests; URL segment keeps the name
        segs.append(p)
    if segs and segs[-1] == "index":
        segs.pop()
    return "/" + "/".join(segs) if segs else "/"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--routes-dir", default="src/routes")
    ap.add_argument("-o", "--out", default="map/_routes.json")
    args = ap.parse_args()
    repo = pathlib.Path(args.repo_root).resolve()
    rdir = repo / args.routes_dir
    if not rdir.is_dir() and args.routes_dir == "src/routes" and (repo / "app").is_dir():
        rdir = repo / "app"  # Expo Router / app-dir convention
    if not rdir.is_dir():
        sys.exit(f"routes dir not found: {rdir} (pass --routes-dir)")

    files = sorted(p for p in rdir.rglob("*") if p.is_file() and p.suffix in (".tsx", ".ts", ".jsx", ".js"))
    stems = set()
    dirs = set()
    for f in files:
        rel = str(f.relative_to(rdir)).replace("\\", "/")
        stems.add(re.sub(r"\.(tsx|ts|jsx|js)$", "", rel))
    for d in rdir.rglob("*"):
        if d.is_dir():
            dirs.add(str(d.relative_to(rdir)).replace("\\", "/"))

    rows = []
    for f in files:
        rel_r = str(f.relative_to(rdir)).replace("\\", "/")
        rel = str(f.relative_to(repo)).replace("\\", "/")
        stem = re.sub(r"\.(tsx|ts|jsx|js)$", "", rel_r)
        segs = stem.replace("[.]", "\x00").split("/")
        flat = [s for part in segs for s in part.split(".")]

        # 1. pure layout: every segment is pathless -> not a route at all
        if all(s.startswith("_") or s == "__root" or (s.startswith("(") and s.endswith(")")) for s in flat):
            continue
        if flat[-1] == "_layout":
            continue  # Expo: the layout file for its folder, never a route itself

        text = f.read_text(encoding="utf-8", errors="replace")

        # 2. layout-with-children: dot-children or same-name dir exist
        has_children = any(s != stem and s.startswith(stem + ".") for s in stems) or (stem in dirs)
        renders_own = bool(HAS_COMPONENT.search(text))
        is_redirect_stub = bool(REDIRECT_TO.search(text)) and not renders_own
        if has_children and not renders_own and not is_redirect_stub:
            continue  # container only; its children are the routes
            # (a container that THROWS A REDIRECT is not a container - it is an
            #  old address kept working, and it must appear as audience "redirect")

        path = to_path(rel_r)
        not_found = flat[-1] == "+not-found"
        is_api = flat[-1].endswith("+api")
        rm = REDIRECT_TO.search(text)
        if rm and not renders_own:
            audience, redirect_to = "redirect", rm.group(1)
        elif is_api or (not renders_own and not not_found):
            # STRUCTURE FIRST, NAMES ONLY WHEN IT IS AMBIGUOUS — which is what
            # this skill's own Phase 1 says, and what the code was not doing. The
            # name test ran even on routes that plainly render a screen, so
            # `healthz?` matched "health" anywhere in a path and filed "Project
            # health check" (/projects/$id/tools/health) and "Setup & Health" —
            # two real pages sitting in the tools rail — as machine endpoints.
            # A route that renders a component is not ambiguous, so the naming
            # conventions only get a say when there is no component to judge.
            # (MACHINE_NAMES is kept below as documentation of the conventions;
            # the structural test now covers every case it used to catch.)
            audience, redirect_to = "machine", None
        else:
            audience, redirect_to = "user", None

        auth_wrappers = [s for s in flat if s.startswith("_") and "auth" in s.lower()]
        layout_chain = [s for s in flat[:-1] if s.startswith("_") or s == "__root"]
        row = {"path": path, "source_file": rel, "layout_chain": layout_chain,
               "auth_required": True if auth_wrappers else None, "audience": audience}
        if redirect_to:
            row["redirect_to"] = redirect_to
        if not_found:
            row["not_found"] = True
        rows.append(row)

    # ONE ROW PER PATH. A pathful layout and its index file resolve to the SAME
    # address: `admin.tsx` is the shell that renders around /admin/*, and
    # `admin.index.tsx` is what you actually get at /admin exactly. Both were
    # emitted — one "user" (the shell, which does render a component and so
    # survives the container test) and one "redirect" (the index, which is what
    # really happens) — so /admin, /settings and a project's config and tools
    # sections each appeared twice. On import that is a duplicate card per
    # section. Expo's _layout files are already dropped above; this is the
    # TanStack pathful-layout case.
    #
    # The index file wins: it IS the route at this address, and the same-named
    # file beside it is its layout.
    by_path: dict[str, dict] = {}
    for r in rows:
        if r["path"] not in by_path or re.search(r"\.index\.(tsx|ts|jsx|js)$", r["source_file"]):
            by_path[r["path"]] = r
    rows = list(by_path.values())

    rows.sort(key=lambda r: (r["audience"] != "user", r["path"]))
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(dict(Counter(r["audience"] for r in rows)), "->", out)


if __name__ == "__main__":
    main()
