#!/usr/bin/env node
// Vanilla-JS strategy (no modules, no router) - faithful ESM port of
// index_calls.py. Builds a function-scoped data-access index for the vanilla-JS
// app: finds function boundaries, attributes every sb.from()/.rpc()/
// functions.invoke()/storage.from() to its enclosing function with a line
// number, and emits a JSON index (by_file / by_fn / fn_defs).
//
// Behaviour (CLI args, input reading, output file, stdout, exit codes) is
// byte-for-byte identical to the Python. NOTE (faithful quirk): the output path
// is sys.argv[1] (RAW argv, NOT the argparse --out); JSON uses indent=1.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dumps } from './_pyjson.mjs'

// ---------------------------------------------------------------------------
// Python-ism helpers
// ---------------------------------------------------------------------------
function print(s) { fs.writeSync(1, s + '\n') }
function eprint(s) { fs.writeSync(2, s + '\n') }

function isFile(p) {
  try { return fs.statSync(p).isFile() } catch { return false }
}
// pathlib read_text(encoding='utf-8', errors='replace').
function readTextReplace(p) {
  return fs.readFileSync(p).toString('utf8')
}
// Python default sort on strings = by Unicode code point.
function cmpCodepoint(a, b) {
  const ai = Array.from(a), bi = Array.from(b)
  const n = Math.min(ai.length, bi.length)
  for (let i = 0; i < n; i++) {
    const x = ai[i].codePointAt(0), y = bi[i].codePointAt(0)
    if (x !== y) return x < y ? -1 : 1
  }
  return ai.length - bi.length
}
// Faithful reproduction of str.splitlines() (all Unicode line boundaries).
function pySplitlines(s) {
  const res = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const code = s.charCodeAt(i)
    if (c === '\r') {
      res.push(cur); cur = ''
      if (s[i + 1] === '\n') i++
    } else if (
      c === '\n' || code === 0x0b || code === 0x0c ||
      code === 0x1c || code === 0x1d || code === 0x1e ||
      code === 0x85 || code === 0x2028 || code === 0x2029
    ) {
      res.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  if (cur !== '') res.push(cur)
  return res
}
// pathlib Path.glob('*.js') over one directory (non-recursive). Missing dir -> [].
function globJs(dir) {
  let ents
  try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  const out = []
  for (const ent of ents) {
    if (/^(?:.*\.js)$/s.test(ent.name)) out.push(path.join(dir, ent.name))
  }
  return out
}

// ---------------------------------------------------------------------------
// argparse subset
// ---------------------------------------------------------------------------
function usageLine(prog) {
  return `usage: ${prog} [-h] [--repo-root REPO_ROOT] [-o OUT]`
}
function argError(prog, msg) {
  eprint(usageLine(prog))
  eprint(`${prog}: error: ${msg}`)
  process.exit(2)
}
function parseArgs(argv, prog) {
  const args = { repo_root: '.', out: null }
  const pos = []
  let i = 0
  const need = (name) => {
    if (i + 1 >= argv.length) argError(prog, `argument ${name}: expected one argument`)
    return argv[++i]
  }
  for (; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') { print(usageLine(prog)); process.exit(0) }
    else if (a === '--repo-root') args.repo_root = need('--repo-root')
    else if (a.startsWith('--repo-root=')) args.repo_root = a.slice('--repo-root='.length)
    else if (a === '-o' || a === '--out') args.out = need(a)
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length)
    else if (a.startsWith('-o') && a.length > 2) args.out = a.slice(2)
    else if (a.startsWith('-') && a !== '-') argError(prog, `unrecognized arguments: ${a}`)
    else pos.push(a)
  }
  if (pos.length) argError(prog, `unrecognized arguments: ${pos.join(' ')}`)
  return args
}

// ---------------------------------------------------------------------------
// index_calls.py port
// ---------------------------------------------------------------------------
// Function-boundary detectors (re.match => anchored, non-global).
const FN_DEFS = [
  /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
  /^\s*window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/,
  /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function|\()/,
]
// Data-access detectors (re.finditer => global).
const DB_FROM = /\.from\(\s*['"]([\w.]+)['"]\s*\)/g
const RPC = /\.rpc\(\s*['"]([\w.]+)['"]/g
const INVOKE = /functions\.invoke\(\s*['"]([\w-]+)['"]/g
const STORAGE = /storage\.from\(\s*['"]([\w-]+)['"]\s*\)/g
// Operation detectors (re.search => non-global).
const OPS = [
  [/\.insert\s*\(/, 'INSERT'],
  [/\.upsert\s*\(/, 'INSERT/UPDATE'],
  [/\.update\s*\(/, 'UPDATE'],
  [/\.delete\s*\(/, 'DELETE'],
  [/\.select\s*\(/, 'READ'],
]

function opFor(lines, i) {
  const win = lines.slice(i, i + 6).join(' ')
  for (const [pat, op] of OPS) {
    if (pat.test(win)) return op
  }
  return 'READ?'
}

function main() {
  const prog = path.basename(process.argv[1] || 'index_calls.mjs')
  const args = parseArgs(process.argv.slice(2), prog)
  const ROOT = path.resolve(args.repo_root)
  const FILES = ['index.html']
    .concat(globJs(path.join(ROOT, 'js')).sort(cmpCodepoint).map((p) => 'js/' + path.basename(p)))
    .concat(['quote.html', 'variation.html', 'pay.html', 'insurance.html', 'swms.html', 'qa.html'])

  const index = {}        // file -> [ {line, fn, kind, name, op} ]
  const fnmap = {}        // fn name -> [ {file,line,kind,name,op} ]  (defaultdict(list))
  const fndef = {}        // fn name -> "file:line"
  for (const rel of FILES) {
    const f = path.join(ROOT, rel)
    if (!isFile(f)) continue
    const lines = pySplitlines(readTextReplace(f))
    let cur = '(top level)'
    const rows = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const n = i + 1
      for (const pat of FN_DEFS) {
        const m = pat.exec(line)
        if (m) {
          cur = m[1]
          if (!Object.prototype.hasOwnProperty.call(fndef, cur)) fndef[cur] = `${rel}:${n}`
          break
        }
      }
      const hits = []
      for (const m of line.matchAll(DB_FROM)) hits.push(['table', m[1], opFor(lines, i)])
      for (const m of line.matchAll(RPC)) hits.push(['rpc', m[1], 'RPC'])
      for (const m of line.matchAll(INVOKE)) hits.push(['edge', m[1], 'EDGE'])
      for (const m of line.matchAll(STORAGE)) hits.push(['bucket', m[1], 'STORAGE'])
      for (const [kind, name, op] of hits) {
        const row = { file: rel, line: n, fn: cur, kind, name, op }
        rows.push(row)
        if (!Object.prototype.hasOwnProperty.call(fnmap, cur)) fnmap[cur] = []
        fnmap[cur].push(row)
      }
    }
    index[rel] = rows
  }
  const out = { by_file: index, by_fn: fnmap, fn_defs: fndef }
  const p = process.argv.length > 2 ? process.argv[2] : 'calls_index.json'
  fs.writeFileSync(p, dumps(out, 1))
  let tot = 0
  for (const v of Object.values(index)) tot += v.length
  print(`${tot} data-access sites across ${Object.keys(index).length} files; ${Object.keys(fnmap).length} functions touch data; ${Object.keys(fndef).length} fn defs`)
  for (const rel of Object.keys(index)) {
    print(`  ${rel}: ${index[rel].length}`)
  }
}

function isDirectRun() {
  try {
    return process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return import.meta.url === `file://${process.argv[1]}`
  }
}

if (isDirectRun()) {
  main()
}
