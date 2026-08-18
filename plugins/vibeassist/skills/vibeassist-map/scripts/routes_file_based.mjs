#!/usr/bin/env node
// Faithful ESM port of routes_file_based.py — byte-for-byte parity with the
// Python CLI (argv, input reading, output file, stdout, exit codes).
// Translation, not redesign. See the .py for the domain documentation.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dumps } from './_pyjson.mjs'

// --- regexes translated from Python `re` ------------------------------------
const REDIRECT_TO = /(?:throw\s+)?redirect\(\s*\{\s*to:\s*["'`]([^"'`]+)/
const HAS_COMPONENT = /component\s*:\s*\w+|export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{[^}]*return\s*\(?\s*<|=>\s*\(?\s*</
// MACHINE_NAMES is kept as documentation of the naming conventions; the
// structural test covers every case it used to catch. (Unused in Python too.)
// eslint-disable-next-line no-unused-vars
const MACHINE_NAMES = /\.well-known|sitemap|robots|webhook|callback|\bfeed\b|healthz?/i

const EXT_RE = /\.(tsx|ts|jsx|js)$/
const INDEX_RE = /\.index\.(tsx|ts|jsx|js)$/

// --- small helpers replicating Python-isms ----------------------------------

// Python str.replace replaces ALL occurrences (JS String.replace is first-only).
function replaceAll(s, find, repl) {
  return s.split(find).join(repl)
}

// pathlib.PurePosixPath(str(x)) normalization used by str(Path(...)):
// collapse repeated '/', drop '.' and empty segments, keep '..', keep a
// single leading '/'. Matches str(pathlib.Path("./a//b/")) -> "a/b".
function posixPathStr(p) {
  if (p === '') return '.'
  const isAbs = p.startsWith('/')
  // pathlib treats a leading '//' specially, but that never occurs here.
  const parts = p.split('/').filter((seg) => seg !== '' && seg !== '.')
  const joined = parts.join('/')
  if (isAbs) return '/' + joined
  return joined === '' ? '.' : joined
}

// pathlib PurePath.suffix
function suffixOf(name) {
  const i = name.lastIndexOf('.')
  if (i > 0 && i < name.length - 1) return name.slice(i)
  return ''
}

// Python repr() of a str (for dict-repr keys). Audience values are simple, but
// keep it faithful for safety.
function pyStrRepr(s) {
  const hasSingle = s.includes("'")
  const hasDouble = s.includes('"')
  const quote = hasSingle && !hasDouble ? '"' : "'"
  let out = quote
  for (const ch of s) {
    const cp = ch.codePointAt(0)
    if (ch === '\\') out += '\\\\'
    else if (ch === quote) out += '\\' + quote
    else if (ch === '\n') out += '\\n'
    else if (ch === '\r') out += '\\r'
    else if (ch === '\t') out += '\\t'
    else if (cp < 0x20 || cp === 0x7f) out += '\\x' + cp.toString(16).padStart(2, '0')
    else out += ch
  }
  return out + quote
}

// repr of dict(Counter(...)) — insertion order = first-encounter order.
function pyDictRepr(entries) {
  const inner = entries.map(([k, v]) => `${pyStrRepr(k)}: ${v}`).join(', ')
  return '{' + inner + '}'
}

// --- to_path (translated verbatim) ------------------------------------------
function toPath(relAfterRoutes) {
  let s = relAfterRoutes.replace(EXT_RE, '')
  s = replaceAll(s, '[.]', '\x00') // protect literal dots
  let parts = []
  for (const d of s.split('/')) {
    for (const seg of d.split('.')) parts.push(seg)
  }
  parts = parts.map((p) => replaceAll(p, '\x00', '.'))
  const segs = []
  for (let p of parts) {
    if (p.startsWith('(') && p.endsWith(')')) continue // Expo group segment
    if (p.startsWith('[...') && p.endsWith(']')) {
      p = '*' // catch-all
    } else if (p.startsWith('[') && p.endsWith(']')) {
      p = ':' + p.slice(1, -1) // [id] -> :id
    }
    if (p.startsWith('_') || p === '__root') continue // pathless layout segment
    if (p.endsWith('_') && p.length > 1) p = p.slice(0, -1) // trailing underscore un-nests
    segs.push(p)
  }
  if (segs.length && segs[segs.length - 1] === 'index') segs.pop()
  return segs.length ? '/' + segs.join('/') : '/'
}

// --- filesystem: replicate rdir.rglob("*") -> is_file/is_dir ----------------
// pathlib rglob includes dotfiles and hidden dirs; sorted() over Paths sorts by
// the full path string (PurePosixPath comparison). We gather all files/dirs and
// sort files by absolute path string to match.
function walk(root) {
  const files = []
  const dirs = []
  function recurse(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      let isDir = ent.isDirectory()
      let isFile = ent.isFile()
      if (ent.isSymbolicLink()) {
        try {
          const st = fs.statSync(full)
          isDir = st.isDirectory()
          isFile = st.isFile()
        } catch {
          isDir = false
          isFile = false
        }
      }
      if (isDir) {
        dirs.push(full)
        recurse(full)
      } else if (isFile) {
        files.push(full)
      }
    }
  }
  recurse(root)
  return { files, dirs }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

// --- arg parsing (argparse subset) ------------------------------------------
function parseArgs(argv) {
  const args = { repo_root: '.', routes_dir: 'src/routes', out: 'map/_routes.json' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const takeVal = (inline) => (inline !== undefined ? inline : argv[++i])
    if (a === '--repo-root' || a.startsWith('--repo-root=')) {
      args.repo_root = takeVal(a.includes('=') ? a.slice(a.indexOf('=') + 1) : undefined)
    } else if (a === '--routes-dir' || a.startsWith('--routes-dir=')) {
      args.routes_dir = takeVal(a.includes('=') ? a.slice(a.indexOf('=') + 1) : undefined)
    } else if (a === '-o' || a === '--out' || a.startsWith('--out=')) {
      args.out = takeVal(a.includes('=') ? a.slice(a.indexOf('=') + 1) : undefined)
    } else if (a.startsWith('-o') && a.length > 2 && !a.startsWith('--')) {
      args.out = a.slice(2)
    }
  }
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const repo = path.resolve(args.repo_root)
  let rdir = path.resolve(repo, args.routes_dir)
  if (!isDir(rdir) && args.routes_dir === 'src/routes' && isDir(path.resolve(repo, 'app'))) {
    rdir = path.resolve(repo, 'app') // Expo Router / app-dir convention
  }
  if (!isDir(rdir)) {
    process.stderr.write(`routes dir not found: ${rdir} (pass --routes-dir)\n`)
    process.exit(1)
  }

  const walked = walk(rdir)
  const files = walked.files
    .filter((p) => ['.tsx', '.ts', '.jsx', '.js'].includes(suffixOf(path.basename(p))))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const relTo = (base, p) => path.relative(base, p).split(path.sep).join('/')

  const stems = new Set()
  const dirs = new Set()
  for (const f of files) {
    const rel = relTo(rdir, f)
    stems.add(rel.replace(EXT_RE, ''))
  }
  for (const d of walked.dirs) {
    dirs.add(relTo(rdir, d))
  }

  const rows = []
  for (const f of files) {
    const rel_r = relTo(rdir, f)
    const rel = relTo(repo, f)
    const stem = rel_r.replace(EXT_RE, '')
    const segs = replaceAll(stem, '[.]', '\x00').split('/')
    const flat = []
    for (const part of segs) for (const s of part.split('.')) flat.push(s)

    // 1. pure layout: every segment pathless -> not a route at all
    if (
      flat.every(
        (s) => s.startsWith('_') || s === '__root' || (s.startsWith('(') && s.endsWith(')'))
      )
    ) {
      continue
    }
    if (flat[flat.length - 1] === '_layout') continue // Expo layout file, never a route

    const text = fs.readFileSync(f, 'utf-8')

    // 2. layout-with-children
    const has_children =
      Array.from(stems).some((s) => s !== stem && s.startsWith(stem + '.')) || dirs.has(stem)
    const renders_own = HAS_COMPONENT.test(text)
    const is_redirect_stub = REDIRECT_TO.test(text) && !renders_own
    if (has_children && !renders_own && !is_redirect_stub) continue // container only

    const p = toPath(rel_r)
    const not_found = flat[flat.length - 1] === '+not-found'
    const is_api = flat[flat.length - 1].endsWith('+api')
    const rm = REDIRECT_TO.exec(text)
    let audience
    let redirect_to
    if (rm && !renders_own) {
      audience = 'redirect'
      redirect_to = rm[1]
    } else if (is_api || (!renders_own && !not_found)) {
      audience = 'machine'
      redirect_to = null
    } else {
      audience = 'user'
      redirect_to = null
    }

    const auth_wrappers = flat.filter((s) => s.startsWith('_') && s.toLowerCase().includes('auth'))
    const layout_chain = flat.slice(0, -1).filter((s) => s.startsWith('_') || s === '__root')
    const row = {
      path: p,
      source_file: rel,
      layout_chain: layout_chain,
      auth_required: auth_wrappers.length ? true : null,
      audience: audience,
    }
    if (redirect_to) row.redirect_to = redirect_to
    if (not_found) row.not_found = true
    rows.push(row)
  }

  // ONE ROW PER PATH — index file wins.
  const by_path = new Map()
  for (const r of rows) {
    if (!by_path.has(r.path) || INDEX_RE.test(r.source_file)) {
      by_path.set(r.path, r)
    }
  }
  let finalRows = Array.from(by_path.values())

  // rows.sort(key=lambda r: (r["audience"] != "user", r["path"])) — stable.
  finalRows = finalRows
    .map((r, i) => [r, i])
    .sort((A, B) => {
      const a = A[0]
      const b = B[0]
      const ka = a.audience !== 'user' ? 1 : 0
      const kb = b.audience !== 'user' ? 1 : 0
      if (ka !== kb) return ka - kb
      if (a.path < b.path) return -1
      if (a.path > b.path) return 1
      return A[1] - B[1] // stable tie-break
    })
    .map((x) => x[0])

  const out = args.out
  const outDir = path.dirname(out) || '.'
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(out, dumps(finalRows, 2))

  // print(dict(Counter(r["audience"] for r in rows)), "->", out)
  const counter = new Map()
  for (const r of finalRows) counter.set(r.audience, (counter.get(r.audience) || 0) + 1)
  const dictRepr = pyDictRepr(Array.from(counter.entries()))
  process.stdout.write(`${dictRepr} -> ${posixPathStr(out)}\n`)
}

// Guard: run only when executed directly.
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main()
}

export { toPath, main }
