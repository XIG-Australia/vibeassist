#!/usr/bin/env python3
"""Vanilla-JS strategy (no modules, no router) - adopted from the BM run.
Parameterized: pass --repo-root; FILES defaults to index.html + js/*.js.
"""
#!/usr/bin/env python3
"""Build a function-scoped data-access index for the BM-quote-app vanilla-JS app.

No modules/imports, so the skill's harvest.py can't follow anything. Instead:
  1. find every top-level-ish function boundary in index.html + js/*.js
  2. attribute every sb.from('t') / sb.rpc('f') / sb.functions.invoke('fn')
     to its enclosing function, with a line number
  3. emit a JSON index + a callers index so a control's onclick can be walked
     to the tables it touches.
"""
import json, pathlib, re, sys, collections

import argparse
_ap = argparse.ArgumentParser()
_ap.add_argument("--repo-root", default=".")
_ap.add_argument("-o", "--out", default=None)
_args = _ap.parse_args()
ROOT = pathlib.Path(_args.repo_root).resolve()
FILES = ["index.html"] + [f"js/{p.name}" for p in sorted((ROOT / "js").glob("*.js"))] \
        + ["quote.html", "variation.html", "pay.html", "insurance.html", "swms.html", "qa.html"]

FN_DEFS = [
    re.compile(r"^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\("),
    re.compile(r"^\s*window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function"),
    re.compile(r"^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function|\()"),
]
DB_FROM = re.compile(r"""\.from\(\s*['"]([\w.]+)['"]\s*\)""")
RPC = re.compile(r"""\.rpc\(\s*['"]([\w.]+)['"]""")
INVOKE = re.compile(r"""functions\.invoke\(\s*['"]([\w-]+)['"]""")
STORAGE = re.compile(r"""storage\.from\(\s*['"]([\w-]+)['"]\s*\)""")
OPS = [(re.compile(r"\.insert\s*\("), "INSERT"), (re.compile(r"\.upsert\s*\("), "INSERT/UPDATE"),
       (re.compile(r"\.update\s*\("), "UPDATE"), (re.compile(r"\.delete\s*\("), "DELETE"),
       (re.compile(r"\.select\s*\("), "READ")]


def op_for(lines, i):
    win = " ".join(lines[i:i + 6])
    for pat, op in OPS:
        if pat.search(win):
            return op
    return "READ?"


def main():
    index = {}      # file -> [ {line, fn, kind, name, op} ]
    fnmap = collections.defaultdict(list)   # fn name -> [ {file,line,kind,name,op} ]
    fndef = {}      # fn name -> "file:line"
    for rel in FILES:
        f = ROOT / rel
        if not f.is_file():
            continue
        lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
        cur = "(top level)"
        rows = []
        for i, line in enumerate(lines):
            n = i + 1
            for pat in FN_DEFS:
                m = pat.match(line)
                if m:
                    cur = m.group(1)
                    fndef.setdefault(cur, f"{rel}:{n}")
                    break
            hits = []
            for m in DB_FROM.finditer(line):
                hits.append(("table", m.group(1), op_for(lines, i)))
            for m in RPC.finditer(line):
                hits.append(("rpc", m.group(1), "RPC"))
            for m in INVOKE.finditer(line):
                hits.append(("edge", m.group(1), "EDGE"))
            for m in STORAGE.finditer(line):
                hits.append(("bucket", m.group(1), "STORAGE"))
            for kind, name, op in hits:
                row = {"file": rel, "line": n, "fn": cur, "kind": kind, "name": name, "op": op}
                rows.append(row)
                fnmap[cur].append(row)
        index[rel] = rows
    out = {"by_file": index, "by_fn": fnmap, "fn_defs": fndef}
    p = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "calls_index.json")
    p.write_text(json.dumps(out, indent=1), encoding="utf-8")
    tot = sum(len(v) for v in index.values())
    print(f"{tot} data-access sites across {len(index)} files; {len(fnmap)} functions touch data; {len(fndef)} fn defs")
    for rel, rows in index.items():
        print(f"  {rel}: {len(rows)}")


main()
