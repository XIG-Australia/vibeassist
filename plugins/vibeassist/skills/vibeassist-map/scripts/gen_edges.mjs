#!/usr/bin/env node
// Phase 2 link-edge builder.
//
// Faithful ESM port of gen_edges.py. Behaviour (CLI args, input reading,
// output file, stdout text, exit codes) is byte-for-byte identical to the
// Python, INCLUDING the ordering of the emitted edges array.
//
// The Python iterates `set` objects (set(LIT.findall(...)), the `known` route
// set, etc.) and the first-seen order of those iterations fixes the order of
// the output edges. CPython set-of-str iteration order is hash-table order,
// which is deterministic only under a fixed hash seed. To reproduce it we
// re-implement CPython 3.11's str hash (siphash13) and its set insertion /
// probing / resize algorithm below (validated against PYTHONHASHSEED=0). Run
// the Python side with PYTHONHASHSEED=0 for a deterministic comparison target.
//
// Usage:
//   node scripts/gen_edges.mjs map/_routes.json --repo-root . -o map/_edges.json

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dumps } from './_pyjson.mjs'

// ===========================================================================
// CPython 3.11 str hash (siphash13, PYTHONHASHSEED=0) + set iteration order
// ===========================================================================
const MASK64 = (1n << 64n) - 1n
const rotl = (x, b) => (((x << b) | (x >> (64n - b))) & MASK64)

function siphash13(data) {
  const k0 = 0n, k1 = 0n
  let v0 = (k0 ^ 0x736f6d6570736575n) & MASK64
  let v1 = (k1 ^ 0x646f72616e646f6dn) & MASK64
  let v2 = (k0 ^ 0x6c7967656e657261n) & MASK64
  let v3 = (k1 ^ 0x7465646279746573n) & MASK64
  const len = data.length
  let b = (BigInt(len) << 56n) & MASK64
  const halfRound = (a, bb, c, d, s, t) => {
    a = (a + bb) & MASK64; c = (c + d) & MASK64
    bb = rotl(bb, s) ^ a
    d = rotl(d, t) ^ c
    a = rotl(a, 32n)
    return [a, bb, c, d]
  }
  const singleRound = () => {
    ;[v0, v1, v2, v3] = halfRound(v0, v1, v2, v3, 13n, 16n)
    ;[v2, v1, v0, v3] = halfRound(v2, v1, v0, v3, 17n, 21n)
  }
  const le64 = (o, n) => {
    let r = 0n
    for (let i = 0; i < n; i++) r |= BigInt(data[o + i]) << (8n * BigInt(i))
    return r & MASK64
  }
  let off = 0, sz = len
  while (sz >= 8) {
    const mi = le64(off, 8); off += 8; sz -= 8
    v3 ^= mi; singleRound(); v0 ^= mi
  }
  b |= le64(off, sz)
  v3 ^= b; singleRound(); v0 ^= b
  v2 ^= 0xffn
  singleRound(); singleRound(); singleRound()
  return (v0 ^ v1 ^ v2 ^ v3) & MASK64
}
function toSigned64(u) { return u >= (1n << 63n) ? u - (1n << 64n) : u }

// CPython str hash: hashes the canonical UCS1/2/4 buffer (little-endian),
// kind chosen by the maximum code point. Empty string -> 0; -1 -> -2.
function pyStrHash(s) {
  const cps = Array.from(s).map((c) => c.codePointAt(0))
  if (cps.length === 0) return 0n
  let maxcp = 0
  for (const cp of cps) if (cp > maxcp) maxcp = cp
  const kind = maxcp < 0x100 ? 1 : maxcp < 0x10000 ? 2 : 4
  const bytes = new Uint8Array(cps.length * kind)
  for (let i = 0; i < cps.length; i++) {
    let v = cps[i]
    for (let bb = 0; bb < kind; bb++) { bytes[i * kind + bb] = v & 0xff; v >>= 8 }
  }
  let x = toSigned64(siphash13(bytes))
  if (x === -1n) x = -2n
  return x
}

// Reproduce list(set(items)) for a list of strings under CPython semantics:
// insert in first-occurrence order, place by hash-table probing, then yield in
// final table-slot order. (setobject.c: set_add_entry / set_table_resize.)
const LINEAR_PROBES = 9
const PERTURB_SHIFT = 5n
const PySet_MINSIZE = 8
function pySetOrder(items) {
  let size = PySet_MINSIZE
  let mask = BigInt(size - 1)
  let table = new Array(size).fill(null)
  let fill = 0
  const hcache = new Map()
  const strHash = (s) => { let h = hcache.get(s); if (h === undefined) { h = pyStrHash(s); hcache.set(s, h) } return h }

  function insertClean(tbl, m, key, hash) {
    let perturb = hash & MASK64
    let i = (hash & MASK64) & m
    while (true) {
      if (tbl[Number(i)] === null) { tbl[Number(i)] = { key, hash }; return }
      if (i + BigInt(LINEAR_PROBES) <= m) {
        for (let j = 0; j < LINEAR_PROBES; j++) {
          const idx = Number(i) + 1 + j
          if (tbl[idx] === null) { tbl[idx] = { key, hash }; return }
        }
      }
      perturb >>= PERTURB_SHIFT
      i = (i * 5n + 1n + perturb) & m
    }
  }
  function resize(minused) {
    let newsize = PySet_MINSIZE
    while (newsize <= minused) newsize <<= 1
    const newmask = BigInt(newsize - 1)
    const newtable = new Array(newsize).fill(null)
    for (let s = 0; s < table.length; s++) {
      const e = table[s]
      if (e !== null) insertClean(newtable, newmask, e.key, e.hash)
    }
    table = newtable; size = newsize; mask = newmask
  }
  function add(key) {
    const hash = strHash(key)
    const hu = hash & MASK64
    let perturb = hu
    let i = hu & mask
    while (true) {
      let idx = Number(i)
      const probes = (i + BigInt(LINEAR_PROBES) <= mask) ? LINEAR_PROBES : 0
      for (let p = 0; p <= probes; p++) {
        const e = table[idx]
        if (e === null) {
          table[idx] = { key, hash }
          fill++
          if (BigInt(fill) * 5n < mask * 3n) return
          resize(fill > 50000 ? fill * 2 : fill * 4)
          return
        }
        if (e.key === key) return
        idx++
      }
      perturb >>= PERTURB_SHIFT
      i = (i * 5n + 1n + perturb) & mask
    }
  }
  for (const it of items) add(it)
  const out = []
  for (let s = 0; s < table.length; s++) if (table[s] !== null) out.push(table[s].key)
  return out
}

// ===========================================================================
// pathlib-compatible glob (order-identical to CPython pathlib)
// ===========================================================================
function scandir(dir) {
  // Raw getdents order (matches CPython os.scandir / pathlib). fs.readdirSync
  // SORTS its result, which would reorder the file scan and thus the emitted
  // edges; fs.opendirSync().readSync() preserves the OS directory order.
  const out = []
  let d
  try { d = fs.opendirSync(dir) } catch { return [] }
  try { let e; while ((e = d.readSync()) !== null) out.push(e) } finally { d.closeSync() }
  return out
}
function isDirPath(p) { try { return fs.statSync(p).isDirectory() } catch { return false } }
function pathExists(p) { try { fs.statSync(p); return true } catch { return false } }
function* iterateDirectories(parent) {
  yield parent
  for (const ent of scandir(parent)) {
    if (ent.isDirectory() && !ent.isSymbolicLink()) yield* iterateDirectories(path.join(parent, ent.name))
  }
}
function direntIsDir(dir, ent) {
  if (ent.isSymbolicLink()) { try { return fs.statSync(path.join(dir, ent.name)).isDirectory() } catch { return false } }
  return ent.isDirectory()
}
function isWildcard(pat) { return pat.includes('*') || pat.includes('?') || pat.includes('[') }
function fnmatchTranslate(pat) {
  let res = ''
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i]
    if (c === '*') res += '.*'
    else if (c === '?') res += '.'
    else if ('.^$+{}()|[]\\'.includes(c)) res += '\\' + c
    else res += c
  }
  return new RegExp('^(?:' + res + ')$', 's')
}
function makeSelector(parts) {
  if (parts.length === 0) return function* (p) { yield p }
  const pat = parts[0]
  const rest = parts.slice(1)
  const successor = makeSelector(rest)
  const dironly = rest.length > 0
  if (pat === '**') {
    return function* (parent) {
      const yielded = new Set()
      for (const start of iterateDirectories(parent)) {
        for (const p of successor(start)) if (!yielded.has(p)) { yielded.add(p); yield p }
      }
    }
  } else if (isWildcard(pat)) {
    const re = fnmatchTranslate(pat)
    return function* (parent) {
      for (const ent of scandir(parent)) {
        if (dironly && !direntIsDir(parent, ent)) continue
        if (re.test(ent.name)) yield* successor(path.join(parent, ent.name))
      }
    }
  } else {
    return function* (parent) {
      const child = path.join(parent, pat)
      const ok = dironly ? isDirPath(child) : pathExists(child)
      if (ok) yield* successor(child)
    }
  }
}
function glob(base, pattern) { return [...makeSelector(pattern.split('/'))(base)] }

// ===========================================================================
// misc helpers
// ===========================================================================
function print(s) { fs.writeSync(1, s + '\n') }
function eprint(s) { fs.writeSync(2, s + '\n') }
function readTextReplace(p) { return fs.readFileSync(p).toString('utf8') }
function relTo(repo, p) { return path.relative(repo, p).split(path.sep).join('/') }
function hasNodeModules(absPath) { return absPath.split(path.sep).includes('node_modules') }
function stemOf(name) { const i = name.lastIndexOf('.'); return i > 0 && i < name.length - 1 ? name.slice(0, i) : name }
// Python str default sort = by code point.
function cmpCodepoint(a, b) {
  const ai = Array.from(a), bi = Array.from(b)
  const n = Math.min(ai.length, bi.length)
  for (let i = 0; i < n; i++) { const x = ai[i].codePointAt(0), y = bi[i].codePointAt(0); if (x !== y) return x < y ? -1 : 1 }
  return ai.length - bi.length
}
// str(pathlib.PurePosixPath(s)) normalisation.
function pyPosixStr(p) {
  const isAbs = p.startsWith('/')
  const segs = p.split('/').filter((s) => s !== '' && s !== '.')
  let s = segs.join('/')
  if (isAbs) s = '/' + s
  if (s === '') s = isAbs ? '/' : '.'
  return s
}
function findall(re, text) { const out = []; for (const m of text.matchAll(re)) out.push(m[1]); return out }

// ===========================================================================
// gen_edges.py port
// ===========================================================================
const LIT = /(?:to|href)\s*[:=]\s*[{(]?\s*["'`](\/[A-Za-z0-9_\-.\/$:\[\]{}]*)["'`]/g
const TEMPLATE = /(?:to|href)\s*[:=]\s*[{(]?\s*`(\/[^`$]*)\$\{/g
const REDIR = /redirect\(\{\s*to:\s*["'`](\/[^"'`]*)/g

function canon(p) {
  p = p.replace(/\$\{[^}]+\}/g, ':p')
  p = p.replace(/\$\w+/g, ':p')
  p = p.replace(/\[\w+\]/g, ':p')
  p = p.replace(/:\w+/g, ':p')
  const t = p.replace(/\/+$/g, '')
  return t || '/'
}

function usageLine(prog) {
  return `usage: ${prog} [-h] [--repo-root REPO_ROOT] [--src-dir SRC_DIR] [-o OUT]\n` +
    `${' '.repeat(('usage: ' + prog + ' ').length)}routes_json`
}
function helpText(prog) {
  return [
    usageLine(prog),
    '',
    'positional arguments:',
    '  routes_json',
    '',
    'options:',
    '  -h, --help            show this help message and exit',
    '  --repo-root REPO_ROOT',
    '  --src-dir SRC_DIR',
    '  -o OUT, --out OUT',
  ].join('\n')
}
function argError(prog, msg) { eprint(usageLine(prog)); eprint(`${prog}: error: ${msg}`); process.exit(2) }

function parseArgs(argv, prog) {
  const args = { routes_json: undefined, repo_root: '.', src_dir: 'src', out: 'map/_edges.json' }
  const positionals = []
  let i = 0
  const need = (name) => { if (i + 1 >= argv.length) argError(prog, `argument ${name}: expected one argument`); return argv[++i] }
  for (; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') { print(helpText(prog)); process.exit(0) }
    else if (a === '--repo-root') args.repo_root = need('--repo-root')
    else if (a.startsWith('--repo-root=')) args.repo_root = a.slice('--repo-root='.length)
    else if (a === '--src-dir') args.src_dir = need('--src-dir')
    else if (a.startsWith('--src-dir=')) args.src_dir = a.slice('--src-dir='.length)
    else if (a === '-o' || a === '--out') args.out = need(a)
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length)
    else if (a.startsWith('-o') && a.length > 2) args.out = a.slice(2)
    else if (a.startsWith('-') && a !== '-') argError(prog, `unrecognized arguments: ${a}`)
    else positionals.push(a)
  }
  if (positionals.length === 0) argError(prog, 'the following arguments are required: routes_json')
  if (positionals.length > 1) argError(prog, `unrecognized arguments: ${positionals.slice(1).join(' ')}`)
  args.routes_json = positionals[0]
  return args
}

function main() {
  const prog = path.basename(process.argv[1] || 'gen_edges.mjs')
  const args = parseArgs(process.argv.slice(2), prog)
  const repo = path.resolve(args.repo_root)
  let routes = JSON.parse(readTextReplace(args.routes_json))
  if (routes && typeof routes === 'object' && !Array.isArray(routes)) {
    routes = Object.prototype.hasOwnProperty.call(routes, 'routes') ? routes.routes : []
  }
  // known = {r["path"] for r in routes}, iterated in CPython set order.
  const knownOrdered = pySetOrder(routes.map((r) => r.path))
  const canon_known = new Map()
  for (const k of knownOrdered) {
    const c = canon(k)
    if (!canon_known.has(c)) canon_known.set(c, [])
    canon_known.get(c).push(k)
  }
  const route_by_file = new Map()
  for (const r of routes) route_by_file.set(r.source_file, r)

  const edges = []
  const seen = new Set()
  const add = (src, dst, trig) => {
    const key = src + '\x00' + dst + '\x00' + trig
    if (!seen.has(key)) { seen.add(key); edges.push({ from: src, to: dst, trigger: trig }) }
  }

  const scan = []
  const srcBase = args.src_dir.startsWith('/') ? args.src_dir : path.join(repo, args.src_dir)
  for (const pat of ['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js']) {
    for (const p of glob(srcBase, pat)) if (!hasNodeModules(p)) scan.push(p)
  }
  for (const f of scan) {
    const rel = relTo(repo, f)
    let txt
    try { txt = readTextReplace(f) } catch { continue }
    const r = route_by_file.has(rel) ? route_by_file.get(rel) : undefined
    const src_label = r ? r.path : '«global navigation»'
    const trig = r ? 'link on the page' : `shared component (${stemOf(path.basename(f))})`
    for (const m of pySetOrder(findall(LIT, txt))) {
      for (const real of (canon_known.get(canon(m)) || [])) {
        if (r && real === r.path) continue
        add(src_label, real, trig)
      }
    }
    // computed rails: fixed prefix before the first ${
    for (const pref of pySetOrder(findall(TEMPLATE, txt))) {
      const cp = canon(pref).replace(/\/+$/g, '')
      const hits = knownOrdered.filter((k) => canon(k).startsWith(cp + '/') || canon(k) === cp)
      if (cp !== '' && cp !== '/' && hits.length > 0 && hits.length <= 40) {
        for (const real of hits) add(src_label, real, (r ? 'rail on the page, built from a list' : 'rail built from a list'))
      }
    }
    if (r) {
      for (const m of pySetOrder(findall(REDIR, txt))) {
        for (const real of (canon_known.get(canon(m)) || [])) add(r.path, real, 'automatic redirect')
      }
    }
  }

  const outStr = pyPosixStr(args.out)
  const parent = path.dirname(args.out) || '.'
  fs.mkdirSync(parent, { recursive: true })
  fs.writeFileSync(args.out, dumps(edges, 2))
  const inbound = new Set(edges.map((e) => e.to))
  const no_in = knownOrdered.filter((p) => {
    if (inbound.has(p)) return false
    const rr = routes.find((r) => r.path === p)
    return rr && rr.audience === 'user' && p !== '/'
  }).sort(cmpCodepoint)
  print(`${edges.length} edges -> ${outStr}`)
  if (no_in.length) {
    print("NO INBOUND (a claim, not an observation - check chrome, config arrays, computed rails, and 'reached from outside'):")
    for (const p of no_in) print('  ' + ' ' + p)
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
