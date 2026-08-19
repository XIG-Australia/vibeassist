#!/usr/bin/env node
// Emit map.json from a vibeassist-map working directory.
//
// Faithful Node ESM port of emit_map_json.py. Byte-for-byte parity with the
// Python reference is the contract: map.json output, every stdout/stderr line,
// exit codes, and parsing behaviour must match. Translation, not redesign.
//
//   node emit_map_json.mjs <map-dir> -o map.json
//
// The `generator` field keeps the literal "emit_map_json.py (reference
// implementation)" ON PURPOSE — it is a format identifier that must match the
// Python output, not a filename to update.

import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { dumps } from './_pyjson.mjs'

// ── Python str semantics helpers ────────────────────────────────────────────

// Python str.splitlines(): splits on the full set of line boundaries and drops
// a single trailing terminator (no empty final element).
function splitlines(s) {
  const res = []
  const n = s.length
  let i = 0, start = 0
  while (i < n) {
    const code = s.charCodeAt(i)
    if (code === 0x0d) { // \r  (and \r\n)
      res.push(s.slice(start, i))
      i += (s.charCodeAt(i + 1) === 0x0a) ? 2 : 1
      start = i
    } else if (code === 0x0a || code === 0x0b || code === 0x0c ||
               code === 0x1c || code === 0x1d || code === 0x1e ||
               code === 0x85 || code === 0x2028 || code === 0x2029) {
      res.push(s.slice(start, i))
      i += 1
      start = i
    } else {
      i += 1
    }
  }
  if (start < n) res.push(s.slice(start, n))
  return res
}

// Python str.strip()/rstrip() with no args strip whitespace.
function pyStrip(s, chars) {
  if (chars === undefined) return s.replace(/^\s+/, '').replace(/\s+$/, '')
  const set = new Set(chars)
  let a = 0, b = s.length
  while (a < b && set.has(s[a])) a++
  while (b > a && set.has(s[b - 1])) b--
  return s.slice(a, b)
}
function pyRstrip(s) { return s.replace(/\s+$/, '') }

// Python truthiness (for `if x.get(...)` and `if collection:`).
function truthy(v) {
  if (v === null || v === undefined || v === false) return false
  if (v === 0 || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

// `pg[k] not in (None, [], {})` — value present and not an empty list/dict.
function present(v) {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

function setdefault(obj, k, def) {
  if (!(k in obj)) obj[k] = def
  return obj[k]
}

const out = process.stdout
function print(line = '') { out.write(line + '\n') }

// ── Regexes (faithful translations of the Python `re` patterns) ─────────────

const CITE = /(?<file>[\w./\\$\[\]-]+\.[A-Za-z]{1,10}):(?<start>\d+)(?:-(?<end>\d+))?/g
const FIELD = /^\*\*(?<label>[^:*]+):\*\*\s*(?<value>.*)$/
const H1 = /^#\s+(?<path>\S+)\s*(?:[—-]\s*(?<title>.*))?$/
const CAP = /^##\s+Capability:\s*(?<name>.+)$/
const ACT = /^###\s+Action:\s*(?<name>.+)$/
const BULLET = /^\s*-\s+(?<key>What happens|Trigger|Feedback|Evidence|READS):\s*(?<value>.*)$/i
const OP_WORD = /\b(?<op>READS?|INSERT(?:\/UPDATE)?|UPDATE|DELETE)\b/g
const COLUMN_NAME_FULL = /^[A-Za-z_][A-Za-z0-9_]*$/
const TICKED_NAME = /`(?<table>[\w.]+)`(?:\s*\((?<cols>[^)]*)\))?/g
const CODE_SUFFIX = /\.(?:tsx?|jsx?|mjs|cjs|py|rb|go|rs|java|php|sql|md|json|ya?ml|toml|css|html?|svelte|vue)$/i

const CORE = {
  purpose: 'Purpose',
  whoCanSeeIt: 'Who can see it',
  arrivesFrom: 'Arrives from',
  reachedFromOutside: 'Reached from outside',
  showsOnLoad: 'Shows on load',
}
const CORE_BY_LABEL = {}
for (const [k, v] of Object.entries(CORE)) CORE_BY_LABEL[v.toLowerCase()] = k

const CAP_PURPOSE_LABELS = new Set(["what it's for", 'what its for', 'purpose'])

const DEFECT_LABEL = /^defect\b|^\W*defect\b/i
const DEFECT_EVIDENCE = /\s*[—-]?\s*Evidence:\s*(?<ev>.+)$/i
const DEFECT_EVIDENCE_G = /\s*[—-]?\s*Evidence:\s*(?<ev>.+)$/gi

function pluginVersion() {
  const here = path.resolve(fileURLToPath(import.meta.url))
  let dir = path.dirname(here)
  while (true) {
    const manifest = path.join(dir, '.claude-plugin', 'plugin.json')
    let isFile = false
    try { isFile = fs.statSync(manifest).isFile() } catch { isFile = false }
    if (isFile) {
      try {
        const v = JSON.parse(fs.readFileSync(manifest, 'utf-8')).version
        return v === undefined ? null : v
      } catch { return null }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function normLabel(label) {
  return pyStrip(label.replace(/^[^A-Za-z]+/, '')).toLowerCase()
}

function cites(text) {
  const out = []
  for (const m of text.matchAll(CITE)) {
    const start = parseInt(m.groups.start, 10)
    const end = m.groups.end ? parseInt(m.groups.end, 10) : start
    out.push({ file: m.groups.file.replace(/\\/g, '/'), start, end })
  }
  return out
}

function tables(text) {
  const seen = new Set()
  const out = []
  const ops = [...text.matchAll(OP_WORD)]
  for (let i = 0; i < ops.length; i++) {
    const m = ops[i]
    let op = m.groups.op.toUpperCase()
    op = op.startsWith('READ') ? 'READ' : op
    const opEnd = m.index + m[0].length
    const stop = (i + 1 < ops.length) ? ops[i + 1].index : text.length
    const region = text.slice(opEnd, stop)
    for (const t of region.matchAll(TICKED_NAME)) {
      const name = t.groups.table
      if (name.includes('/') || CODE_SUFFIX.test(name)) continue
      let cols = (t.groups.cols || '').split(',').map(c => pyStrip(c, ' `'))
      cols = cols.filter(c => c && COLUMN_NAME_FULL.test(c))
      const key = name + '\x00' + op
      if (!seen.has(key)) {
        seen.add(key)
        const row = { name, op }
        if (cols.length) row.columns = cols
        out.push(row)
      } else if (cols.length) {
        for (const row of out) {
          if (row.name === name && row.op === op) {
            const existing = row.columns || []
            const merged = existing.concat(cols.filter(c => !existing.includes(c)))
            row.columns = merged
            break
          }
        }
      }
    }
  }
  return out
}

function findallBacktickWord(value) {
  const res = []
  for (const m of value.matchAll(/`(\w+)`/g)) res.push(m[1])
  return res
}

function parsePage(md) {
  const page = { capabilities: [], notes: {}, readOnly: false, defects: [] }
  let cap = null, act = null
  for (const raw of splitlines(md)) {
    const line = pyRstrip(raw)

    let m = H1.exec(line)
    if (m && !('path' in page)) {
      page.path = m.groups.path
      page.title = pyStrip(m.groups.title || '') || null
      continue
    }

    m = CAP.exec(line)
    if (m) {
      cap = { name: pyStrip(m.groups.name), purpose: null, actions: [] }
      page.capabilities.push(cap)
      act = null
      continue
    }

    m = ACT.exec(line)
    if (m) {
      act = { name: pyStrip(m.groups.name), evidence: [], tables: [] }
      if (cap === null) {
        cap = { name: null, actions: [] }
        page.capabilities.push(cap)
      }
      cap.actions.push(act)
      continue
    }

    m = FIELD.exec(line)
    if (m) {
      const label = pyStrip(m.groups.label)
      const value = pyStrip(m.groups.value)
      const flat = normLabel(label)

      if (DEFECT_LABEL.test(flat) || DEFECT_LABEL.test(label)) {
        const ev = DEFECT_EVIDENCE.exec(value)
        page.defects.push({
          text: pyStrip(pyStrip(value.replace(DEFECT_EVIDENCE_G, ''), ' —-')),
          evidence: ev ? cites(ev.groups.ev) : cites(value),
          action: act ? act.name : null,
          capability: cap ? cap.name : null,
        })
        continue
      }

      if (cap !== null && act === null && CAP_PURPOSE_LABELS.has(flat)) {
        cap.purpose = value
        continue
      }

      const key = CORE_BY_LABEL[label.toLowerCase()]
      if (key === 'showsOnLoad') {
        page.showsOnLoad = { text: value, reads: [], evidence: [] }
      } else if (key) {
        page[key] = value
      } else if (label.toLowerCase() === 'capabilities') {
        page.readOnly = value.toLowerCase().startsWith('none')
        page.notes['Capabilities'] = value
      } else {
        page.notes[label] = value
      }
      continue
    }

    m = BULLET.exec(line)
    if (m) {
      const key = m.groups.key.toLowerCase()
      const value = pyStrip(m.groups.value)
      const target = (act !== null) ? act : (page.showsOnLoad ?? null)
      if (target === null || target === undefined) continue
      if (key === 'evidence') {
        setdefault(target, 'evidence', []).push(...cites(value))
        setdefault(target, 'tables', []).push(...tables(value))
        target.evidenceText = value
      } else if (key === 'reads') {
        const lv = value.toLowerCase()
        if (lv !== 'none' && lv !== 'none.' && lv !== 'nothing') {
          setdefault(target, 'reads', []).push(value)
          setdefault(target, 'tables', []).push(
            ...findallBacktickWord(value).map(t => ({ name: t, op: 'READ' }))
          )
        }
      } else if (key === 'what happens') {
        target.whatHappens = value
      } else {
        target[key] = value
      }
    }
  }
  return page
}

const META_TO_APP = {
  data_layers: 'dataLayers',
  schema_tables: 'schemaTables',
  schema_columns: 'schemaColumns',
  scheduled: 'scheduled',
  state_enums: 'stateEnums',
  delete_cascades: 'deleteCascades',
  soft_delete_files: 'softDeleteFiles',
  rls_enabled: 'rlsEnabled',
  rls_policies: 'rlsPolicies',
  tables_without_rls: 'tablesWithoutRls',
  orphan_tables: 'orphanTables',
  env_vars: 'envVars',
  services: 'services',
  global_feedback: 'globalFeedback',
}

const SIGNAL_KEYS = {
  outbound: 'outbound',
  paid_gates: 'paidGates',
  auth: 'auth',
  validation: 'validation',
  live_sync: 'liveSync',
  feedback: 'feedback',
  state_literals: 'stateLiterals',
}
const SIGNAL_CAP = 20

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}
function isFile(p) {
  try { return fs.statSync(p).isFile() } catch { return false }
}

function parseArgs(argv) {
  let mapDir
  let outArg = 'map.json'
  let harvest = null
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-o' || a === '--out') { outArg = argv[++i] }
    else if (a.startsWith('--out=')) { outArg = a.slice('--out='.length) }
    else if (a.startsWith('-o=')) { outArg = a.slice(3) }
    else if (a === '--harvest') { harvest = argv[++i] }
    else if (a.startsWith('--harvest=')) { harvest = a.slice('--harvest='.length) }
    else if (a.startsWith('-') && a !== '-') {
      process.stderr.write(`error: unrecognized arguments: ${a}\n`)
      process.exit(2)
    } else { positionals.push(a) }
  }
  if (positionals.length < 1) {
    process.stderr.write('error: the following arguments are required: map_dir\n')
    process.exit(2)
  }
  mapDir = positionals[0]
  return { map_dir: mapDir, out: outArg, harvest }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const mp = args.map_dir

  const capsF = path.join(mp, '_capabilities.json')
  const pageless = isFile(capsF) ? readJson(capsF) : []

  const routesF = path.join(mp, '_routes.json')
  let routes
  if (isFile(routesF)) {
    routes = readJson(routesF)
  } else if (truthy(pageless)) {
    routes = []
  } else {
    process.stderr.write(
      `${routesF} is missing and no ${path.basename(capsF)} was written.\n` +
      '  Either Phase 1 never ran (enumerate the routes, then re-run this),\n' +
      '  or this repository genuinely has no routes — in which case write\n' +
      '  its surface to map/_capabilities.json (SKILL.md Phase 1b). An empty\n' +
      '  map.json must never be the way we find out the reading did not happen.\n'
    )
    process.exit(1)
  }

  const edgesF = path.join(mp, '_edges.json')
  const edges = isFile(edgesF) ? readJson(edgesF) : []
  const notesF = path.join(mp, '_machine_notes.json')
  const machineNotes = isFile(notesF) ? readJson(notesF) : {}
  const stackF = path.join(mp, '_stack.md')
  const stack = isFile(stackF) ? pyStrip(fs.readFileSync(stackF, 'utf-8')) : null

  const harvestF = args.harvest ? args.harvest : path.join(mp, '_harvest.json')
  const harvest = isFile(harvestF) ? readJson(harvestF) : {}
  const hmeta = (harvest && harvest._meta) ? harvest._meta : {}
  const app = {}
  for (const [key, outKey] of Object.entries(META_TO_APP)) {
    if (truthy(hmeta[key])) app[outKey] = hmeta[key]
  }

  const slug = (p) => {
    let s = p.replace(/^\/+/, '').split('/').join('-')
    for (const ch of [':', '$', '[', ']']) s = s.split(ch).join('')
    return s || 'index'
  }

  const pages = {}
  const unreadablePages = []
  let pageFiles = []
  try {
    pageFiles = fs.readdirSync(path.join(mp, 'pages'))
      .filter(n => n.endsWith('.md') && !n.startsWith('.'))
      .sort()
  } catch { pageFiles = [] }
  for (const name of pageFiles) {
    const p = parsePage(fs.readFileSync(path.join(mp, 'pages', name), 'utf-8'))
    p.pageFile = name
    if (truthy(p.path)) {
      pages[p.path] = p
    } else {
      unreadablePages.push(name)
    }
  }

  const inbound = {}
  for (const e of edges) {
    const to = e.to
    setdefault(inbound, to, []).push({ from: e.from, trigger: e.trigger })
  }

  const outRoutes = []
  const tableIndex = {}
  const invented = {}
  for (const r of routes) {
    const pth = r.path
    const rec = {
      path: pth,
      slug: slug(pth),
      sourceFile: String(r.source_file ?? '').replace(/\\/g, '/'),
      audience: r.audience ?? null,
      authRequired: r.auth_required ?? null,
      layoutChain: r.layout_chain ?? null,
      inbound: (inbound[pth] !== undefined) ? inbound[pth] : [],
      mapped: pth in pages,
    }
    if (r.audience === 'user' && rec.mapped) {
      rec.noInboundEdge = !truthy(rec.inbound)
    }
    if (truthy(r.redirect_to)) {
      rec.redirectTo = r.redirect_to
    }
    if (pth in machineNotes) {
      rec.note = machineNotes[pth]
    }

    const hv = (harvest[pth] !== undefined) ? harvest[pth] : {}
    const signals = {}
    for (const [key, outKey] of Object.entries(SIGNAL_KEYS)) {
      if (truthy(hv[key])) signals[outKey] = hv[key].slice(0, SIGNAL_CAP)
    }
    if (truthy(signals)) rec.signals = signals

    const pg = pages[pth]
    if (pg) {
      for (const k of ['title', 'purpose', 'whoCanSeeIt', 'arrivesFrom',
        'reachedFromOutside', 'showsOnLoad', 'capabilities',
        'readOnly', 'notes', 'pageFile', 'defects']) {
        if (k in pg && present(pg[k])) rec[k] = pg[k]
      }
      for (const label of Object.keys(pg.notes || {})) {
        if (label !== 'Capabilities') setdefault(invented, label, []).push(pth)
      }

      const index = (tbls, writeSide) => {
        for (const t of tbls) {
          const e = setdefault(tableIndex, t.name, { readBy: [], writtenBy: [] })
          const side = (writeSide && t.op !== 'READ') ? 'writtenBy' : 'readBy'
          if (!e[side].includes(pth)) e[side].push(pth)
        }
      }

      index(((pg.showsOnLoad || {}).tables) || [], false)
      for (const c of (pg.capabilities || [])) {
        for (const a of c.actions) index(a.tables || [], true)
      }
    }

    if (truthy(rec.noInboundEdge)) {
      const outside = pyStrip(pyStrip(rec.reachedFromOutside || ''), '"\'')
      rec.externalEntry = outside.toLowerCase().startsWith('none') ? null : (outside || null)
      rec.noWayIn = rec.externalEntry === null
    }
    outRoutes.push(rec)
  }

  const user = outRoutes.filter(r => r.audience === 'user')
  let defects = 0
  for (const r of outRoutes) defects += (r.defects || []).length

  // dict(sorted(table_index.items()))
  const sortedTables = {}
  for (const k of Object.keys(tableIndex).sort()) sortedTables[k] = tableIndex[k]

  let capsWithPurpose = 0
  for (const r of outRoutes) for (const c of (r.capabilities || [])) if (truthy(c.purpose)) capsWithPurpose++
  for (const c of pageless) if (truthy(c.purpose)) capsWithPurpose++

  let totalCaps = 0
  for (const r of outRoutes) totalCaps += (r.capabilities || []).length
  totalCaps += pageless.length

  const doc = {
    schema: 'user-lens-map/3',
    generator: 'emit_map_json.py (reference implementation)',
    generatorVersion: pluginVersion(),
    stack,
    counts: {
      routes: outRoutes.length,
      userFacing: user.length,
      mapped: user.filter(r => r.mapped).length,
      machineOnly: outRoutes.filter(r => r.audience === 'machine').length,
      redirects: outRoutes.filter(r => r.audience === 'redirect').length,
      edges: edges.length,
      tables: Object.keys(tableIndex).length,
      noInboundEdge: user.filter(r => truthy(r.noInboundEdge)).length,
      noWayIn: user.filter(r => truthy(r.noWayIn)).length,
      defects,
      capabilities: totalCaps,
      capabilitiesWithPurpose: capsWithPurpose,
      pagelessCapabilities: pageless.length,
    },
    routes: outRoutes,
    tables: sortedTables,
  }
  if (truthy(pageless)) doc.capabilities = pageless
  if (truthy(app)) doc.app = app

  fs.writeFileSync(args.out, dumps(doc, 2), 'utf-8')

  const c = doc.counts
  print(`wrote ${args.out}: ${c.mapped}/${c.userFacing} user pages mapped, ` +
    `${c.machineOnly} machine, ${c.redirects} redirect, ` +
    `${c.tables} tables`)
  if (truthy(pageless)) {
    print(`  no pages: ${pageless.length} capability/capabilities carry this ` +
      `repository's surface instead`)
    for (const cap of pageless.slice(0, 8)) {
      print(`    ${truthy(cap.name) ? cap.name : '(unnamed)'}` +
        `${truthy(cap.file) ? '  ' + cap.file : ''}`)
    }
  } else if (!truthy(outRoutes)) {
    print('  WARNING: no routes AND no capabilities — this map says the repository')
    print('           has no user-visible surface at all. That is almost never true.')
    print('           If it genuinely has no pages, write its surface to')
    print('           map/_capabilities.json (SKILL.md Phase 1b) rather than shipping')
    print('           an empty map: an empty board is indistinguishable from a')
    print('           reading that never happened.')
  }

  const routePaths = new Set(outRoutes.map(r => r.path))
  const orphans = [...new Set(Object.keys(pages))].filter(p => !routePaths.has(p)).sort()
  if (truthy(orphans) || truthy(unreadablePages)) {
    print('')
    print('WARNING: page file(s) that reached nothing — their capabilities, actions')
    print('         and defects are NOT in this map:')
    for (const pth of orphans) {
      print(`    ${pages[pth].pageFile}  heading says ${pth}, which is not a route`)
    }
    for (const name of unreadablePages) {
      print(`    ${name}  no '# /path — Title' heading to attach it by`)
    }
    print('         Fix the heading to match _routes.json exactly (or the route list),')
    print('         then re-run. A map that silently drops a page is worse than one')
    print('         that refuses.')
  }

  if (truthy(app)) {
    print(`  app-wide: ${Object.keys(app).sort().join(', ')}`)
  } else {
    print(`  WARNING: no harvest read (${harvestF}) — the importer gets pages`)
    print('           and nothing else: no scheduled work, no outbound mail, no')
    print('           record journeys, no delete cascades, no access rules, no keys.')
  }
  print(`  ${c.defects} defect(s); ${c.capabilitiesWithPurpose}/${c.capabilities} ` +
    `capabilities say what they are for`)
  if (c.capabilities && !c.capabilitiesWithPurpose) {
    print('  WARNING: no capability states its purpose — every capability card will')
    print('           arrive on the board with a template sentence and nothing else.')
  }
  print(`  ${c.noInboundEdge} with no internal link, of which ` +
    `${c.noWayIn} have NO way in at all:`)
  for (const r of outRoutes) {
    if (truthy(r.noWayIn)) print(`    ${r.path}`)
  }
  const unmapped = user.filter(r => !r.mapped).map(r => r.path)
  if (truthy(unmapped)) {
    print(`WARNING: ${unmapped.length} user-facing route(s) have no page file: ` +
      unmapped.slice(0, 5).join(', '))
  }
  if (truthy(invented)) {
    print('\nNon-template fields found (the template has no home for these,')
    print('so each run invents a label and an importer keyed on labels loses them):')
    for (const label of Object.keys(invented).sort()) {
      const paths = invented[label]
      print(`  **${label}:**  x${paths.length}  e.g. ${paths[0]}`)
    }
  }
}

export { tables, parsePage, cites }

const isMain = process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) main()
