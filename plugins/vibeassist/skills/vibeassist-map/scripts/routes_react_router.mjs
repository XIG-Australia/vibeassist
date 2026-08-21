#!/usr/bin/env node
// Phase 1 route enumeration for react-router apps (Lovable-style) - Fix 2.
//
// Faithful ESM port of routes_react_router.py. Behaviour (CLI args, input
// reading, output file, stdout text, exit codes) is byte-for-byte identical to
// the Python. The three shared helpers load_aliases / resolve_import /
// route_slug are imported from harvest.mjs exactly as the Python module imports
// them from harvest.py - they are NOT reimplemented here.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dumps } from './_pyjson.mjs'
import { load_aliases, resolve_import, route_slug } from './harvest.mjs'

// ---------------------------------------------------------------------------
// Python-ism helpers
// ---------------------------------------------------------------------------

// CPython str whitespace set (Py_UNICODE_ISSPACE), used by str.rstrip()/strip().
const PY_WS = '\\t\\n\\x0b\\x0c\\r\\x1c\\x1d\\x1e\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000'
const STRIP_R = new RegExp('[' + PY_WS + ']+$')

function pyRstrip(s) {
  return s.replace(STRIP_R, '')
}
// str.rstrip(chars): strip trailing chars only.
function rstripChars(s, chars) {
  const set = new Set(chars)
  let j = s.length
  while (j > 0 && set.has(s[j - 1])) j--
  return s.slice(0, j)
}

// Pattern.search(string, pos): global regex with lastIndex set. `\b`/lookbehind
// still see the full string (like Python's pos parameter, which is not slicing).
function searchFrom(reGlobal, text, pos) {
  reGlobal.lastIndex = pos
  const m = reGlobal.exec(text)
  return m
}

// ---------------------------------------------------------------------------
// Filesystem helpers (pathlib semantics on string paths)
// ---------------------------------------------------------------------------
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
function baseName(p) {
  return path.basename(p)
}
// f.parts membership test for 'node_modules' on an absolute posix path.
function partsHasNodeModules(absPath) {
  // Split on the OS separator too: glob() builds these with path.join, so on
  // Windows they carry backslashes and a '/'-only split never sees the segment.
  return absPath.split(path.sep).join('/').split('/').includes('node_modules')
}

// --- pathlib-compatible glob (repo.glob("src/**/*.[tj]sx")) -----------------
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
// fnmatch.translate for a single path segment: handles *, ?, and [..] classes
// (Python char classes are NOT escaped away). Anchored + dotall like pathlib.
function fnmatchTranslate(pat) {
  let res = ''
  let i = 0
  const n = pat.length
  while (i < n) {
    const c = pat[i]
    i += 1
    if (c === '*') {
      res += '.*'
    } else if (c === '?') {
      res += '.'
    } else if (c === '[') {
      let j = i
      if (j < n && pat[j] === '!') j += 1
      if (j < n && pat[j] === ']') j += 1
      while (j < n && pat[j] !== ']') j += 1
      if (j >= n) {
        res += '\\['
      } else {
        let stuff = pat.slice(i, j).replace(/\\/g, '\\\\')
        i = j + 1
        if (stuff[0] === '!') stuff = '^' + stuff.slice(1)
        else if (stuff[0] === '^' || stuff[0] === '[') stuff = '\\' + stuff
        res += '[' + stuff + ']'
      }
    } else if ('.^$+{}()|\\'.includes(c)) {
      res += '\\' + c
    } else {
      res += c
    }
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

// PurePosixPath(str) normalisation for the printed / written output path.
function pyPosixStr(p) {
  const isAbs = p.startsWith('/')
  const segs = p.split('/').filter((s) => s !== '' && s !== '.')
  let s = segs.join('/')
  if (isAbs) s = '/' + s
  if (s === '') s = isAbs ? '/' : '.'
  return s
}

// ===========================================================================
// routes_react_router.py port
// ===========================================================================

const ROUTE_OPEN = /<Route\b/g
const ROUTE_CLOSE = /<\/Route\s*>/g

function* tokenize_route_tags(text) {
  // Yield ['open'|'selfclose'|'close', attr_text, pos]. A JSX attr like
  // element={<AppShell />} contains '>' inside braces, so the tag's true end
  // must be found by tracking {} depth - a plain [^>]* regex truncates it.
  let i = 0
  while (i < text.length) {
    const mo = searchFrom(ROUTE_OPEN, text, i)
    const mc = searchFrom(ROUTE_CLOSE, text, i)
    if (!mo && !mc) return
    if (mc && (!mo || mc.index < mo.index)) {
      yield ['close', '', mc.index]
      i = mc.index + mc[0].length
      continue
    }
    let j = mo.index + mo[0].length
    let depth = 0
    while (j < text.length) {
      const ch = text[j]
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      else if (ch === '>' && depth === 0) break
      j += 1
    }
    const attr_text = text.slice(mo.index + mo[0].length, j)
    const kind = pyRstrip(attr_text).endsWith('/') ? 'selfclose' : 'open'
    yield [kind, rstripChars(pyRstrip(attr_text), '/'), mo.index]
    i = j + 1
  }
}

const ATTR_PATH_SRC = '\\bpath\\s*=\\s*(?:["\']([^"\']+)["\']|\\{\\s*["\']([^"\']+)["\']\\s*\\})'
const ATTR_PATH = new RegExp(ATTR_PATH_SRC)
const ATTR_PATH_G = new RegExp(ATTR_PATH_SRC, 'g')
const ATTR_INDEX = /\bindex\b(?!\s*=\s*\{?\s*false)/
const ATTR_ELEMENT = /\belement\s*=\s*\{\s*<\s*([A-Za-z_]\w*)/
const ATTR_NAVIGATE = /<\s*Navigate\b[^>]*\bto\s*=\s*(?:["']([^"']+)["']|\{\s*["']([^"']+)["']\s*\})/
const LAZY_IMPORT = /(?:const|let|var)\s+(\w+)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/g
const STATIC_IMPORT = /import\s+(?:(\w+)|\{([^}]+)\})\s+from\s+['"]([^'"]+)['"]/g

function norm_param(pathStr) {
  return pathStr // react-router already uses :param - the canonical form
}

function join_paths(parent, child) {
  if (child.startsWith('/')) return child
  if (!parent) return '/' + child
  return child ? (rstripChars(parent, '/') + '/' + child) : parent
}

function build_import_map(text) {
  // component name -> import spec (lazy and static).
  const imp = {}
  for (const m of text.matchAll(LAZY_IMPORT)) {
    const name = m[1] ?? ''
    const spec = m[2] ?? ''
    imp[name] = spec
  }
  for (const m of text.matchAll(STATIC_IMPORT)) {
    const def = m[1] ?? ''
    const named = m[2] ?? ''
    const spec = m[3] ?? ''
    if (def) imp[def] = spec
    for (let n of named.split(',')) {
      const parts = n.split(' as ')
      n = pyStripLocal(parts[parts.length - 1])
      if (n) imp[n] = spec
    }
  }
  return imp
}

// str.strip() (default whitespace) for import-name cleanup.
const STRIP_L = new RegExp('^[' + PY_WS + ']+')
function pyStripLocal(s) {
  return s.replace(STRIP_L, '').replace(STRIP_R, '')
}

function attrs_of(attr_text) {
  const m = ATTR_PATH.exec(attr_text)
  const pathv = m ? ((m[1] ?? m[2]) ?? null) : null
  const el = ATTR_ELEMENT.exec(attr_text)
  const nav = ATTR_NAVIGATE.exec(attr_text)
  return {
    path: pathv,
    index: Boolean(ATTR_INDEX.exec(attr_text.replace(ATTR_PATH_G, ''))),
    component: el ? el[1] : null,
    navigate_to: nav ? ((nav[1] ?? nav[2]) ?? null) : null,
  }
}

function parse_jsx(text) {
  // Walk <Route> tags with a stack; emit route dicts for leaves and
  // element-bearing nodes; layouts (children, no element) are chain-only.
  const routes = []
  const stack = [] // each: {attrs, children_seen}

  function emit(node, ancestors) {
    const a = node.attrs
    let full = ''
    for (const anc of ancestors) {
      const p = anc.attrs.path
      if (p) full = join_paths(full, p)
    }
    let pathStr
    if (a.index) {
      pathStr = full || '/'
    } else if (a.path !== null) {
      pathStr = join_paths(full, a.path)
    } else {
      return // pathless, non-index, no path: pure layout wrapper
    }
    const entry = {
      path: pathStr || '/',
      component: a.component,
      layout_chain: ancestors.filter((anc) => anc.attrs.component).map((anc) => anc.attrs.component),
      audience: 'user',
    }
    if (a.navigate_to) {
      entry.audience = 'redirect'
      entry.redirect_to = !a.navigate_to.startsWith('/') ? join_paths(full, a.navigate_to) : a.navigate_to
    }
    if (a.path === '*' || (pathStr.endsWith('/*') && a.path === '*')) {
      entry.not_found = true
    }
    routes.push(entry)
  }

  for (const [kind, attrs] of tokenize_route_tags(text)) {
    if (kind === 'close') {
      if (stack.length) {
        const node = stack.pop()
        if (!node.children_seen && (node.attrs.path !== null || node.attrs.index || node.attrs.navigate_to)) {
          emit(node, stack)
        }
      }
      continue
    }
    const node = { attrs: attrs_of(attrs), children_seen: false }
    if (stack.length) stack[stack.length - 1].children_seen = true
    if (kind === 'selfclose') emit(node, stack)
    else stack.push(node)
  }
  return routes
}

function split_objects(arr_text) {
  // Split a JS array literal's top-level {...} objects.
  const objs = []
  let depth = 0
  let start = null
  for (let i = 0; i < arr_text.length; i++) {
    const ch = arr_text[i]
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
    } else if (ch === '}') {
      depth -= 1
      if (depth === 0 && start !== null) {
        objs.push(arr_text.slice(start + 1, i))
        start = null
      }
    }
  }
  return objs
}

function find_children_span(obj_text) {
  const m = /\bchildren\s*:\s*\[/.exec(obj_text)
  if (!m) return [null, obj_text]
  let depth = 1
  let i = m.index + m[0].length
  const mend = i
  while (i < obj_text.length && depth) {
    if (obj_text[i] === '[') depth += 1
    else if (obj_text[i] === ']') depth -= 1
    i += 1
  }
  return [obj_text.slice(mend, i - 1), obj_text.slice(0, m.index) + obj_text.slice(i)]
}

function parse_router_objects(arr_text, parent_path, chain, routes) {
  for (const obj of split_objects(arr_text)) {
    const [children_text, own] = find_children_span(obj)
    const a = attrs_of(own.replaceAll('path:', 'path=').replaceAll('element:', 'element={').replaceAll('index:', 'index '))
    // object syntax needs its own field regexes; redo path/index simply:
    const pm = /\bpath\s*:\s*["']([^"']+)["']/.exec(own)
    a.path = pm ? pm[1] : null
    a.index = Boolean(/\bindex\s*:\s*true/.exec(own))
    const em = /\belement\s*:\s*<\s*([A-Za-z_]\w*)/.exec(own)
    a.component = em ? em[1] : null
    const nm = ATTR_NAVIGATE.exec(own)
    a.navigate_to = nm ? ((nm[1] ?? nm[2]) ?? null) : null
    let full
    if (a.index) {
      full = parent_path || '/'
    } else if (a.path !== null) {
      full = join_paths(parent_path, a.path)
    } else {
      full = parent_path // pathless layout
    }
    if (children_text !== null) {
      const new_chain = chain.concat(a.component ? [a.component] : [])
      parse_router_objects(children_text, a.path !== null ? full : parent_path, new_chain, routes)
      continue // layout: not itself a route
    }
    if (a.path === null && !a.index) continue
    const entry = { path: full || '/', component: a.component, layout_chain: chain, audience: 'user' }
    if (a.navigate_to) {
      entry.audience = 'redirect'
      entry.redirect_to = a.navigate_to
    }
    if (a.path === '*') entry.not_found = true
    routes.push(entry)
  }
}

function find_entry(repo) {
  const cands = []
  const has = (f) => cands.includes(f)
  for (const name of ['src/App.tsx', 'src/App.jsx', 'src/main.tsx', 'src/main.jsx', 'src/router.tsx', 'src/routes.tsx', 'app/App.tsx']) {
    const f = path.join(repo, name)
    if (isFile(f)) cands.push(f)
  }
  for (const f of glob(repo, 'src/**/*.[tj]sx')) {
    if (!partsHasNodeModules(f) && !has(f)) {
      let t
      try { t = readTextReplace(f) } catch { continue }
      if (t.includes('createBrowserRouter') || t.includes('<Routes')) cands.push(f)
    }
  }
  for (const f of cands) {
    const t = readTextReplace(f)
    if (t.includes('createBrowserRouter') || t.includes('<Routes') || t.includes('<Route')) {
      return [f, t]
    }
  }
  return [null, null]
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function print(s) { fs.writeSync(1, s + '\n') }
function eprint(s) { fs.writeSync(2, s + '\n') }

// sys.exit("message"): print message to stderr, exit status 1.
function sysExitStr(msg) {
  eprint(msg)
  process.exit(1)
}

function usageLine(prog) {
  return `usage: ${prog} [-h] [--repo-root REPO_ROOT] [--entry ENTRY] [-o OUT]`
}
function argError(prog, msg) {
  eprint(usageLine(prog))
  eprint(`${prog}: error: ${msg}`)
  process.exit(2)
}
function parseArgs(argv, prog) {
  const args = { repo_root: '.', entry: null, out: 'map/_routes.json' }
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
    else if (a === '--entry') args.entry = need('--entry')
    else if (a.startsWith('--entry=')) args.entry = a.slice('--entry='.length)
    else if (a === '-o' || a === '--out') args.out = need(a)
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length)
    else if (a.startsWith('-o') && a.length > 2) args.out = a.slice(2)
    else if (a.startsWith('-') && a !== '-') argError(prog, `unrecognized arguments: ${a}`)
    else positionals.push(a)
  }
  if (positionals.length > 0) argError(prog, `unrecognized arguments: ${positionals.join(' ')}`)
  return args
}

function main() {
  const prog = baseName(process.argv[1] || 'routes_react_router.mjs')
  const args = parseArgs(process.argv.slice(2), prog)
  const repo = path.resolve(args.repo_root)
  const aliases = load_aliases(repo)

  let entry, text
  if (args.entry) {
    entry = path.join(repo, args.entry)
    text = readTextReplace(entry)
  } else {
    ;[entry, text] = find_entry(repo)
    if (entry === null) {
      sysExitStr('No react-router registration found (createBrowserRouter or <Routes>). Wrong repo or wrong strategy.')
    }
  }

  const routes = []
  const m = /createBrowserRouter\s*\(\s*\[/.exec(text)
  if (m) {
    let depth = 1
    let i = m.index + m[0].length
    const mend = i
    while (i < text.length && depth) {
      if (text[i] === '[') depth += 1
      else if (text[i] === ']') depth -= 1
      i += 1
    }
    parse_router_objects(text.slice(mend, i - 1), '', [], routes)
  }
  routes.push(...parse_jsx(text))

  const imp = build_import_map(text)
  const out_routes = []
  const seen = new Set()
  for (const r of routes) {
    if (seen.has(r.path)) continue
    seen.add(r.path)
    const comp = 'component' in r ? r.component : null
    delete r.component
    let src_file = null
    if (comp && Object.prototype.hasOwnProperty.call(imp, comp)) {
      const resolved = resolve_import(entry, imp[comp], repo, aliases)
      if (resolved) {
        src_file = relTo(repo, resolved)
      }
    }
    const rec = {
      path: r.path,
      source_file: src_file || relTo(repo, entry),
      component: comp,
      layout_chain: 'layout_chain' in r ? r.layout_chain : [],
      auth_required: null, // react-router guards are wrapper components; decide per-app in Phase 1 prose
      audience: 'audience' in r ? r.audience : 'user',
    }
    if ('redirect_to' in r) rec.redirect_to = r.redirect_to
    if (r.not_found) rec.not_found = true
    rec.slug = route_slug(r.path)
    out_routes.push(rec)
  }
  const outp = args.out
  fs.mkdirSync(path.dirname(outp) || '.', { recursive: true })
  fs.writeFileSync(outp, dumps(out_routes, 2))
  const nred = out_routes.filter((r) => r.audience === 'redirect').length
  print(`react-router: ${out_routes.length} routes -> ${pyPosixStr(outp)} (${nred} redirects) from ${baseName(entry)}`)
  if (out_routes.length === 0) {
    sysExitStr('Router file found but zero routes parsed - inspect it by hand before continuing.')
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
