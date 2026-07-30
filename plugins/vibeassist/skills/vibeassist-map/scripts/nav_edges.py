#!/usr/bin/env python3
"""Vanilla-JS strategy (no modules, no router) - adopted from the BM run.
Parameterized: pass --repo-root; FILES defaults to index.html + js/*.js.
"""
import re, pathlib, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse
_ap = argparse.ArgumentParser()
_ap.add_argument("--repo-root", default=".")
_ap.add_argument("-o", "--out", default=None)
_args = _ap.parse_args()
ROOT = pathlib.Path(_args.repo_root).resolve()
FILES = ["index.html"] + [f"js/{p.name}" for p in sorted((ROOT / "js").glob("*.js"))]
FN = [re.compile(r"^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\("),
      re.compile(r"^\s*window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function"),
      re.compile(r"^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function|\()")]
SHOW = re.compile(r"showPanel\(\s*\\?['\"]([\w-]+)")
EST = re.compile(r"openEstimate\(\)")
WTAB = re.compile(r"bmwSetTab\(\s*\\?['\"](\w+)")
for rel in FILES:
    lines = (ROOT / rel).read_text(encoding="utf-8", errors="replace").splitlines()
    cur = "(top)"
    for i, l in enumerate(lines):
        for p in FN:
            m = p.match(l)
            if m:
                cur = m.group(1)
                break
        outs = [g for g in SHOW.findall(l)]
        outs += ["estimate"] * len(EST.findall(l))
        outs += ["field:" + g for g in WTAB.findall(l)]
        for t in outs:
            print(f"{rel}:{i+1}\t{cur}\t-> {t}")
