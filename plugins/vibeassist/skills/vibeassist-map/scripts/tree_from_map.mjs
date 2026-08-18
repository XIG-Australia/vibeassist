#!/usr/bin/env node
// Build the sitemap as an actual TREE from _routes.json.
//
// Faithful ESM port of tree_from_map.py. Behaviour (CLI args, input reading,
// output file, stdout text, exit codes) is byte-for-byte identical to the
// Python. Indentation encodes CONTAINMENT (nesting by address), distinct from
// the flat sitemap's "links to". Emits markdown, matched byte-for-byte.
//
//   node tree_from_map.mjs <map-dir> [-o tree.md] [--min-group 2]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ---------------------------------------------------------------------------
// Python-ism helpers
// ---------------------------------------------------------------------------

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
// Stable sort of an array of nodes by a string key, Python `sorted` semantics.
function sortedByKey(arr, keyFn) {
  return arr
    .map((v, i) => [v, i])
    .sort((p, q) => {
      const c = cmpCodepoint(keyFn(p[0]), keyFn(q[0]))
      return c !== 0 ? c : p[1] - q[1]
    })
    .map((p) => p[0])
}

// Map.get with Python dict.get(key) -> None default.
function mapGet(m, k) {
  return m.has(k) ? m.get(k) : null
}

// pathlib PurePath.stem for a directory-entry name.
function stemOf(name) {
  const i = name.lastIndexOf('.')
  return i > 0 && i < name.length - 1 ? name.slice(0, i) : name
}

// pathlib Path.glob("*.md") over a single directory: matches files AND dirs,
// includes dotfiles, non-recursive. Returns the matched entry names.
function globMdNames(dir) {
  let ents
  try { ents = fs.readdirSync(dir) } catch { return [] }
  return ents.filter((n) => n.length >= 3 && n.endsWith('.md'))
}

// ---------------------------------------------------------------------------
// tree_from_map.py port
// ---------------------------------------------------------------------------

function build(routes, min_group = 2) {
  const by_path = new Map()
  for (const r of routes) by_path.set(r.path, r)
  const root = { seg: '', path: '/', kids: new Map(), route: mapGet(by_path, '/') }

  for (const r of sortedByKey(routes, (x) => x.path)) {
    if (r.path === '/') continue
    let node = root
    const segs = r.path.split('/').filter((s) => s)
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]
      const here = '/' + segs.slice(0, i + 1).join('/')
      if (!node.kids.has(seg)) {
        node.kids.set(seg, { seg, path: here, kids: new Map(), route: mapGet(by_path, here) })
      }
      node = node.kids.get(seg)
    }
    node.route = r
  }

  const dynamic = (seg) => seg.startsWith('$') || seg.startsWith(':') || seg.startsWith('[')

  function prune(node) {
    for (const kid of Array.from(node.kids.values())) prune(kid)
    for (const [seg, kid] of Array.from(node.kids.entries())) {
      if (kid.route !== null && kid.route !== undefined) continue
      const keep = kid.kids.size >= min_group || Array.from(kid.kids.keys()).some((s) => dynamic(s))
      if (!keep) {
        node.kids.delete(seg)
        for (const [gseg, gkid] of kid.kids.entries()) {
          node.kids.set(gseg, gkid)
        }
      }
    }
  }

  prune(root)
  return root
}

function render(node, out, depth = 0, mapped = new Set()) {
  if (depth) {
    const ind = '  '.repeat(depth - 1)
    const r = node.route
    if (r === null || r === undefined) {
      out.push(`${ind}- **${node.seg}/** — group, no page of its own`)
    } else {
      const bits = []
      if (r.auth_required) bits.push('signed-in')
      if (r.audience === 'redirect') bits.push('redirect')
      if (mapped.has(r.path)) bits.push('mapped')
      const suffix = bits.length ? `  (${bits.join(', ')})` : ''
      out.push(`${ind}- \`${node.path}\`${suffix}`)
    }
  }
  for (const kid of sortedByKey(Array.from(node.kids.values()), (k) => k.path)) {
    render(kid, out, depth + 1, mapped)
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function print(s) { fs.writeSync(1, s + '\n') }
function eprint(s) { fs.writeSync(2, s + '\n') }

function usageLine(prog) {
  return `usage: ${prog} [-h] [-o OUT] [--min-group MIN_GROUP] map_dir`
}
function helpText(prog) {
  return [
    usageLine(prog),
    '',
    'positional arguments:',
    '  map_dir',
    '',
    'options:',
    '  -h, --help            show this help message and exit',
    '  -o OUT, --out OUT',
    '  --min-group MIN_GROUP',
  ].join('\n')
}
function argError(prog, msg) {
  eprint(usageLine(prog))
  eprint(`${prog}: error: ${msg}`)
  process.exit(2)
}

// Python int(str): optional surrounding whitespace, optional sign, decimal
// digits with single underscores permitted between digits.
function pyInt(v, prog) {
  const s = v.replace(/^[\s]+|[\s]+$/g, '')
  if (/^[+-]?\d+(_\d+)*$/.test(s)) return parseInt(s.replace(/_/g, ''), 10)
  argError(prog, `argument --min-group: invalid int value: '${v}'`)
}

function parseArgs(argv, prog) {
  const args = { map_dir: undefined, out: undefined, min_group: 2 }
  const positionals = []
  let i = 0
  const need = (name) => {
    if (i + 1 >= argv.length) argError(prog, `argument ${name}: expected one argument`)
    return argv[++i]
  }
  for (; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') { print(helpText(prog)); process.exit(0) }
    else if (a === '-o' || a === '--out') args.out = need(a)
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length)
    else if (a.startsWith('-o') && a.length > 2) args.out = a.slice(2)
    else if (a === '--min-group') args.min_group = pyInt(need('--min-group'), prog)
    else if (a.startsWith('--min-group=')) args.min_group = pyInt(a.slice('--min-group='.length), prog)
    else if (a.startsWith('-') && a !== '-') argError(prog, `unrecognized arguments: ${a}`)
    else positionals.push(a)
  }
  if (positionals.length === 0) argError(prog, 'the following arguments are required: map_dir')
  if (positionals.length > 1) argError(prog, `unrecognized arguments: ${positionals.slice(1).join(' ')}`)
  args.map_dir = positionals[0]
  return args
}

function slug(p) {
  let s = p.replace(/^\/+/, '')
  s = s.split('/').join('-')
  for (const ch of ':$[]') s = s.split(ch).join('')
  return s || 'index'
}

function main() {
  const prog = path.basename(process.argv[1] || 'tree_from_map.mjs')
  const args = parseArgs(process.argv.slice(2), prog)

  const mp = args.map_dir
  const routes = JSON.parse(fs.readFileSync(path.join(mp, '_routes.json'), 'utf8'))
  const user = routes.filter((r) => r.audience === 'user' || r.audience === 'redirect')
  const mapped = new Set(globMdNames(path.join(mp, 'pages')).map(stemOf))
  const mapped_paths = new Set()
  for (const r of user) if (mapped.has(slug(r.path))) mapped_paths.add(r.path)

  const root = build(user, args.min_group)
  const lines = ['# Sitemap — nested by address\n']
  render(root, lines, 0, mapped_paths)

  const text = lines.join('\n') + '\n'
  if (args.out) {
    fs.writeFileSync(args.out, text)
    print(`wrote ${args.out}`)
  } else {
    print(text)
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
