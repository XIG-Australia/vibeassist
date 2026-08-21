#!/usr/bin/env node
// Evidence harvester for vibeassist-map (run once before Phase 3).
//
// Faithful ESM port of harvest.py. Behaviour (CLI args, input reading, output
// file, stdout text, exit codes) is byte-for-byte identical to the Python. The
// three helpers load_aliases / resolve_import / route_slug are exported so that
// routes_react_router.mjs can import them exactly as the Python module does.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dumps } from './_pyjson.mjs'

// ---------------------------------------------------------------------------
// Python-ism helpers
// ---------------------------------------------------------------------------

// CPython str whitespace set (Py_UNICODE_ISSPACE), used by str.strip()/split().
const PY_WS = '\\t\\n\\x0b\\x0c\\r\\x1c\\x1d\\x1e\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000'
const STRIP_L = new RegExp('^[' + PY_WS + ']+')
const STRIP_R = new RegExp('[' + PY_WS + ']+$')
const WS_SPLIT = new RegExp('[' + PY_WS + ']+')

function pyStrip(s) {
  return s.replace(STRIP_L, '').replace(STRIP_R, '')
}
function stripChars(s, chars) {
  const set = new Set(chars)
  let i = 0, j = s.length
  while (i < j && set.has(s[i])) i++
  while (j > i && set.has(s[j - 1])) j--
  return s.slice(i, j)
}
function pySplitWS(s) {
  return s.split(WS_SPLIT).filter((x) => x !== '')
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
function countNewlines(s, pos) {
  let c = 0
  for (let i = 0; i < pos && i < s.length; i++) if (s.charCodeAt(i) === 10) c++
  return c
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
function sortedCP(iter) {
  return Array.from(iter).sort(cmpCodepoint)
}

// finditer(re, text): array of match objects (re must be global). matchAll
// clones the regex so lastIndex state is never shared across calls.
function finditer(re, text) {
  return [...text.matchAll(re)]
}
function spanOf(m) {
  return [m.index, m.index + m[0].length]
}
function findallGroup1(re, text) {
  const out = []
  for (const m of text.matchAll(re)) out.push(m[1])
  return out
}

// ---------------------------------------------------------------------------
// Filesystem helpers (pathlib semantics on string paths)
// ---------------------------------------------------------------------------
function pyResolve(...args) {
  return path.resolve(...args)
}
function readTextReplace(p) {
  // pathlib read_text(encoding='utf-8', errors='replace')
  return fs.readFileSync(p).toString('utf8')
}
function isFile(p) {
  try { return fs.statSync(p).isFile() } catch { return false }
}
function isDirPath(p) {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}
function pathExists(p) {
  try { fs.statSync(p); return true } catch { return false }
}
function relTo(repo, p) {
  return path.relative(repo, p).split(path.sep).join('/')
}
function hasNodeModules(absPath) {
  // Split on the OS separator too: glob() builds these with path.join, so on
  // Windows they carry backslashes and a '/'-only split never sees the segment.
  return absPath.split(path.sep).join('/').split('/').includes('node_modules')
}
function baseName(p) {
  return path.basename(p)
}

// --- pathlib-compatible glob ------------------------------------------------
function scandir(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
}
function direntIsDir(dir, ent) {
  if (ent.isSymbolicLink()) {
    try { return fs.statSync(path.join(dir, ent.name)).isDirectory() } catch { return false }
  }
  return ent.isDirectory()
}
function* iterateDirectories(parent) {
  yield parent
  for (const ent of scandir(parent)) {
    if (ent.isDirectory() && !ent.isSymbolicLink()) {
      yield* iterateDirectories(path.join(parent, ent.name))
    }
  }
}
function isWildcard(pat) {
  return pat.includes('*') || pat.includes('?') || pat.includes('[')
}
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
  if (parts.length === 0) {
    return function* (p) { yield p }
  }
  const pat = parts[0]
  const rest = parts.slice(1)
  const successor = makeSelector(rest)
  const dironly = rest.length > 0
  if (pat === '**') {
    return function* (parent) {
      const yielded = new Set()
      for (const start of iterateDirectories(parent)) {
        for (const p of successor(start)) {
          if (!yielded.has(p)) { yielded.add(p); yield p }
        }
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
function glob(base, pattern) {
  return [...makeSelector(pattern.split('/'))(base)]
}

// ===========================================================================
// harvest.py port
// ===========================================================================

export const IMPORT_SPECS = [
  /^\s*import\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/gm,
  /^\s*export\s+(?:type\s+)?[^'"]*?\s+from\s+['"]([^'"]+)['"]/gm,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
]

// Strip JSONC comments without ever looking inside a string. A path alias like
// "#/*": ["./src/*"] carries /* and // as data, so a naive block-comment regex
// would eat from there to the next */ and destroy the JSON.
function stripJsonc(raw) {
  let out = '', inStr = false, quote = '', esc = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i], next = raw[i + 1]
    if (inStr) {
      out += ch
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === quote) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") { inStr = true; quote = ch; out += ch; continue }
    if (ch === '/' && next === '/') { while (i < raw.length && raw[i] !== '\n') i++; out += '\n'; continue }
    if (ch === '/' && next === '*') { i += 2; while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) i++; i++; continue }
    out += ch
  }
  return out.replace(/,\s*([}\]])/g, '$1')
}

export function load_aliases(repo) {
  const aliases = []
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const cfg = path.join(repo, name)
    if (!isFile(cfg)) continue
    let raw = readTextReplace(cfg)
    raw = stripJsonc(raw)
    let data
    try { data = JSON.parse(raw) } catch { continue }
    const opts = Object.prototype.hasOwnProperty.call(data, 'compilerOptions') ? data.compilerOptions : {}
    const baseUrl = Object.prototype.hasOwnProperty.call(opts, 'baseUrl') ? opts.baseUrl : '.'
    const paths = Object.prototype.hasOwnProperty.call(opts, 'paths') ? opts.paths : {}
    for (const [pat, targets] of Object.entries(paths)) {
      const prefix = pat.endsWith('*') ? pat.slice(0, -1) : pat
      const dirs = targets.map((t) => pyResolve(repo, baseUrl, t.endsWith('*') ? t.slice(0, -1) : t))
      aliases.push([prefix, dirs])
    }
  }
  if (aliases.length === 0) {
    aliases.push(['@/', [pyResolve(repo, 'src')]])
    aliases.push(['~/', [pyResolve(repo, 'src')]])
  }
  // longest prefix first; stable sort preserves insertion order among ties.
  aliases.sort((a, b) => b[0].length - a[0].length)
  return aliases
}

export function find_imports(text) {
  const specs = []
  for (const pat of IMPORT_SPECS) specs.push(...findallGroup1(pat, text))
  return specs
}

const INTERACTIVE = /onClick=|onSubmit=|onChange=|type=["']submit["']|<button\b|<form\b|<input\b|<select\b|<textarea\b|role=["']button["']/
const SERVER_FN_STRICT = /export\s+const\s+(\w+)\s*=\s*createServerFn|export\s+async\s+function\s+(\w+)/
const SERVER_FN_USE_SERVER = /export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*=/

const STORAGE_FROM = /\.storage\s*\.\s*from\(\s*['"]([\w.-]+)['"]/g
const DB_FROM = /\.from\(\s*['"]([\w.]+)['"]\s*\)/g
const DB_FROM_IDENT = /\.from\(\s*([A-Za-z_]\w*)\s*\)/g
const RPC_CALL = /\.rpc\(\s*['"]([\w.]+)['"]/g
const FN_INVOKE = /functions\s*\.\s*invoke\(\s*['"]([\w.-]+)['"]/g
const OP_HINTS = [
  [/\.insert\s*\(/, 'INSERT'],
  [/\.upsert\s*\(/, 'INSERT/UPDATE'],
  [/\.update\s*\(/, 'UPDATE'],
  [/\.delete\s*\(/, 'DELETE'],
  [/\.select\s*\(/, 'READ'],
]
const RAW_SQL = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+/i
const PRISMA_CALL = /\b(?:prisma|db|client)\.(\w+)\.(findMany|findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|count|aggregate|groupBy|create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\b/g
export const PRISMA_READ_OPS = new Set(['findMany', 'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'])
const DRIZZLE_WRITE = /\bdb\.(insert|update|delete)\(\s*([A-Za-z_]\w*)\s*\)/g
const FIRE_COLLECTION = /\b(?:collection|collectionGroup|doc)\(\s*\w+\s*,\s*['"]([\w/-]+)['"]/g
const FIRE_OPS = [
  [/\b(?:setDoc|addDoc)\b/, 'INSERT'],
  [/\bupdateDoc\b/, 'UPDATE'],
  [/\bdeleteDoc\b/, 'DELETE'],
  [/\b(?:getDocs?|onSnapshot)\b/, 'READ'],
]
const MONGO_CALL = /\b([A-Z]\w+)\.(find|findOne|findById|aggregate|countDocuments|create|insertMany|updateOne|updateMany|findByIdAndUpdate|deleteOne|deleteMany|findByIdAndDelete)\b/g
export const MONGO_READ_OPS = new Set(['find', 'findOne', 'findById', 'aggregate', 'countDocuments'])

export function read_json_tolerant(p) {
  let raw = readTextReplace(p)
  raw = stripJsonc(raw)
  try { return JSON.parse(raw) } catch { return {} }
}

function getOr(obj, key, def) {
  if (obj && Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
  return def
}

export function detect_data_layers(repo) {
  const layers = []
  const deps = {}
  const pkg = path.join(repo, 'package.json')
  if (isFile(pkg)) {
    const data = read_json_tolerant(pkg)
    for (const k of ['dependencies', 'devDependencies']) Object.assign(deps, getOr(data, k, {}))
  }
  let prisma_schemas = glob(repo, 'prisma/schema.prisma').concat(glob(repo, '**/schema.prisma'))
  prisma_schemas = prisma_schemas.filter((p) => !hasNodeModules(p)).slice(0, 3)
  if ('@supabase/supabase-js' in deps) layers.push('supabase')
  if (prisma_schemas.length || '@prisma/client' in deps || 'prisma' in deps) layers.push('prisma')
  if ('drizzle-orm' in deps) layers.push('drizzle')
  if ('firebase' in deps || 'firebase-admin' in deps) layers.push('firestore')
  if ('mongoose' in deps) layers.push('mongo')
  if (['knex', 'pg', 'postgres', 'mysql2', 'better-sqlite3', 'sqlite3'].some((d) => d in deps)) layers.push('sql')
  if (layers.length === 0) {
    const scan = glob(repo, '*.html')
      .concat(glob(repo, 'src/**/*.ts').slice(0, 50))
      .concat(glob(repo, 'src/**/*.js').slice(0, 50))
    for (const f of scan) {
      let t
      try { t = readTextReplace(f) } catch { continue }
      if (t.includes('supabase') && (t.includes('createClient') || t.includes('.from('))) {
        layers.push('supabase')
        break
      }
    }
  }
  return [layers, prisma_schemas]
}

export function read_schema_tables(repo, layers, prisma_schemas) {
  const tables = new Set()
  const drizzle_map = new Map()
  const prisma_map = new Map()
  if (layers.includes('prisma')) {
    const model = /^model\s+(\w+)\s*\{/gm
    const mapped = /@@map\(\s*['"]([\w.]+)['"]\s*\)/
    for (const sf of prisma_schemas) {
      const text = readTextReplace(sf)
      for (const m of finditer(model, text)) {
        const name = m[1]
        const end = m.index + m[0].length
        const close = text.indexOf('}', end)
        const block = close === -1 ? text.slice(end, -1) : text.slice(end, close)
        const mm = mapped.exec(block)
        const table = mm ? mm[1] : name
        tables.add(table)
        prisma_map.set(name.toLowerCase(), table)
      }
    }
  }
  if (layers.includes('drizzle')) {
    const decl = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\(\s*['"]([\w.]+)['"]/g
    let cands = glob(repo, '**/*.ts').filter((p) => !hasNodeModules(p) && baseName(p).toLowerCase().includes('schema'))
    cands = cands.concat(glob(repo, '**/db/schema/**/*.ts').filter((p) => !hasNodeModules(p)))
    for (const sf of cands.slice(0, 40)) {
      const text = readTextReplace(sf)
      for (const m of finditer(decl, text)) {
        drizzle_map.set(m[1], m[2])
        tables.add(m[2])
      }
    }
  }
  if (layers.includes('supabase')) {
    const ct = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi
    for (const sf of glob(repo, 'supabase/migrations/*.sql').slice(0, 200)) {
      for (const m of finditer(ct, readTextReplace(sf))) tables.add(m[1])
    }
  }
  return [tables, drizzle_map, prisma_map]
}

export const EXTS = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']

function repoContains(repo, c) {
  // Compare on one separator. On Windows the candidate carries backslashes but
  // repo + '/' does not, so a raw startsWith reads every file as outside.
  const norm = (s) => s.split(path.sep).join('/')
  const r = norm(repo), cc = norm(c)
  if (cc === r) return true
  return cc.startsWith(r.endsWith('/') ? r : r + '/')
}

export function resolve_import(base, spec, repo, aliases) {
  let targets = []
  if (spec.startsWith('.')) {
    targets = [pyResolve(path.dirname(base), spec)]
  } else {
    let matched = false
    for (const [prefix, dirs] of aliases) {
      if (spec.startsWith(prefix)) {
        const rest = spec.slice(prefix.length)
        targets = dirs.map((d) => pyResolve(d, rest))
        matched = true
        break
      }
    }
    if (!matched) return null // bare package import (node_modules) - skip
  }
  for (const target of targets) {
    const cands = path.extname(target) ? [target] : []
    for (const e of EXTS) cands.push(target + e)
    for (const c of cands) {
      if (isFile(c) && repoContains(repo, c)) return c
    }
  }
  return null
}

export function collect_files(entry_file, repo, aliases, depth = 2) {
  const seen = new Set([entry_file])
  let frontier = [entry_file]
  for (let d = 0; d < depth; d++) {
    const nxt = []
    for (const f of frontier) {
      let text
      try { text = readTextReplace(f) } catch { continue }
      for (const spec of find_imports(text)) {
        const r = resolve_import(f, spec, repo, aliases)
        if (r && !seen.has(r)) { seen.add(r); nxt.push(r) }
      }
    }
    frontier = nxt
  }
  return sortedCP(seen)
}

export function tag_op(lines, i) {
  const window = lines.slice(i, i + 5).join(' ')
  for (const [pat, op] of OP_HINTS) if (pat.test(window)) return op
  return 'READ?'
}

export function harvest_file(f, repo, layers = ['supabase', 'sql'], drizzle_map = null, prisma_map = null) {
  const rel = relTo(repo, f)
  drizzle_map = drizzle_map || new Map()
  prisma_map = prisma_map || new Map()
  const out = { interactive: [], server_fns: [], db: [], raw_sql: [], storage: [], rpc: [], edge_fns: [], feedback: [], live_sync: [], validation: [], auth: [], paid_gates: [], outbound: [], state_literals: [] }
  let text
  try { text = readTextReplace(f) } catch { return out }
  const lines = pySplitlines(text)
  const head = text.slice(0, 400)
  const use_server = head.includes('"use server"') || head.includes("'use server'")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const n = i + 1
    if (INTERACTIVE.test(line)) out.interactive.push({ file: rel, line: n, snippet: pyStrip(line).slice(0, 160) })
    if (FEEDBACK_CALL.test(line) || ERROR_HOOK.test(line)) out.feedback.push({ file: rel, line: n, snippet: pyStrip(line).slice(0, 160) })
    if (SYNC_LIVE.test(line)) out.live_sync.push({ file: rel, line: n, snippet: pyStrip(line).slice(0, 160) })
    if (VALIDATION.test(line)) out.validation.push({ file: rel, line: n, snippet: pyStrip(line).slice(0, 160) })
    if (AUTH_CALL.test(line)) out.auth.push({ file: rel, line: n, snippet: pyStrip(line).slice(0, 160) })
    if (PAID_GATE.test(line)) out.paid_gates.push({ file: rel, line: n, snippet: pyStrip(line).slice(0, 160) })
    if (OUTBOUND_SEND.test(line)) out.outbound.push({ file: rel, line: n, snippet: pyStrip(line).slice(0, 160) })
    for (const m of finditer(STATE_LITERAL, line)) out.state_literals.push({ file: rel, line: n, value: m[1] })
    let name = null
    const m = SERVER_FN_STRICT.exec(line)
    if (m) {
      name = m[1] || m[2]
    } else if (use_server) {
      const m2 = SERVER_FN_USE_SERVER.exec(line)
      if (m2) name = m2[1] || m2[2]
    }
    if (name) out.server_fns.push({ file: rel, line: n, name })
    // storage buckets FIRST, and never as tables
    const consumed_spans = []
    for (const mm of finditer(STORAGE_FROM, line)) {
      out.storage.push({ file: rel, line: n, bucket: mm[1] })
      consumed_spans.push(spanOf(mm))
    }
    for (const mm of finditer(RPC_CALL, line)) out.rpc.push({ file: rel, line: n, fn: mm[1] })
    for (const mm of finditer(FN_INVOKE, line)) out.edge_fns.push({ file: rel, line: n, fn: mm[1] })
    if (layers.includes('supabase') || layers.includes('sql')) {
      for (const mm of finditer(DB_FROM, line)) {
        const start = mm.index
        if (consumed_spans.some(([a, b]) => a <= start && start < b + 20)) continue
        out.db.push({ file: rel, line: n, table: mm[1], op: tag_op(lines, i), layer: 'supabase/sql' })
      }
    }
    if (layers.includes('drizzle')) {
      for (const mm of finditer(DRIZZLE_WRITE, line)) {
        const ident = mm[2]
        out.db.push({
          file: rel, line: n, table: drizzle_map.has(ident) ? drizzle_map.get(ident) : ident,
          op: { insert: 'INSERT', update: 'UPDATE', delete: 'DELETE' }[mm[1]],
          layer: 'drizzle', resolved: drizzle_map.has(ident),
        })
      }
      if (line.includes('.select(') || line.includes('db.select')) {
        for (const mm of finditer(DB_FROM_IDENT, line)) {
          const ident = mm[1]
          out.db.push({
            file: rel, line: n, table: drizzle_map.has(ident) ? drizzle_map.get(ident) : ident,
            op: 'READ', layer: 'drizzle', resolved: drizzle_map.has(ident),
          })
        }
      }
    }
    if (layers.includes('prisma')) {
      for (const mm of finditer(PRISMA_CALL, line)) {
        const model = mm[1], op = mm[2]
        if (model === 'storage' || model === 'auth' || model === 'functions') continue
        out.db.push({
          file: rel, line: n, table: prisma_map.has(model.toLowerCase()) ? prisma_map.get(model.toLowerCase()) : model,
          op: PRISMA_READ_OPS.has(op) ? 'READ' : op.toUpperCase().split('MANY').join('').split('ANDRETURN').join(''),
          layer: 'prisma',
        })
      }
    }
    if (layers.includes('firestore')) {
      for (const mm of finditer(FIRE_COLLECTION, line)) {
        let op = 'READ'
        const window = lines.slice(Math.max(0, i - 2), i + 3).join(' ')
        for (const [pat, o] of FIRE_OPS) { if (pat.test(window)) { op = o; break } }
        out.db.push({ file: rel, line: n, table: mm[1], op, layer: 'firestore' })
      }
    }
    if (layers.includes('mongo')) {
      for (const mm of finditer(MONGO_CALL, line)) {
        out.db.push({ file: rel, line: n, table: mm[1], op: MONGO_READ_OPS.has(mm[2]) ? 'READ' : 'WRITE', layer: 'mongo' })
      }
    }
    if (RAW_SQL.test(line) && (line.includes('`') || line.includes('"') || line.includes("'"))) {
      out.raw_sql.push({ file: rel, line: n, verb: RAW_SQL.exec(line)[1].toUpperCase(), snippet: pyStrip(line).slice(0, 160) })
    }
  }
  return out
}

const RLS_ENABLE = /alter\s+table\s+(?:public\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security/gi
const RLS_POLICY = /create\s+policy\s+"?([^"\n]+?)"?\s+on\s+(?:public\.)?"?(\w+)"?(?:\s+as\s+\w+)?(?:\s+for\s+(select|insert|update|delete|all))?(?:\s+to\s+([\w ,]+?))?\s+(?:using|with)/gis
const ENV_VAR = /process\.env\.(\w+)|import\.meta\.env\.(\w+)|Deno\.env\.get\(\s*['"](\w+)['"]/g
const CONFIRM_PATTERN = /window\.confirm|\bconfirm\(|<AlertDialog|ConfirmDialog|useConfirm|\bAreYouSure/
const FEEDBACK_CALL = /\btoast\.?\w*\(|useToast\b|\bsonner\b|\bnotify\(|Alert\.alert\(|showMessage\(|enqueueSnackbar\(|message\.(?:error|success|warning)\(/
const ERROR_HOOK = /\bonError\s*[:=(]|<ErrorBoundary|componentDidCatch|\bErrorBoundary\b/
const SYNC_LIVE = /\.subscribe\(|\.channel\(|onSnapshot\(|refetchInterval|\bretry\s*:|navigator\.onLine|addEventListener\(\s*['"]online|['"]offline['"]/
const VALIDATION = /z\.(?:object|string|number|coerce)\b|\.min\(|\.max\(|\.email\(|\.regex\(|required[:=]|minLength|maxLength|pattern=|yup\./
const AUTH_CALL = /signInWith\w+|signIn\(|signUp\(|signOut\(|onAuthStateChange|getSession\(|resetPasswordForEmail|verifyOtp|useAuth\b|<Protected|RequireAuth/
const PAID_GATE = /\bisPro\b|is_premium|\bplan\b\s*[=!:]|\btier\b|subscription|entitlement|\bupgrade\b|Paywall|price_?[iI]d|lookup_key|checkout\.sessions?/
const OUTBOUND_SEND = /emails?\.send\(|sgMail\.send|sendMail\(|sendEmail|scheduleNotificationAsync|sendPushNotificationsAsync|messages\.create\(|\.send\(\s*\{/
const PG_CRON_JOB = /\bcron\.schedule\(\s*['"]([^'"\n]+)['"]\s*,\s*['"]([^'"\n]+)['"]/gi
const DENO_CRON = /\bDeno\.cron\(\s*['"]([^'"\n]+)['"]\s*,\s*['"]([^'"\n]+)['"]/g
const NODE_CRON = /\bcron\.schedule\(\s*['"]([^'"\n]+)['"]/gi
const INTERVAL_NAMED = /\b(?:const|let|var)\s+(\w+)\s*=\s*setInterval\([^,]*,\s*(\d+)/g
const INTERVAL_BARE = /\bsetInterval\(/g
const CRON_EXPR = /^[\d*/,\-]+(?:\s+[\d*/,\-]+){4,5}$/
const SCHEDULE_HINT = /\bnode-cron\b|\bDeno\.cron\b|\bpg_cron\b|\bsetInterval\(/gi
const STATE_LITERAL = /(?:status|state)\s*:\s*['"](\w[\w-]*)['"]/g
const GLOBAL_FEEDBACK = /<Toaster\b|<ToastProvider|ToastContainer|<Sonner\b|new QueryClient\(|<ErrorBoundary\b/g
export const SERVICE_DEPS = {
  stripe: 'Stripe (payments)', '@stripe/stripe-js': 'Stripe (payments)',
  resend: 'Resend (email)', '@sendgrid/mail': 'SendGrid (email)', nodemailer: 'SMTP email (nodemailer)',
  twilio: 'Twilio (SMS/voice)', openai: 'OpenAI API', '@anthropic-ai/sdk': 'Anthropic API',
  '@supabase/supabase-js': 'Supabase (database/auth/storage)', firebase: 'Firebase',
  '@aws-sdk/client-s3': 'AWS S3 (file storage)', 'aws-sdk': 'AWS',
  'posthog-js': 'PostHog (analytics)', '@sentry/react': 'Sentry (error tracking)', '@sentry/node': 'Sentry (error tracking)',
  algoliasearch: 'Algolia (search)', 'pusher-js': 'Pusher (realtime)',
}
export const EMAIL_DEPS = new Set(['resend', '@sendgrid/mail', 'nodemailer'])
export const PAYMENT_DEPS = new Set(['stripe', '@stripe/stripe-js'])

export function is_test_file(rel) {
  const low = rel.toLowerCase()
  return (low.includes('.test.') || low.includes('.spec.') || low.includes('__tests__/') ||
    low.startsWith('test/') || low.includes('/test/') || low.includes('/e2e/'))
}

export function find_scheduled(text, rel) {
  const jobs = []
  let unnamed = 0
  if (is_test_file(rel)) return [jobs, unnamed]
  const line_of = (pos) => countNewlines(text, pos) + 1
  const claimed = []
  for (const pat of [PG_CRON_JOB, DENO_CRON]) {
    for (const m of finditer(pat, text)) {
      const first = pyStrip(m[1]), second = pyStrip(m[2])
      if (CRON_EXPR.test(first) && !CRON_EXPR.test(second)) continue
      jobs.push({ name: first, schedule: second, file: rel, line: line_of(m.index) })
      claimed.push(spanOf(m))
    }
  }
  for (const m of finditer(NODE_CRON, text)) {
    const start = m.index
    if (claimed.some(([a, b]) => a <= start && start < b)) continue
    if (!CRON_EXPR.test(pyStrip(m[1]))) continue
    const name = nearest_binding(text, m.index)
    if (name) jobs.push({ name, schedule: pyStrip(m[1]), file: rel, line: line_of(m.index) })
    else unnamed += 1
  }
  for (const m of finditer(INTERVAL_NAMED, text)) {
    const ms = parseInt(m[2], 10)
    jobs.push({ name: m[1], schedule: every(ms), file: rel, line: line_of(m.index) })
    claimed.push(spanOf(m))
  }
  for (const m of finditer(INTERVAL_BARE, text)) {
    const start = m.index
    if (!claimed.some(([a, b]) => a <= start && start < b)) unnamed += 1
  }
  for (const m of finditer(SCHEDULE_HINT, text)) {
    const start = m.index
    if (!claimed.some(([a, b]) => a <= start && start < b) && !m[0].includes('setInterval')) unnamed += 1
  }
  return [jobs, unnamed]
}

export function every(ms) {
  if (ms % 3600000 === 0) {
    const n = Math.floor(ms / 3600000)
    return n === 1 ? 'every hour' : `every ${n} hours`
  }
  if (ms % 60000 === 0) {
    const n = Math.floor(ms / 60000)
    return n === 1 ? 'every minute' : `every ${n} minutes`
  }
  if (ms % 1000 === 0) {
    const n = Math.floor(ms / 1000)
    return n === 1 ? 'every second' : `every ${n} seconds`
  }
  return `every ${ms}ms`
}

export function nearest_binding(text, pos) {
  const head = pySplitlines(text.slice(0, pos)).slice(-4)
  for (let i = head.length - 1; i >= 0; i--) {
    const m = /\b(?:const|let|var|function|async function)\s+(\w+)/.exec(head[i])
    if (m) return m[1]
  }
  return null
}

export function collect_app_behaviors(repo) {
  const scheduled = []
  const cascades = []
  const soft_delete = []
  const enums = {}
  let unnamed_schedules = 0
  const sql_files = sortedCP(glob(repo, 'supabase/migrations/*.sql')).slice(0, 300)
  const enum_decl = /create\s+type\s+"?(\w+)"?\s+as\s+enum\s*\(([^)]+)\)/gi
  const check_in = /"?(\w+)"?\s+\w+[^,]*check\s*\([^)]*in\s*\(([^)]+)\)/gi
  const fk = /references\s+(?:public\.)?"?(\w+)"?[^,]*?on\s+delete\s+(cascade|set\s+null|restrict)/gi
  for (const sf of sql_files) {
    const text = readTextReplace(sf)
    const rel = relTo(repo, sf)
    for (const m of finditer(enum_decl, text)) enums[m[1]] = m[2].split(',').map((v) => stripChars(pyStrip(v), "'\"")).slice(0, 12)
    for (const m of finditer(check_in, text)) enums[m[1]] = m[2].split(',').map((v) => stripChars(pyStrip(v), "'\"")).slice(0, 12)
    for (const m of finditer(fk, text)) cascades.push({ references: m[1], on_delete: m[2].toLowerCase(), file: rel, line: countNewlines(text, m.index) + 1 })
    if (text.includes('deleted_at')) soft_delete.push(rel)
    const [jobs, unnamed] = find_scheduled(text, rel)
    scheduled.push(...jobs)
    unnamed_schedules += unnamed
  }
  const code_files = []
  for (const pat of ['src/**/*.ts', 'supabase/functions/**/*.ts', 'app/**/*.ts']) {
    for (const p of glob(repo, pat)) if (!hasNodeModules(p)) code_files.push(p)
  }
  for (const f of code_files.slice(0, 600)) {
    let t
    try { t = readTextReplace(f) } catch { continue }
    const rel = relTo(repo, f)
    const [jobs, unnamed] = find_scheduled(t, rel)
    scheduled.push(...jobs)
    unnamed_schedules += unnamed
  }
  // full database shape: table -> [column type] from create table + add column
  const columns = {}
  const ct_block = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(/gi
  const add_col = /alter\s+table\s+(?:public\.)?"?(\w+)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?\s+(\w+)/gi
  for (const sf of sql_files) {
    const text = readTextReplace(sf)
    for (const m of finditer(ct_block, text)) {
      let depth = 1
      let i = m.index + m[0].length
      while (i < text.length && depth) {
        depth += text[i] === '(' ? 1 : 0
        depth -= text[i] === ')' ? 1 : 0
        i += 1
      }
      const body = text.slice(m.index + m[0].length, i - 1)
      const cols = []
      for (const raw of body.split(/,(?![^(]*\))/)) {
        const w = pySplitWS(raw)
        if (w.length >= 2 && !['primary', 'foreign', 'unique', 'constraint', 'check', 'like'].includes(w[0].toLowerCase())) {
          cols.push(`${stripChars(w[0], '"')} ${w[1]}`)
        }
      }
      columns[m[1]] = cols.slice(0, 40)
    }
    for (const m of finditer(add_col, text)) {
      if (!(m[1] in columns)) columns[m[1]] = []
      columns[m[1]].push(`${m[2]} ${m[3]}`)
    }
  }
  // ONE JOB IS ONE JOB - dedup on (name.lower(), schedule)
  const seen = new Set()
  const unique = []
  for (const job of scheduled) {
    const key = JSON.stringify([job.name.toLowerCase(), job.schedule])
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(job)
  }
  return {
    scheduled: unique.slice(0, 40), scheduled_unnamed: unnamed_schedules,
    state_enums: enums, delete_cascades: cascades.slice(0, 60),
    soft_delete_files: soft_delete.slice(0, 20), schema_columns: columns,
  }
}

export function collect_permissions(repo) {
  const enabled = new Set()
  const policies = []
  for (const sf of sortedCP(glob(repo, 'supabase/migrations/*.sql')).slice(0, 300)) {
    const text = readTextReplace(sf)
    const rel = relTo(repo, sf)
    for (const m of finditer(RLS_ENABLE, text)) enabled.add(m[1])
    for (const m of finditer(RLS_POLICY, text)) {
      policies.push({
        table: m[2], policy: pyStrip(m[1]),
        action: (m[3] || 'all').toLowerCase(),
        roles: pyStrip(m[4] || 'public'),
        file: rel, line: countNewlines(text, m.index) + 1,
      })
    }
  }
  return [sortedCP(enabled), policies]
}

export function collect_env_and_services(repo, deps) {
  const env = {}
  const scan = []
  for (const pat of ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'supabase/functions/**/*.ts']) {
    for (const p of glob(repo, pat)) if (!hasNodeModules(p)) scan.push(p)
  }
  for (const f of scan.slice(0, 800)) {
    let text
    try { text = readTextReplace(f) } catch { continue }
    const rel = relTo(repo, f)
    for (const m of finditer(ENV_VAR, text)) {
      const name = m[1] || m[2] || m[3]
      if (name && !(name in env) && !['NODE_', 'MODE', 'DEV', 'PROD', 'BASE_URL', 'SSR'].some((p) => name.startsWith(p))) {
        env[name] = { file: rel, line: countNewlines(text, m.index) + 1 }
      }
    }
  }
  const vals = new Set()
  for (const [k, v] of Object.entries(SERVICE_DEPS)) if (k in deps) vals.add(v)
  const services = sortedCP(vals)
  return [env, services]
}

export function dangerous_flags(agg, deps, files_text) {
  const flags = []
  for (const d of (agg.db || [])) {
    if (d.op === 'DELETE') flags.push({ kind: 'delete data', table: d.table, file: d.file, line: d.line })
  }
  if ([...PAYMENT_DEPS].some((k) => k in deps) && (files_text.toLowerCase().includes('stripe') || files_text.toLowerCase().includes('checkout'))) {
    flags.push({ kind: 'take payment' })
  }
  if ([...EMAIL_DEPS].some((k) => k in deps) && /send|mail/i.test(files_text)) {
    flags.push({ kind: 'send email' })
  }
  for (const e of (agg.edge_fns || [])) {
    if (/send|mail|charge|pay|delete|purge/i.test(e.fn)) {
      flags.push({ kind: `run the server action '${e.fn}'`, file: e.file, line: e.line })
    }
  }
  return flags
}

export function route_slug(pathStr) {
  let s = stripChars(pathStr, '/')
  s = s.replace(/[:$\[\]]/g, '')
  s = s.replace(/\//g, '-')
  return s || 'index'
}

// PurePosixPath(str) normalisation for the printed output path.
function pyPosixStr(p) {
  const isAbs = p.startsWith('/')
  const segs = p.split('/').filter((s) => s !== '' && s !== '.')
  let s = segs.join('/')
  if (isAbs) s = '/' + s
  if (s === '') s = isAbs ? '/' : '.'
  return s
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function print(s) { fs.writeSync(1, s + '\n') }
function eprint(s) { fs.writeSync(2, s + '\n') }

function argError(prog, msg) {
  eprint(usageLine(prog))
  eprint(`${prog}: error: ${msg}`)
  process.exit(2)
}
function usageLine(prog) {
  return `usage: ${prog} [-h] [--repo-root REPO_ROOT] [-o OUT] [--depth DEPTH] routes_json`
}

function parseArgs(argv, prog) {
  const args = { routes_json: undefined, repo_root: '.', out: 'map/_harvest.json', depth: 2 }
  const positionals = []
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
    else if (a === '--depth') args.depth = parseDepth(need('--depth'), prog)
    else if (a.startsWith('--depth=')) args.depth = parseDepth(a.slice('--depth='.length), prog)
    else if (a.startsWith('-') && a !== '-') argError(prog, `unrecognized arguments: ${a}`)
    else positionals.push(a)
  }
  if (positionals.length === 0) argError(prog, 'the following arguments are required: routes_json')
  if (positionals.length > 1) argError(prog, `unrecognized arguments: ${positionals.slice(1).join(' ')}`)
  args.routes_json = positionals[0]
  return args
}
function parseDepth(v, prog) {
  if (!/^[+-]?\d+$/.test(v)) argError(prog, `argument --depth: invalid int value: '${v}'`)
  return parseInt(v, 10)
}

function main() {
  const prog = baseName(process.argv[1] || 'harvest.mjs')
  const args = parseArgs(process.argv.slice(2), prog)
  const repo = pyResolve(args.repo_root)
  const aliases = load_aliases(repo)
  const [layers, prisma_schemas] = detect_data_layers(repo)
  const pkg_deps = {}
  if (isFile(path.join(repo, 'package.json'))) {
    const _p = read_json_tolerant(path.join(repo, 'package.json'))
    for (const _k of ['dependencies', 'devDependencies']) Object.assign(pkg_deps, getOr(_p, _k, {}))
  }
  const [schema_tables, drizzle_map, prisma_map] = read_schema_tables(repo, layers, prisma_schemas)
  print(`data layer(s) detected: ${layers.length ? layers.join(', ') : 'NONE'}` +
    (schema_tables.size ? `; schema tables found: ${schema_tables.size}` : ''))
  const extract_layers = layers.length ? layers : ['supabase', 'sql']
  let routes = JSON.parse(fs.readFileSync(args.routes_json, 'utf8'))
  if (routes && typeof routes === 'object' && !Array.isArray(routes)) {
    routes = Object.prototype.hasOwnProperty.call(routes, 'routes') ? routes.routes : []
  }

  const result = {}
  for (const r of routes) {
    const src = getOr(r, 'source_file', undefined)
    if (!src) continue
    const entry = pyResolve(repo, src)
    if (!isFile(entry)) { result[r.path] = { error: `source file not found: ${src}` }; continue }
    const files = collect_files(entry, repo, aliases, args.depth)
    const agg = {
      slug: route_slug(r.path), files: files.map((f) => relTo(repo, f)),
      interactive: [], server_fns: [], db: [], raw_sql: [], storage: [], rpc: [], edge_fns: [], feedback: [], live_sync: [], validation: [], auth: [], paid_gates: [], outbound: [], state_literals: [],
    }
    for (const f of files) {
      const h = harvest_file(f, repo, extract_layers, drizzle_map, prisma_map)
      for (const k of ['interactive', 'server_fns', 'db', 'raw_sql', 'storage', 'rpc', 'edge_fns', 'feedback', 'live_sync', 'validation', 'auth', 'paid_gates', 'outbound', 'state_literals']) {
        agg[k].push(...h[k])
      }
    }
    let files_text = ''
    for (const f of files.slice(0, 60)) {
      try { files_text += readTextReplace(f) } catch { /* pass */ }
    }
    agg.dangerous = dangerous_flags(agg, pkg_deps, files_text)
    agg.has_confirm_pattern = CONFIRM_PATTERN.test(files_text)
    result[r.path] = agg
  }

  const global_feedback = []
  const gfFiles = []
  for (const pat of ['src/**/*.tsx', 'src/**/*.ts', 'app/**/*.tsx']) {
    for (const p of glob(repo, pat)) if (!hasNodeModules(p)) gfFiles.push(p)
  }
  for (const f of gfFiles.slice(0, 600)) {
    let t
    try { t = readTextReplace(f) } catch { continue }
    for (const m of finditer(GLOBAL_FEEDBACK, t)) {
      global_feedback.push({ what: pyStrip(stripChars(m[0], '<(')), file: relTo(repo, f), line: countNewlines(t, m.index) + 1 })
    }
  }
  const behaviors = collect_app_behaviors(repo)
  const [rls_enabled, rls_policies] = collect_permissions(repo)
  const [env_vars, services] = collect_env_and_services(repo, pkg_deps)
  const touched = new Set()
  for (const v of Object.values(result)) {
    if (v && typeof v === 'object') for (const d of (v.db || [])) touched.add(d.table)
  }
  const orphan_tables = sortedCP([...schema_tables].filter((t) => !touched.has(t)))
  result._meta = {
    data_layers: layers, schema_tables: sortedCP(schema_tables),
    drizzle_idents: drizzle_map.size, prisma_models: prisma_map.size,
    rls_enabled, rls_policies,
    tables_without_rls: sortedCP([...schema_tables].filter((t) => !rls_enabled.includes(t))),
    orphan_tables,
    env_vars, services,
    global_feedback: global_feedback.slice(0, 40), ...behaviors,
  }
  const outPath = args.out
  fs.mkdirSync(path.dirname(outPath) || '.', { recursive: true })
  fs.writeFileSync(outPath, dumps(result, 2))
  const pages = {}
  for (const [k, v] of Object.entries(result)) if (!k.startsWith('_')) pages[k] = v
  const npages = Object.keys(pages).length
  let ndb = 0, nfns = 0, nctl = 0
  for (const v of Object.values(pages)) {
    if (v && typeof v === 'object') {
      ndb += (v.db || []).length
      nfns += (v.server_fns || []).length
      nctl += (v.interactive || []).length
    }
  }
  print(`harvested ${npages} routes -> ${pyPosixStr(outPath)} (${nfns} server fns, ${ndb} db call sites, ${nctl} controls)`)
  if (nctl > 0 && ndb === 0 && !layers.length) {
    print('')
    print('REFUSING to bless this harvest: I found your pages and their controls,')
    print('but I do not recognise how this app talks to its database. Writing the')
    print('map now would claim nothing touches any data, which would be false.')
    print('Tell me the data layer, or add an adapter. (exit 3)')
    process.exit(3)
  }
  if (nctl > 0 && ndb === 0 && layers.length) {
    print(`WARNING: layer(s) ${pyListRepr(layers)} detected but ZERO data call sites matched.`)
    print('The idiom in this codebase may differ - inspect one data file by hand')
    print('before writing any page, or the map will falsely claim no data is touched.')
  }
  if (nfns === 0 && ndb === 0 && nctl === 0) {
    print('WARNING: harvest is empty everywhere - probably an unresolved path alias.')
    print('Fix that before Phase 3 - do not write pages from an empty harvest.')
  }
}

// Python str(list) repr, e.g. ['supabase', 'sql']
function pyListRepr(arr) {
  return '[' + arr.map((x) => "'" + x + "'").join(', ') + ']'
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
