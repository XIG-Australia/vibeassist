#!/usr/bin/env python3
"""Phase 1 route enumeration for react-router apps (Lovable-style) — Fix 2.

Routes are JSX in a tree, not files, so this PARSES rather than globs:
  - <Routes>/<Route> JSX trees (BrowserRouter style, Lovable's default)
  - createBrowserRouter([...]) object trees
  - relative paths COMPOSE down the nesting: <Route path="edit"> inside
    <Route path="projects/:id"> is /projects/:id/edit
  - <Route index> means the parent's own path, not a new segment
  - a <Route> with children and no element is a LAYOUT, not a route
    (the same layout-is-not-a-route guard Phase 1 has for file-based routers)
  - <Navigate to> => audience "redirect" with redirect_to
  - path="*" => the not-found page (user-facing, flagged)
  - components arrive via lazy(() => import('./pages/Foo')) or static imports;
    both are resolved (through tsconfig path aliases) to a source_file

Usage:
    python scripts/routes_react_router.py --repo-root . -o map/_routes.json
    (optionally: --entry src/App.tsx to skip the search)
"""
import argparse
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harvest import load_aliases, resolve_import, route_slug  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROUTE_OPEN = re.compile(r"<Route\b")
ROUTE_CLOSE = re.compile(r"</Route\s*>")


def tokenize_route_tags(text: str):
    """Yield ('open'|'selfclose'|'close', attr_text, pos). A JSX attr like
    element={<AppShell />} contains '>' inside braces, so the tag's true end
    must be found by tracking {} depth - a plain [^>]* regex truncates it."""
    i = 0
    while i < len(text):
        mo = ROUTE_OPEN.search(text, i)
        mc = ROUTE_CLOSE.search(text, i)
        if not mo and not mc:
            return
        if mc and (not mo or mc.start() < mo.start()):
            yield ("close", "", mc.start())
            i = mc.end()
            continue
        j, depth = mo.end(), 0
        while j < len(text):
            ch = text[j]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            elif ch == ">" and depth == 0:
                break
            j += 1
        attr_text = text[mo.end():j]
        kind = "selfclose" if attr_text.rstrip().endswith("/") else "open"
        yield (kind, attr_text.rstrip().rstrip("/"), mo.start())
        i = j + 1
ATTR_PATH = re.compile(r"""\bpath\s*=\s*(?:["']([^"']+)["']|\{\s*["']([^"']+)["']\s*\})""")
ATTR_INDEX = re.compile(r"\bindex\b(?!\s*=\s*\{?\s*false)")
ATTR_ELEMENT = re.compile(r"\belement\s*=\s*\{\s*<\s*([A-Za-z_]\w*)")
ATTR_NAVIGATE = re.compile(r"""<\s*Navigate\b[^>]*\bto\s*=\s*(?:["']([^"']+)["']|\{\s*["']([^"']+)["']\s*\})""")
LAZY_IMPORT = re.compile(r"""(?:const|let|var)\s+(\w+)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)""")
STATIC_IMPORT = re.compile(r"""import\s+(?:(\w+)|\{([^}]+)\})\s+from\s+['"]([^'"]+)['"]""")


def norm_param(path: str) -> str:
    return path  # react-router already uses :param — the canonical form


def join_paths(parent: str, child: str) -> str:
    if child.startswith("/"):
        return child
    if not parent:
        return "/" + child
    return (parent.rstrip("/") + "/" + child) if child else parent


def build_import_map(text: str):
    """component name -> import spec (lazy and static)."""
    imp = {}
    for name, spec in LAZY_IMPORT.findall(text):
        imp[name] = spec
    for default, named, spec in STATIC_IMPORT.findall(text):
        if default:
            imp[default] = spec
        for n in named.split(","):
            n = n.strip().split(" as ")[-1].strip()
            if n:
                imp[n] = spec
    return imp


def attrs_of(attr_text: str):
    m = ATTR_PATH.search(attr_text)
    path = (m.group(1) or m.group(2)) if m else None
    el = ATTR_ELEMENT.search(attr_text)
    nav = ATTR_NAVIGATE.search(attr_text)
    return {
        "path": path,
        "index": bool(ATTR_INDEX.search(re.sub(ATTR_PATH.pattern, "", attr_text))),
        "component": el.group(1) if el else None,
        "navigate_to": (nav.group(1) or nav.group(2)) if nav else None,
    }


def parse_jsx(text: str):
    """Walk <Route> tags with a stack; emit route dicts for leaves and
    element-bearing nodes; layouts (children, no element) are chain-only."""
    routes = []
    stack = []  # each: {"attrs":…, "children_seen":bool}

    def emit(node, ancestors):
        a = node["attrs"]
        full = ""
        for anc in ancestors:
            p = anc["attrs"]["path"]
            if p:
                full = join_paths(full, p)
        if a["index"]:
            path = full or "/"
        elif a["path"] is not None:
            path = join_paths(full, a["path"])
        else:
            return  # pathless, non-index, no path: pure layout wrapper
        entry = {"path": path or "/",
                 "component": a["component"],
                 "layout_chain": [anc["attrs"]["component"] for anc in ancestors if anc["attrs"]["component"]],
                 "audience": "user"}
        if a["navigate_to"]:
            entry["audience"] = "redirect"
            entry["redirect_to"] = join_paths(full, a["navigate_to"]) if not a["navigate_to"].startswith("/") else a["navigate_to"]
        if a["path"] == "*" or path.endswith("/*") and a["path"] == "*":
            entry["not_found"] = True
        routes.append(entry)

    for kind, attrs, _pos in tokenize_route_tags(text):
        if kind == "close":
            if stack:
                node = stack.pop()
                # closing a Route that had children: it's a layout if no element,
                # or a layout-with-UI if element+children — either way children cover it
                if not node["children_seen"] and (node["attrs"]["path"] is not None or node["attrs"]["index"] or node["attrs"]["navigate_to"]):
                    emit(node, stack)
            continue
        node = {"attrs": attrs_of(attrs), "children_seen": False}
        if stack:
            stack[-1]["children_seen"] = True
        if kind == "selfclose":
            emit(node, stack)
        else:
            stack.append(node)
    return routes


def split_objects(arr_text: str):
    """Split a JS array literal's top-level {...} objects."""
    objs, depth, start = [], 0, None
    for i, ch in enumerate(arr_text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                objs.append(arr_text[start + 1:i])
                start = None
    return objs


def find_children_span(obj_text: str):
    m = re.search(r"\bchildren\s*:\s*\[", obj_text)
    if not m:
        return None, obj_text
    depth, i = 1, m.end()
    while i < len(obj_text) and depth:
        if obj_text[i] == "[":
            depth += 1
        elif obj_text[i] == "]":
            depth -= 1
        i += 1
    return obj_text[m.end():i - 1], obj_text[:m.start()] + obj_text[i:]


def parse_router_objects(arr_text: str, parent_path: str, chain, routes):
    for obj in split_objects(arr_text):
        children_text, own = find_children_span(obj)
        a = attrs_of(own.replace("path:", "path=").replace("element:", "element={").replace("index:", "index "))
        # object syntax needs its own field regexes; redo path/index simply:
        pm = re.search(r"""\bpath\s*:\s*["']([^"']+)["']""", own)
        a["path"] = pm.group(1) if pm else None
        a["index"] = bool(re.search(r"\bindex\s*:\s*true", own))
        em = re.search(r"\belement\s*:\s*<\s*([A-Za-z_]\w*)", own)
        a["component"] = em.group(1) if em else None
        nm = ATTR_NAVIGATE.search(own)
        a["navigate_to"] = (nm.group(1) or nm.group(2)) if nm else None
        if a["index"]:
            full = parent_path or "/"
        elif a["path"] is not None:
            full = join_paths(parent_path, a["path"])
        else:
            full = parent_path  # pathless layout
        if children_text is not None:
            new_chain = chain + ([a["component"]] if a["component"] else [])
            parse_router_objects(children_text, full if a["path"] is not None else parent_path, new_chain, routes)
            continue  # layout: not itself a route
        if a["path"] is None and not a["index"]:
            continue
        entry = {"path": full or "/", "component": a["component"], "layout_chain": chain, "audience": "user"}
        if a["navigate_to"]:
            entry["audience"] = "redirect"
            entry["redirect_to"] = a["navigate_to"]
        if a["path"] == "*":
            entry["not_found"] = True
        routes.append(entry)


def find_entry(repo: pathlib.Path):
    cands = []
    for name in ("src/App.tsx", "src/App.jsx", "src/main.tsx", "src/main.jsx", "src/router.tsx", "src/routes.tsx", "app/App.tsx"):
        f = repo / name
        if f.is_file():
            cands.append(f)
    for f in repo.glob("src/**/*.[tj]sx"):
        if "node_modules" not in f.parts and f not in cands:
            try:
                t = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if "createBrowserRouter" in t or "<Routes" in t:
                cands.append(f)
    for f in cands:
        t = f.read_text(encoding="utf-8", errors="replace")
        if "createBrowserRouter" in t or "<Routes" in t or "<Route" in t:
            return f, t
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--entry", default=None, help="router file, e.g. src/App.tsx")
    ap.add_argument("-o", "--out", default="map/_routes.json")
    args = ap.parse_args()
    repo = pathlib.Path(args.repo_root).resolve()
    aliases = load_aliases(repo)

    if args.entry:
        entry = repo / args.entry
        text = entry.read_text(encoding="utf-8", errors="replace")
    else:
        entry, text = find_entry(repo)
        if entry is None:
            sys.exit("No react-router registration found (createBrowserRouter or <Routes>). Wrong repo or wrong strategy.")

    routes = []
    m = re.search(r"createBrowserRouter\s*\(\s*\[", text)
    if m:
        depth, i = 1, m.end()
        while i < len(text) and depth:
            if text[i] == "[":
                depth += 1
            elif text[i] == "]":
                depth -= 1
            i += 1
        parse_router_objects(text[m.end():i - 1], "", [], routes)
    routes.extend(parse_jsx(text))

    imp = build_import_map(text)
    out_routes, seen = [], set()
    for r in routes:
        if r["path"] in seen:
            continue
        seen.add(r["path"])
        comp = r.pop("component", None)
        src_file = None
        if comp and comp in imp:
            resolved = resolve_import(entry, imp[comp], repo, aliases)
            if resolved:
                src_file = str(resolved.relative_to(repo)).replace("\\", "/")
        out_routes.append({"path": r["path"],
                           "source_file": src_file or str(entry.relative_to(repo)).replace("\\", "/"),
                           "component": comp,
                           "layout_chain": r.get("layout_chain", []),
                           "auth_required": None,  # react-router guards are wrapper components; decide per-app in Phase 1 prose
                           "audience": r.get("audience", "user"),
                           **({"redirect_to": r["redirect_to"]} if "redirect_to" in r else {}),
                           **({"not_found": True} if r.get("not_found") else {}),
                           "slug": route_slug(r["path"])})
    outp = pathlib.Path(args.out)
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(json.dumps(out_routes, indent=2), encoding="utf-8")
    nred = sum(1 for r in out_routes if r["audience"] == "redirect")
    print(f"react-router: {len(out_routes)} routes -> {outp} ({nred} redirects) from {entry.name}")
    if not out_routes:
        sys.exit("Router file found but zero routes parsed - inspect it by hand before continuing.")


if __name__ == "__main__":
    main()
