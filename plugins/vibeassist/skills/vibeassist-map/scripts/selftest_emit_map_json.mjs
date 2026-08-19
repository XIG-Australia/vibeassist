#!/usr/bin/env node
// Self-test for emit_map_json.mjs — the contract an importer consumes.
//
//   node selftest_emit_map_json.mjs
//
// Faithful port of selftest_emit_map_json.py. Same fixtures, same assertions,
// same "ok …" lines and "all checks passed". It runs the emitter via a
// subprocess (node emit_map_json.mjs) exactly as the Python version runs
// python3 emit_map_json.py, and imports `tables` directly for the last block.

import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { tables as _tables } from './emit_map_json.mjs'

const HERE = path.dirname(path.resolve(fileURLToPath(import.meta.url)))

// json.dumps(obj) compact-with-spaces is not needed for the input files: the
// Python fixtures write json.dumps(...) (compact, ", "/": " separators). For
// input files the emitter re-parses, whitespace is irrelevant, so plain
// JSON.stringify is fine here — these are inputs, not the asserted output.
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj), 'utf-8') }

const ROUTES = [
  { path: '/account', source_file: 'src/routes/account.tsx',
    audience: 'user', auth_required: true, layout_chain: [] },
  { path: '/webhooks/stripe', source_file: 'src/routes/wh.ts',
    audience: 'machine', layout_chain: [] },
  { path: '/old-account', source_file: 'src/routes/old-account.tsx',
    audience: 'redirect', redirect_to: '/account', layout_chain: [] },
  { path: '/unread', source_file: 'src/routes/unread.tsx',
    audience: 'user', layout_chain: [] },
]
const EDGES = [{ from: '«global navigation»', to: '/account',
  trigger: 'shared component (AppSidebar)' }]
const HARVEST = {
  '/account': {
    outbound: [{ file: 'src/lib/mail.ts', line: 12, snippet: 'resend.emails.send(' }],
    paid_gates: [{ file: 'src/lib/plan.ts', line: 8, snippet: 'if (!isPro)' }],
  },
  _meta: {
    data_layers: ['supabase'],
    scheduled: [{ name: 'nightly-digest', schedule: '0 3 * * *',
      file: 'supabase/migrations/0001_cron.sql', line: 12 }],
    scheduled_unnamed: 2,
    state_enums: { tasks: ['draft', 'backlog', 'complete'] },
    delete_cascades: [{ references: 'projects', on_delete: 'cascade',
      file: 'supabase/migrations/0001_init.sql', line: 40 }],
    tables_without_rls: ['audit_log'],
    orphan_tables: ['legacy_notes'],
    services: ['Stripe'],
    env_vars: { STRIPE_KEY: { file: 'src/lib/pay.ts', line: 4 } },
    rls_enabled: ['profiles'],
    schema_tables: ['profiles', 'tasks'],
  },
}
const PAGE = `# /account — Account Settings

**Purpose:** Where you manage your personal account details.
**Who can see it:** Signed-in users only.
**Arrives from:** Header avatar menu.
**Reached from outside:** None — internal only.
**Shows on load:** Your profile details.
  - READS: \`profiles\`
  - Evidence: src/routes/account.tsx:14-31

**⚠ Defect worth knowing about:** Saving a name longer than 40 characters fails silently — Evidence: src/lib/profile.ts:22

## Capability: Manage your account
**What it's for:** Everything to do with your own login and details.

### Action: Update your username
- What happens: You type a new name and save.
- Trigger: "Display name" field + "Save changes" button
- Evidence: handler src/components/ProfileForm.tsx:42 → UPDATE \`profiles\`

**⚠ Defect worth knowing about:** The avatar upload button does nothing at all — Evidence: src/components/ProfileForm.tsx:88

### Action: Close your account
- What happens: Your account is closed and your sessions end.
- Trigger: "Close account" button
- Evidence: src/lib/account.ts:10 → READ \`profiles\`, \`public.sessions\` → DELETE \`sessions\`, \`profiles\`
`

const failures = []
const out = process.stdout
function print(line = '') { out.write(line + '\n') }

function check(label, cond, detail = '') {
  if (cond) {
    print(`  ok   ${label}`)
  } else {
    print(`  FAIL ${label} ${detail}`)
    failures.push(label)
  }
}

function mkdtemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'selftest-'))
}
function rmtree(p) {
  fs.rmSync(p, { recursive: true, force: true })
}

// Python !r repr for detail strings.
function pyRepr(v) {
  if (v === null || v === undefined) return 'None'
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
  return String(v)
}

function runEmitter(mp, outPath) {
  return spawnSync('node', [path.join(HERE, 'emit_map_json.mjs'), mp, '-o', outPath],
    { encoding: 'utf-8' })
}

function build(tmp, withHarvest = true) {
  const mp = path.join(tmp, 'map')
  fs.mkdirSync(path.join(mp, 'pages'), { recursive: true })
  writeJson(path.join(mp, '_routes.json'), ROUTES)
  writeJson(path.join(mp, '_edges.json'), EDGES)
  fs.writeFileSync(path.join(mp, '_stack.md'), 'TanStack Start; Supabase.', 'utf-8')
  fs.writeFileSync(path.join(mp, 'pages', 'account.md'), PAGE, 'utf-8')
  if (withHarvest) writeJson(path.join(mp, '_harvest.json'), HARVEST)
  const outFile = path.join(tmp, 'map.json')
  const r = runEmitter(mp, outFile)
  if (r.status !== 0) {
    print(`${r.stdout} ${r.stderr}`)
    throw new Error(`emitter exited ${r.status}`)
  }
  return [JSON.parse(fs.readFileSync(outFile, 'utf-8')), r.stdout]
}

const PAGELESS = [
  { name: 'Map a repository',
    purpose: 'Read a codebase the way its users meet it and produce a map.',
    file: 'plugins/vibeassist/skills/vibeassist-map/SKILL.md',
    actions: [{ name: 'Run the mapper', whatHappens: 'map.json is written' }] },
  { name: 'Review what got built',
    file: 'plugins/vibeassist/skills/vibeassist-review/SKILL.md' },
]

function buildPageless(tmp) {
  const mp = path.join(tmp, 'map')
  fs.mkdirSync(path.join(mp, 'pages'), { recursive: true })
  fs.writeFileSync(path.join(mp, '_stack.md'), 'A Claude Code plugin: skills, no router.', 'utf-8')
  writeJson(path.join(mp, '_capabilities.json'), PAGELESS)
  const outFile = path.join(tmp, 'map.json')
  const r = runEmitter(mp, outFile)
  if (r.status !== 0) {
    print(`${r.stdout} ${r.stderr}`)
    throw new Error(`emitter exited ${r.status}`)
  }
  return [JSON.parse(fs.readFileSync(outFile, 'utf-8')), r.stdout]
}

function main() {
  {
    const td = mkdtemp()
    try {
      const [doc, stdout] = build(td)
      const route = doc.routes.find(r => r.path === '/account')

      print('the app-wide half travels')
      const app = doc.app || {}
      for (const key of ['dataLayers', 'scheduled', 'stateEnums', 'deleteCascades',
        'tablesWithoutRls', 'orphanTables', 'services', 'envVars',
        'rlsEnabled', 'schemaTables']) {
        check(`app.${key}`, key in app)
      }
      check('run says so out loud', stdout.includes('app-wide:'))

      print('a capability says what it is for')
      const cap = route.capabilities[0]
      check('purpose parsed', cap.purpose === 'Everything to do with your own login and details.',
        `got ${pyRepr(cap.purpose)}`)
      check('counted', doc.counts.capabilitiesWithPurpose === 1)

      print('defects are a list, and keep their evidence')
      const d = route.defects || []
      check('BOTH defects survive', d.length === 2, `got ${d.length}`)
      check('evidence split from the sentence',
        d.every(x => truthy(x.evidence) && !x.text.includes('Evidence:')))
      check('attached to what it is about',
        d[1].action === 'Update your username' && d[0].action === null)
      check('counted', doc.counts.defects === 2)

      print('per-page signals, marked as signals not shape')
      const sig = route.signals || {}
      check('outbound', 'outbound' in sig)
      check('paidGates', 'paidGates' in sig)
      check('kept out of capabilities', !JSON.stringify(route.capabilities).includes('signals'))

      print('an Evidence line keeps EVERY table it names')
      let act = null
      for (const c of route.capabilities) for (const a of c.actions) if (a.name === 'Close your account') act = a
      const got = new Set((act.tables).map(t => t.name + '\x00' + t.op))
      check('a second table on the same operation', got.has('public.sessions\x00READ'), setRepr(got))
      check('a schema-qualified name', got.has('public.sessions\x00READ'), setRepr(got))
      check('both sides of the arrow', got.has('sessions\x00DELETE') && got.has('profiles\x00DELETE'), setRepr(got))
      check('the handler symbol is not a table',
        ![...got].some(k => { const n = k.split('\x00')[0]; return n.includes('/') || n.endsWith('.ts') }), setRepr(got))
      check('the data index has it', 'public.sessions' in doc.tables, JSON.stringify(Object.keys(doc.tables).sort()))

      print('nothing is claimed about a page nobody read')
      const unread = doc.routes.find(r => r.path === '/unread')
      check('unmapped', unread.mapped === false)
      check("no 'nothing links here' claim", !('noWayIn' in unread))
      check('no inbound claim either', !('noInboundEdge' in unread))
      check('and the mapped page still gets one', 'noInboundEdge' in route)

      print('a redirect says where it sends you')
      const old = doc.routes.find(r => r.path === '/old-account')
      check('redirectTo travels', old.redirectTo === '/account', old.redirectTo)

      print('the version says what changed')
      check('stamped /3', doc.schema === 'user-lens-map/3', doc.schema)
      check('a repo WITH pages grows no capabilities array', !('capabilities' in doc))
      check('stamps the mapper\'s own version',
        truthy(doc.generatorVersion) && /[0-9]/.test(doc.generatorVersion[0]),
        doc.generatorVersion)

      print('every /1 field is still there')
      for (const key of ['path', 'sourceFile', 'audience', 'authRequired', 'title',
        'purpose', 'whoCanSeeIt', 'arrivesFrom', 'reachedFromOutside',
        'showsOnLoad', 'capabilities', 'readOnly', 'inbound', 'mapped']) {
        check(`route.${key}`, key in route)
      }
      for (const key of ['schema', 'generator', 'stack', 'counts', 'routes', 'tables']) {
        check(`doc.${key}`, key in doc)
      }

      print('a run with no harvest SAYS so rather than looking clean')
      {
        const td2 = mkdtemp()
        try {
          const [doc2, stdout2] = build(td2, false)
          check('warns', stdout2.includes('WARNING: no harvest read'))
          check('no app section invented', !('app' in doc2))
          check('pages still work', doc2.routes[0].capabilities[0].purpose !== null)
        } finally { rmtree(td2) }
      }
    } finally { rmtree(td) }
  }

  print()
  print('a repository that has no pages')
  {
    const td3 = mkdtemp()
    try {
      const [doc3, stdout3] = buildPageless(td3)
      check('capabilities travel', (doc3.capabilities || []).length === 2)
      check('no routes invented', arrEq(doc3.routes, []))
      check('named', doc3.capabilities[0].name === 'Map a repository')
      check('the file it came from survives', doc3.capabilities[0].file.endsWith('SKILL.md'))
      check('counted separately', doc3.counts.pagelessCapabilities === 2)
      check('counted in the total too', doc3.counts.capabilities === 2)
      check('purposes counted', doc3.counts.capabilitiesWithPurpose === 1)
      check('the run says it found no pages', stdout3.includes('no pages:'))
      check('and does not warn about an empty map',
        !stdout3.includes('no user-visible surface at all'))
    } finally { rmtree(td3) }
  }

  print()
  print('a page file that reached nothing is SAID, not swallowed')
  {
    const td5 = mkdtemp()
    try {
      const mp5 = path.join(td5, 'map')
      fs.mkdirSync(path.join(mp5, 'pages'), { recursive: true })
      writeJson(path.join(mp5, '_routes.json'), ROUTES)
      fs.writeFileSync(path.join(mp5, '_stack.md'), 'TanStack Start; Supabase.', 'utf-8')
      fs.writeFileSync(path.join(mp5, 'pages', 'typo.md'),
        PAGE.replace('# /account —', '# /acount —'), 'utf-8')
      const out5 = path.join(td5, 'map.json')
      const r5 = runEmitter(mp5, out5)
      const doc5 = JSON.parse(fs.readFileSync(out5, 'utf-8'))
      check('warns', r5.stdout.includes('page file(s) that reached nothing'), r5.stdout)
      check('names the file', r5.stdout.includes('typo.md'))
      check('says what it does not match', r5.stdout.includes('/acount'))
      check('and it really did lose the work', doc5.counts.capabilities === 0)
      fs.writeFileSync(path.join(mp5, 'pages', 'headless.md'), 'Some notes.\n', 'utf-8')
      const r5b = runEmitter(mp5, out5)
      check('a page with no heading is named too', r5b.stdout.includes('headless.md'))
    } finally { rmtree(td5) }
  }

  print()
  print('no routes AND no capabilities is a reading that did not happen')
  {
    const td4 = mkdtemp()
    try {
      const mp4 = path.join(td4, 'map')
      fs.mkdirSync(path.join(mp4, 'pages'), { recursive: true })
      fs.writeFileSync(path.join(mp4, '_stack.md'), 'A plugin.', 'utf-8')
      const r4 = runEmitter(mp4, path.join(td4, 'map.json'))
      check('refuses rather than writing an empty map', r4.status !== 0, r4.stdout)
      check('says which file is missing', (r4.stderr + r4.stdout).includes('_routes.json'))
      check('says what to do instead', (r4.stderr + r4.stdout).includes('_capabilities.json'))
    } finally { rmtree(td4) }
  }

  print('\nthe columns a page touches survive the emitter')
  const reads = _tables('READS: `profiles` (display_name, email, avatar_url), `notification_prefs`')
  check('columns kept for the table that named them',
    objEq(reads[0], { name: 'profiles', op: 'READ',
      columns: ['display_name', 'email', 'avatar_url'] }), JSON.stringify(reads))
  check("and ABSENT for the one that did not — never an empty list standing " +
    "in for 'we looked and found none'",
    !('columns' in reads[1]), JSON.stringify(reads))
  const wrote = _tables('handler onSave src/x.tsx:42 -> UPDATE `profiles` (display_name)')
  check('evidence lines carry them too', arrEq(wrote[0].columns, ['display_name']), JSON.stringify(wrote))
  const prose = _tables('READS: `orders` (whatever the reader wrote here; not columns)')
  check('prose in the parenthesis is not mistaken for a column',
    !('columns' in prose[0]), JSON.stringify(prose))

  print()
  if (failures.length) {
    print(`FAILED: ${failures.length} — ${failures.join(', ')}`)
    return 1
  }
  print('all checks passed')
  return 0
}

// small helpers used above
function truthy(v) {
  if (v === null || v === undefined || v === false) return false
  if (v === 0 || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}
function arrEq(a, b) { return JSON.stringify(a) === JSON.stringify(b) }
function objEq(a, b) { return JSON.stringify(a) === JSON.stringify(b) }
function setRepr(s) {
  return '{' + [...s].map(k => { const [n, o] = k.split('\x00'); return `(${pyRepr(n)}, ${pyRepr(o)})` }).join(', ') + '}'
}

process.exit(main())
