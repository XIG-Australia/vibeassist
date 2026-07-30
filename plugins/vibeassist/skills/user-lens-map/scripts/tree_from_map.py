#!/usr/bin/env python3
"""Build the sitemap as an actual TREE from _routes.json.

The assembler's current sitemap is a flat sorted list with each route's
OUTBOUND LINKS indented beneath it, so indentation reads as containment when it
means "links to". This nests by address instead, and invents a group row for a
path segment that has children but no page of its own (/legal, /projects).

  python tree_from_map.py <map-dir> [-o tree.md] [--min-group 2]
"""
import argparse
import json
import pathlib
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def build(routes, min_group=2):
    by_path = {r["path"]: r for r in routes}
    root = {"seg": "", "path": "/", "kids": {}, "route": by_path.get("/")}

    for r in sorted(routes, key=lambda x: x["path"]):
        if r["path"] == "/":
            continue
        node = root
        segs = [s for s in r["path"].split("/") if s]
        for i, seg in enumerate(segs):
            here = "/" + "/".join(segs[: i + 1])
            node = node["kids"].setdefault(
                seg, {"seg": seg, "path": here, "kids": {}, "route": by_path.get(here)}
            )
        node["route"] = r

    def dynamic(seg):
        return seg.startswith(("$", ":", "["))

    # A synthetic node (no page of its own) with too few children is noise:
    # splice its children up into its parent rather than invent a group row.
    # EXCEPT when its child is a parameter — "Projects" containing "a project"
    # is a real place to a reader even though it holds exactly one route, and
    # collapsing it hoists a deep address to the top level.
    def prune(node):
        for kid in list(node["kids"].values()):
            prune(kid)
        for seg, kid in list(node["kids"].items()):
            if kid["route"] is not None:
                continue
            keep = len(kid["kids"]) >= min_group or any(
                dynamic(s) for s in kid["kids"]
            )
            if not keep:
                del node["kids"][seg]
                for gseg, gkid in kid["kids"].items():
                    node["kids"][gseg] = gkid

    prune(root)
    return root


def render(node, out, depth=0, mapped=frozenset()):
    if depth:
        ind = "  " * (depth - 1)
        r = node["route"]
        if r is None:
            # a place with no page of its own
            out.append(f"{ind}- **{node['seg']}/** — group, no page of its own")
        else:
            bits = []
            if r.get("auth_required"):
                bits.append("signed-in")
            if r.get("audience") == "redirect":
                bits.append("redirect")
            if r["path"] in mapped:
                bits.append("mapped")
            suffix = f"  ({', '.join(bits)})" if bits else ""
            out.append(f"{ind}- `{node['path']}`{suffix}")
    # sort by full path, not by the dict key — a node spliced up from a pruned
    # group is keyed on its last segment, so keying the sort misfiles it
    for kid in sorted(node["kids"].values(), key=lambda k: k["path"]):
        render(kid, out, depth + 1, mapped)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("map_dir")
    ap.add_argument("-o", "--out")
    ap.add_argument("--min-group", type=int, default=2)
    args = ap.parse_args()

    mp = pathlib.Path(args.map_dir)
    routes = json.loads((mp / "_routes.json").read_text(encoding="utf-8"))
    user = [r for r in routes if r.get("audience") in ("user", "redirect")]
    mapped = {p.stem for p in (mp / "pages").glob("*.md")}
    # page files are slugs; match on the slug rule instead
    def slug(p):
        s = p.lstrip("/").replace("/", "-")
        for ch in ":$[]":
            s = s.replace(ch, "")
        return s or "index"
    mapped_paths = {r["path"] for r in user if slug(r["path"]) in mapped}

    root = build(user, args.min_group)
    lines = ["# Sitemap — nested by address\n"]
    render(root, lines, 0, mapped_paths)

    text = "\n".join(lines) + "\n"
    if args.out:
        pathlib.Path(args.out).write_text(text, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
