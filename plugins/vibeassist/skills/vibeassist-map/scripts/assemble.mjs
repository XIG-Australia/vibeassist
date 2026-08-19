#!/usr/bin/env node
// Deterministic MAP.md assembler for vibeassist-map (Phase 5).
// Faithful ESM port of assemble.py — byte-for-byte MAP.md/ONBOARD.md/stdout parity.
//
// Inputs (all produced by earlier phases):
//   map/_stack.md     - REQUIRED. Phase 0 stack summary; becomes the header.
//   map/_routes.json  - route list with path, audience, auth_required.
//   map/_edges.json   - link edges: {"from": ..., "to": ..., "trigger": ...}.
//   map/pages/*.md    - page files named by the canonical slug.
//   --machine-notes   - optional JSON {path: "what fetches this"} for the appendix.
//
// Usage:
//   node scripts/assemble.mjs map/ -o MAP.md [--machine-notes map/_machine_notes.json]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// --- Python-semantics helpers -------------------------------------------------

// Python truthiness: None/False/0/""/[]/{}/set() are falsy.
function pyTruthy(v) {
  if (v === null || v === undefined) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v.length > 0
  if (Array.isArray(v)) return v.length > 0
  if (v instanceof Set) return v.size > 0
  if (v instanceof Map) return v.size > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

// str.strip(chars): strip leading/trailing occurrences of any char in `chars`.
function pyStripChars(s, chars) {
  const set = new Set(chars)
  let i = 0
  let j = s.length
  while (i < j && set.has(s[i])) i++
  while (j > i && set.has(s[j - 1])) j--
  return s.slice(i, j)
}

// str.strip() with no args: strip whitespace both ends.
function pyStrip(s) {
  return s.replace(/^\s+/, '').replace(/\s+$/, '')
}

// str.splitlines(): split on line boundaries, no trailing empty element.
function pySplitlines(s) {
  const res = []
  const re = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g
  let last = 0
  let m
  while ((m = re.exec(s))) {
    res.push(s.slice(last, m.index))
    last = re.lastIndex
  }
  if (last < s.length) res.push(s.slice(last))
  return res
}

// sorted() on strings: compare by code point (BMP-equivalent to UTF-16 units).
function pyCmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}
function sortedStrings(iter) {
  return Array.from(iter).slice().sort(pyCmp)
}
function sortedBy(arr, keyFn) {
  return arr
    .map((x, i) => [x, keyFn(x), i])
    .sort((p, q) => pyCmp(p[1], q[1]) || (p[2] - q[2]))
    .map((p) => p[0])
}

function readText(p) {
  return fs.readFileSync(p, 'utf-8')
}
function isFile(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

// --- regexes ------------------------------------------------------------------

const OP_TABLE = /\b(READS?|INSERT(?:\/UPDATE)?|UPDATE|DELETE)\b[^`\n]*`(\w+)`/g
// PAGE_TITLE is defined in the source but unused; kept for fidelity.
// const PAGE_TITLE = /^#\s+(\S+)\s*[—-]?\s*(.*)$/m

function routeSlug(p) {
  let s = pyStripChars(p, '/')
  s = s.replace(/[:$[\]]/g, '')
  return s.replace(/\//g, '-') || 'index'
}

// --- argparse subset ----------------------------------------------------------

function argError(msg) {
  process.stderr.write(
    'usage: assemble.mjs [-h] [-o OUT] [--machine-notes MACHINE_NOTES] [--harvest HARVEST] map_dir\n'
  )
  process.stderr.write(`assemble.mjs: error: ${msg}\n`)
  process.exit(2)
}

function parseArgs(argv) {
  const args = { map_dir: undefined, out: 'MAP.md', machine_notes: null, harvest: null }
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') {
      process.stdout.write(
        'usage: assemble.mjs [-h] [-o OUT] [--machine-notes MACHINE_NOTES] [--harvest HARVEST] map_dir\n'
      )
      process.exit(0)
    } else if (a === '-o' || a === '--out') {
      args.out = argv[++i]
    } else if (a.startsWith('--out=')) {
      args.out = a.slice('--out='.length)
    } else if (a.startsWith('-o') && a.length > 2) {
      args.out = a.slice(2)
    } else if (a === '--machine-notes') {
      args.machine_notes = argv[++i]
    } else if (a.startsWith('--machine-notes=')) {
      args.machine_notes = a.slice('--machine-notes='.length)
    } else if (a === '--harvest') {
      args.harvest = argv[++i]
    } else if (a.startsWith('--harvest=')) {
      args.harvest = a.slice('--harvest='.length)
    } else if (a.startsWith('-') && a !== '-') {
      argError(`unrecognized arguments: ${a}`)
    } else {
      positionals.push(a)
    }
  }
  if (positionals.length < 1) argError('the following arguments are required: map_dir')
  if (positionals.length > 1) {
    argError(`unrecognized arguments: ${positionals.slice(1).join(' ')}`)
  }
  args.map_dir = positionals[0]
  return args
}

// --- main ---------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2))
  const mp = args.map_dir

  const stackF = path.join(mp, '_stack.md')
  if (!isFile(stackF)) {
    process.stderr.write('ERROR: map/_stack.md is required (Phase 0 output). Write it first.\n')
    process.exit(1)
  }
  let stack = pyStrip(readText(stackF))
  // strip a leading "# Stack" heading if the file supplies one (count=1, case-insensitive)
  stack = stack.replace(/^#{1,6}\s*Stack\s*\n+/i, '')

  let routes = JSON.parse(readText(path.join(mp, '_routes.json')))
  if (routes && !Array.isArray(routes) && typeof routes === 'object') {
    routes = routes.routes ?? []
  }
  let edges = isFile(path.join(mp, '_edges.json'))
    ? JSON.parse(readText(path.join(mp, '_edges.json')))
    : []
  if (edges && !Array.isArray(edges) && typeof edges === 'object') {
    edges = edges.edges ?? []
  }
  const notes = args.machine_notes ? JSON.parse(readText(args.machine_notes)) : {}
  const harvest =
    args.harvest && isFile(args.harvest) ? JSON.parse(readText(args.harvest)) : {}
  const hmeta = harvest._meta ?? {}

  const getA = (r) => (r.audience === undefined ? 'user' : r.audience)
  const user_routes = routes.filter((r) => getA(r) === 'user')
  const machine_routes = routes.filter((r) => r.audience === 'machine')
  const redirect_routes = routes.filter((r) => r.audience === 'redirect')

  const pages_dir = path.join(mp, 'pages')
  const page_files = new Map()
  for (const r of user_routes) {
    const f = path.join(pages_dir, `${routeSlug(r.path)}.md`)
    if (isFile(f)) page_files.set(r.path, f)
  }

  // --- edges indexed by source; global nav separated
  const out_edges = new Map()
  const global_targets = []
  for (const e of edges) {
    const src = e.from ?? ''
    if (src.toLowerCase().includes('global') || src.includes('«')) {
      global_targets.push(e)
    } else {
      if (!out_edges.has(src)) out_edges.set(src, [])
      out_edges.get(src).push(e)
    }
  }

  const L = []
  L.push('# Application map — as a user meets it\n')
  L.push('_Generated by vibeassist-map. Regenerate with the scripts beside it; do not hand-edit._\n')

  // --- coverage table
  L.push('## Coverage — read this before trusting anything below\n')
  L.push('| | |')
  L.push('| --- | --- |')
  L.push(`| User-facing routes | **${user_routes.length}** |`)
  L.push(`| Pages mapped in full | **${page_files.size}** |`)
  L.push(`| Machine-only routes (appendix) | ${machine_routes.length} |`)
  if (pyTruthy(redirect_routes)) {
    L.push(`| Old addresses kept working (appendix) | ${redirect_routes.length} |`)
  }
  L.push(`| Links traced | ${edges.length} |`)
  const missing = user_routes.length - page_files.size
  if (pyTruthy(missing)) {
    L.push(`\n**${missing} user-facing routes are listed but not yet mapped.**`)
  }
  L.push('')

  // --- stack
  L.push('## Stack\n')
  L.push(stack + '\n')

  // --- global navigation
  if (pyTruthy(global_targets)) {
    L.push('## Global navigation (reachable from almost anywhere)\n')
    const best = new Map()
    const rank = (e) => {
      const t = (pyTruthy(e.trigger) ? e.trigger : '').toLowerCase()
      return t.includes('redirect') ? 0 : 1
    }
    for (const e of global_targets) {
      const k = e.to ?? '?'
      if (!best.has(k) || rank(e) > rank(best.get(k))) best.set(k, e)
    }
    for (const k of sortedStrings(best.keys())) {
      const e = best.get(k)
      const trig = pyTruthy(e.trigger) ? ` — ${e.trigger}` : ''
      L.push(`- \`${k}\`${trig}`)
    }
    L.push('')
  }

  // --- sitemap
  L.push('## Sitemap\n')
  const groups = [
    ['Open to anyone', user_routes.filter((r) => !pyTruthy(r.auth_required))],
    ['Behind a sign-in', user_routes.filter((r) => pyTruthy(r.auth_required))],
  ]
  for (const [title, group] of groups) {
    if (!pyTruthy(group)) continue
    L.push(`### ${title}\n`)
    for (const r of sortedBy(group, (x) => x.path)) {
      const mark = page_files.has(r.path) ? ' **← mapped**' : ''
      L.push(`- \`${r.path}\`${mark}`)
      const oe = out_edges.get(r.path) || []
      for (const e of sortedBy(oe, (x) => x.to ?? '')) {
        const trig = pyTruthy(e.trigger) ? ` (${e.trigger})` : ''
        L.push(`  - → \`${e.to ?? '?'}\`${trig}`)
      }
    }
    L.push('')
  }

  // --- pages, in _routes.json order
  L.push('---\n\n# Pages\n')
  const tables = new Map() // table -> {reads:Set, writes:Set}
  const tget = (t) => {
    if (!tables.has(t)) tables.set(t, { reads: new Set(), writes: new Set() })
    return tables.get(t)
  }
  for (const r of user_routes) {
    const f = page_files.get(r.path)
    if (!f) continue
    const body = pyStrip(readText(f))
    L.push(body + '\n\n---\n')
    for (const line of pySplitlines(body)) {
      if (!line.includes('Evidence:') && !line.includes('READS:')) continue
      for (const m of line.matchAll(OP_TABLE)) {
        const op = m[1]
        const table = m[2]
        const bucket = op.toUpperCase().startsWith('READ') ? 'reads' : 'writes'
        tget(table)[bucket].add(r.path)
        if (op === 'INSERT/UPDATE') tget(table).writes.add(r.path)
      }
    }
  }

  // --- data appendix
  if (pyTruthy(tables)) {
    L.push('# Data appendix — each table, who reads it, who writes it\n')
    L.push('| Table | Read by | Written by |')
    L.push('| --- | --- | --- |')
    for (const t of sortedStrings(tables.keys())) {
      const rd =
        sortedStrings(tables.get(t).reads)
          .map((p) => `\`${p}\``)
          .join(', ') || '—'
      const wr =
        sortedStrings(tables.get(t).writes)
          .map((p) => `\`${p}\``)
          .join(', ') || '—'
      L.push(`| \`${t}\` | ${rd} | ${wr} |`)
    }
    L.push('')
  }

  // --- FINDINGS
  if (pyTruthy(harvest)) {
    const findings = []
    const linked = new Set(edges.map((e) => e.to))
    for (const r of user_routes) {
      if (r.path !== '/' && !linked.has(r.path) && !pyTruthy(r.not_found)) {
        findings.push(
          `**Nothing links to \`${r.path}\`** — dead surface, unless it is reached from outside (check the page's own entry).`
        )
      }
    }
    for (const t of hmeta.orphan_tables ?? []) {
      findings.push(
        `**Table \`${t}\` exists but no page touches it** — forgotten work, or accessed by something this map cannot see.`
      )
    }
    for (const t of hmeta.tables_without_rls ?? []) {
      findings.push(
        `**Table \`${t}\` has no row-level security enabled** — any signed-in client may be able to read or write it directly.`
      )
    }
    for (const r of user_routes) {
      const hv = harvest[r.path] ?? {}
      const writes = (hv.db ?? []).filter((d) => {
        const op = d.op
        return !(op === null || op === undefined || op === 'READ' || op === 'READ?')
      })
      if (pyTruthy(writes) && !pyTruthy(hv.feedback) && !pyTruthy(hmeta.global_feedback)) {
        findings.push(
          `**\`${r.path}\` writes data but no user feedback was found on it (and no global handler exists)** — a failed save here may be silent.`
        )
      }
      const dng = hv.dangerous ?? []
      if (pyTruthy(dng) && !pyTruthy(hv.has_confirm_pattern)) {
        const kinds = sortedStrings(new Set(dng.map((d) => d.kind))).join(', ')
        findings.push(
          `**\`${r.path}\` can ${kinds} — and no confirmation step was found.** One mis-tap is irreversible.`
        )
      }
    }
    if (pyTruthy(findings)) {
      L.push('# Findings — things that look wrong\n')
      L.push(
        '_Computed from the scan; each was verified against the code before publishing. If one is intentional, say so here rather than deleting it._\n'
      )
      for (const x of findings) L.push(`- ${x}`)
      L.push('')
    }
  }

  // --- global feedback machinery
  if (pyTruthy(hmeta.global_feedback)) {
    L.push('# When things go wrong (how this app talks back)\n')
    L.push(
      '_The shared machinery that shows errors, progress, and sync state — wired once, applies app-wide. Pages say "standard error handling" and mean this._\n'
    )
    const seen_gf = new Set()
    for (const g of hmeta.global_feedback) {
      const k = g.what
      if (seen_gf.has(k)) continue
      seen_gf.add(k)
      L.push(`- \`${k}\` — ${g.file}:${g.line}`)
    }
    L.push('')
  }

  // --- what runs on its own
  if (pyTruthy(hmeta.scheduled)) {
    L.push('# What runs on its own (no user present)\n')
    for (const s2 of hmeta.scheduled.slice(0, 20)) {
      L.push(`- ${pyStrip(s2.snippet).slice(0, 100)} — ${s2.file}:${s2.line}`)
    }
    L.push('')
  }

  // --- messages the app sends
  const outbound_all = pyTruthy(harvest)
    ? user_routes.flatMap((r) => (harvest[r.path]?.outbound ?? []).map((o) => [r.path, o]))
    : []
  if (pyTruthy(outbound_all)) {
    L.push('# Messages the app sends out\n')
    const seen_ob = new Set()
    for (const [p, o] of outbound_all) {
      const k = `${o.file} ${o.line}`
      if (seen_ob.has(k)) continue
      seen_ob.add(k)
      L.push(`- from \`${p}\`: ${o.snippet.slice(0, 90)} — ${o.file}:${o.line}`)
    }
    L.push('')
  }

  // --- record journeys
  if (pyTruthy(hmeta.state_enums)) {
    L.push('# Record journeys — the states things move through\n')
    const entries = sortedBy(Object.keys(hmeta.state_enums), (k) => k)
    for (const name of entries) {
      const vals = hmeta.state_enums[name]
      L.push(`- \`${name}\`: ${vals.join(' → ')}`)
    }
    L.push('_Order shown is declaration order; confirm real transitions in the page writeups._\n')
  }

  // --- delete consequences
  if (pyTruthy(hmeta.delete_cascades) || pyTruthy(hmeta.soft_delete_files)) {
    L.push('# What dies when you delete\n')
    const by_ref = new Map()
    for (const c of hmeta.delete_cascades ?? []) {
      if (!by_ref.has(c.references)) by_ref.set(c.references, [])
      by_ref.get(c.references).push(c)
    }
    for (const ref of sortedStrings(by_ref.keys())) {
      const kinds = new Set(by_ref.get(ref).map((c) => c.on_delete))
      L.push(
        `- deleting from \`${ref}\`: ${by_ref.get(ref).length} dependent table(s) — ${sortedStrings(kinds).join(', ')}`
      )
    }
    if (pyTruthy(hmeta.soft_delete_files)) {
      L.push(
        `- soft delete in use (\`deleted_at\`) — rows are hidden, not destroyed (${hmeta.soft_delete_files.length} migration file(s))`
      )
    }
    L.push('')
  }

  // --- getting in and staying in
  const auth_all = pyTruthy(harvest)
    ? user_routes.flatMap((r) => (harvest[r.path]?.auth ?? []).map((x) => [r.path, x]))
    : []
  if (pyTruthy(auth_all)) {
    L.push('# Getting in and staying in (sign-in journey)\n')
    const seen_au = new Set()
    for (const [p, x] of auth_all.slice(0, 25)) {
      const k = `${x.file} ${x.line}`
      if (seen_au.has(k)) continue
      seen_au.add(k)
      L.push(`- \`${p}\`: ${x.snippet.slice(0, 90)} — ${x.file}:${x.line}`)
    }
    L.push('')
  }

  // --- free vs paid
  const gates_all = pyTruthy(harvest)
    ? user_routes.flatMap((r) => (harvest[r.path]?.paid_gates ?? []).map((x) => [r.path, x]))
    : []
  if (pyTruthy(gates_all)) {
    L.push('# Free vs paid — where the app draws the line\n')
    const seen_pg = new Set()
    for (const [p, x] of gates_all.slice(0, 25)) {
      const k = `${x.file} ${x.line}`
      if (seen_pg.has(k)) continue
      seen_pg.add(k)
      L.push(`- \`${p}\`: ${x.snippet.slice(0, 90)} — ${x.file}:${x.line}`)
    }
    L.push('')
  }

  // --- who's allowed to do what
  if (pyTruthy(hmeta.rls_policies) || pyTruthy(hmeta.rls_enabled)) {
    L.push("# Who's allowed to do what (database rules)\n")
    const by_table = new Map()
    for (const p of hmeta.rls_policies ?? []) {
      if (!by_table.has(p.table)) by_table.set(p.table, [])
      by_table.get(p.table).push(p)
    }
    const rls_enabled = hmeta.rls_enabled ?? []
    const union = new Set([...rls_enabled, ...by_table.keys()])
    for (const t of sortedStrings(union)) {
      L.push(`### \`${t}\``)
      if (!rls_enabled.includes(t)) {
        L.push('- ⚠ policies exist but row-level security is NOT enabled — the policies do nothing')
      }
      for (const p of sortedBy(by_table.get(t) ?? [], (x) => x.action)) {
        L.push(`- ${p.action}: "${p.policy}" (applies to ${p.roles})`)
      }
      if (!pyTruthy(by_table.get(t))) {
        L.push(
          '- row-level security enabled, no policies found — nobody can touch this table from the client'
        )
      }
      L.push('')
    }
  }

  // --- keys & services
  if (pyTruthy(hmeta.services) || pyTruthy(hmeta.env_vars)) {
    L.push('# Keys & services — what you need to run this app\n')
    for (const s of hmeta.services ?? []) {
      L.push(`- ${s}`)
    }
    const ev = hmeta.env_vars ?? {}
    if (pyTruthy(ev)) {
      L.push('\nEnvironment variables the code expects:\n')
      for (const name of sortedStrings(Object.keys(ev))) {
        L.push(`- \`${name}\` (first used ${ev[name].file}:${ev[name].line})`)
      }
    }
    L.push('')
  }

  // --- redirect appendix
  if (pyTruthy(redirect_routes)) {
    L.push('# Old addresses that still work (you are sent onward)\n')
    for (const r of sortedBy(redirect_routes, (x) => x.path)) {
      const dest = r.redirect_to
      const fallback = pyTruthy(dest)
        ? `an old address, kept working — sends you to \`${dest}\``
        : 'an old address, kept working — sends you onward'
      const nv = notes[r.path]
      const note = pyTruthy(nv) ? nv : fallback
      L.push(`- \`${r.path}\` — ${note}`)
    }
    L.push('')
  }

  // --- full database shape
  if (pyTruthy(hmeta.schema_columns)) {
    L.push('# Full database shape (for rebuilding, not reading)\n')
    for (const t of sortedStrings(Object.keys(hmeta.schema_columns))) {
      L.push(`### \`${t}\``)
      L.push(hmeta.schema_columns[t].map((c) => `\`${c}\``).join(', '))
      L.push('')
    }
  }

  // --- machine-only appendix
  if (pyTruthy(machine_routes)) {
    L.push('# Machine-only routes (no person opens these)\n')
    for (const r of sortedBy(machine_routes, (x) => x.path)) {
      const nv = notes[r.path]
      const note = nv === undefined ? '(add a one-line note: what fetches this?)' : nv
      L.push(`- \`${r.path}\` — ${note}`)
    }
    L.push('')
  }

  fs.writeFileSync(args.out, L.join('\n'), 'utf-8')

  // --- ONBOARD.md
  const O = []
  O.push('# Read this first — taking over this app\n')
  O.push(
    '_Day-one snapshot generated at import. The app maintains the living version; if this file looks stale, trust the app._\n'
  )
  O.push('## What this is')
  O.push(stack + '\n')
  O.push('## State of the map')
  O.push(
    `- ${user_routes.length} pages a person can open; ${page_files.size} mapped in full` +
      (page_files.size === user_routes.length
        ? ''
        : ` — **${user_routes.length - page_files.size} still unmapped**`)
  )
  O.push(`- ${tables.size} database tables traced to the pages that touch them`)
  if (pyTruthy(hmeta.data_layers)) {
    O.push(`- Talks to its database via: ${hmeta.data_layers.join(', ')}`)
  }
  O.push('')
  if (pyTruthy(harvest)) {
    const nf = L.filter((l) => l.startsWith('- **')).length
    if (pyTruthy(nf)) {
      O.push('## Things that look wrong (verify before touching)')
      O.push(
        `${nf} findings — dead surface, untouched tables, missing security rules, unconfirmed destructive actions. Full list in MAP.md under Findings.\n`
      )
    }
  }
  if (pyTruthy(hmeta.services) || pyTruthy(hmeta.env_vars)) {
    O.push('## To run this app you need')
    for (const s of hmeta.services ?? []) {
      O.push(`- ${s}`)
    }
    if (pyTruthy(hmeta.env_vars)) {
      O.push(
        `- ${Object.keys(hmeta.env_vars).length} secret keys / environment variables (named in MAP.md under Keys & services)`
      )
    }
    O.push('')
  }
  O.push('## Where to go next')
  O.push('- MAP.md — every page, what it does in plain language, and the evidence')
  O.push('- The data appendix in MAP.md — per table: who reads it, who writes it')
  O.push("- map/pages/ — one file per page if you only need one page's story")
  const onboard = path.join(path.dirname(args.out), 'ONBOARD.md')
  fs.writeFileSync(onboard, O.join('\n'), 'utf-8')

  const nfind = L.filter((l) => l.startsWith('- **')).length
  process.stdout.write(
    `assembled ${args.out}: ${page_files.size}/${user_routes.length} pages, ` +
      `${tables.size} tables in appendix, ${machine_routes.length} machine routes` +
      (pyTruthy(harvest) ? `, ${nfind} findings` : '') +
      ' + ONBOARD.md\n'
  )
}

// Guard: run only when executed directly.
const __invoked = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (__invoked) {
  main()
}

export { main }
