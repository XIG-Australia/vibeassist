#!/usr/bin/env node
// Vanilla-JS strategy (no modules, no router) - faithful ESM port of nav_edges.py.
//
// Behaviour (CLI args, input reading, stdout, exit codes) is byte-for-byte
// identical to the Python. FILES defaults to index.html + sorted js/*.js.
// Emits nav edges to stdout only; the -o/--out flag is parsed but (as in the
// Python) never used.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Python-ism helpers
// ---------------------------------------------------------------------------
function print(s) { fs.writeSync(1, s + '\n') }
function eprint(s) { fs.writeSync(2, s + '\n') }

// pathlib read_text(encoding='utf-8', errors='replace'). Throws on missing file
// exactly like the Python (nav_edges.py does NOT guard is_file()).
function readTextReplace(p) {
  return fs.readFileSync(p).toString('utf8')
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

// pathlib Path.glob('*.js') over one directory (non-recursive). Returns full
// paths joined onto `dir` for entries whose name matches. Missing dir -> [].
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
// nav_edges.py port
// ---------------------------------------------------------------------------
// Function-boundary detectors (re.match => anchored, non-global).
const FN = [
  /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
  /^\s*window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/,
  /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function|\()/,
]
// findall detectors (global). \\? = optional literal backslash, as in Python.
const SHOW = /showPanel\(\s*\\?['"]([\w-]+)/g
const EST = /openEstimate\(\)/g
const WTAB = /bmwSetTab\(\s*\\?['"](\w+)/g

function main() {
  const prog = path.basename(process.argv[1] || 'nav_edges.mjs')
  const args = parseArgs(process.argv.slice(2), prog) // out is parsed but unused, as in the Python

  const ROOT = path.resolve(args.repo_root)
  const FILES = ['index.html'].concat(
    globJs(path.join(ROOT, 'js'))
      .sort(cmpCodepoint)
      .map((p) => 'js/' + path.basename(p))
  )
  for (const rel of FILES) {
    const lines = pySplitlines(readTextReplace(path.join(ROOT, rel)))
    let cur = '(top)'
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      for (const p of FN) {
        const m = p.exec(l)
        if (m) { cur = m[1]; break }
      }
      const outs = []
      for (const m of l.matchAll(SHOW)) outs.push(m[1])
      const nEst = [...l.matchAll(EST)].length
      for (let k = 0; k < nEst; k++) outs.push('estimate')
      for (const m of l.matchAll(WTAB)) outs.push('field:' + m[1])
      for (const t of outs) {
        print(`${rel}:${i + 1}\t${cur}\t-> ${t}`)
      }
    }
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
