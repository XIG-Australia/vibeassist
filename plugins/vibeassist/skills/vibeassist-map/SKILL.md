---
name: vibeassist-map
description: Map a codebase from the user's perspective - a sitemap of pages and how they link, what each page lets a person do (in plain language), the actions available on each page, and which database tables each action reads or writes. Use this whenever the user asks to "understand this app", "map this codebase", "document what this app does", "import this codebase", "create a sitemap from code", or wants a functional spec of an existing application - even if they don't say "map" explicitly. Do NOT produce developer-architecture docs (modules, dependencies, layers) when this skill triggers; the output must be readable by a non-technical person.
---

<!-- vibeassist-skill-version: 0.30.1 (single-sourced from plugins/vibeassist/.claude-plugin/plugin.json — keep them in step) -->
<!-- 0.19.2 (21 Aug 2026): the mapper reads a Windows checkout. The JSONC stripper no longer treats /* inside a JSON string as a comment, so a "#/*" path alias survives; repoContains and the node_modules test compare on one separator, so files stop reading as outside the repo. -->
<!-- 0.13.0 (18 Aug 2026): the map toolchain ported from Python to node ESM (harvest, both route enumerators, gen_edges, assemble, check_evidence, emit_map_json, tree_from_map, nav_edges, index_calls and both selftests) - byte-for-byte identical to the Python, so the mapper runs where there is no Python. Skill invocations and CI now call node. -->

# VibeAssist codebase map

Produce a functional map of an application as its *users* experience it. The reader is a product owner, not a developer. Code identifiers are evidence, never explanation.

**The bar for done:** a competent builder who has NEVER seen this codebase could rebuild the app from the map alone and it would *function and operate the same* — different look, identical behavior. Every choice below serves that test. When unsure whether a detail belongs in the map, ask: would the rebuild behave differently without it? Yes → it goes in.

## The core rule (read this twice)

Every page and action gets described at THREE levels, in this order:

1. **User language** — what a person can do here ("Manage your account", "Reset password"). No function names, no component names, no variable names. Write it like a help-center article. If a sentence contains camelCase or snake_case, it is wrong.
2. **Trigger** — the visible UI element ("'Save changes' button", "email field + submit").
3. **Evidence** — the technical trace: handler → server function/endpoint → database tables, each with `file:line` citations.

Levels 1 and 2 are the deliverable. Level 3 exists so claims can be verified. Never let level-3 vocabulary leak upward into levels 1-2.

## Workflow (phases must run in this order)

### Phase 0 — Detect the stack

Identify: router type (file-based? config-based? none?), data layer, and where server-side logic lives. The harvester DETECTS the data layer from evidence (package.json deps and schema files — Supabase/Knex, Prisma, Drizzle, Firestore, Mongoose, raw SQL) and reads the real table list from the schema where one exists (`schema.prisma`, Drizzle `pgTable` modules, `supabase/migrations/*.sql`) into `_harvest.json`'s `_meta`. Record the detected layer in `_stack.md` and sanity-check it against what you see in the code. Answer one question explicitly, in writing, before anything else: **how does a page reach the database — directly, or through a server layer?** (e.g. "a page rarely touches a table itself — it calls a server function in `src/lib/*.functions.ts` that does"). That one sentence shapes every trace in Phase 3. Write findings to `map/_stack.md` — this file is REQUIRED: the Phase 5 assembler reads it for the MAP.md header and refuses to run without it.

### Phase 1 — Enumerate pages DETERMINISTICALLY, then triage

Do not decide from memory what pages exist. Extract the route list mechanically:

- File-based routing (TanStack Start; Next-style trees for simple cases): run the bundled enumerator — `node scripts/routes_file_based.mjs --repo-root . -o map/_routes.json`. It flattens dot-nesting, honors trailing-underscore un-nesting and `[.]` literal dots, drops pure layouts, keeps redirect stubs as `audience: "redirect"` (reading the destination from the code), and applies the structural machine-only test. For SvelteKit/Remix conventions it does not know, enumerate by hand on the same rules.
- Config-based routing: for react-router (Lovable's default), run the bundled parser — `node scripts/routes_react_router.mjs --repo-root . -o map/_routes.json`. It composes nested relative paths, treats `<Route index>` as the parent's path, applies the layout guard to element-less container routes, maps `<Navigate to>` to `audience: "redirect"`, flags `path="*"` as the not-found page, and resolves components (including `lazy()` imports) to source files through path aliases. For other config routers (Vue Router, Express views), parse the registration file(s) by hand on the same rules.

**Guard: a file whose segments are ALL layout segments is not a route — it is the layout itself. Drop it.** Otherwise it reduces to the empty path, collides with the home page, and every table the layout's own imports touch gets falsely attributed to the front door.

Then **triage every route into one of three lists**:

- **user-facing** — a person opens it in a browser and stays.
- **redirect** — a person hits it, but is immediately sent elsewhere. Detected by `throw redirect(`, `Response.redirect`, or a 3xx return in the route file. These are usually old addresses kept alive so bookmarks and old links don't 404 — real user-facing behavior a product owner wants to know about. Record `redirect_to` when it's readable.
- **machine-only** — only another computer ever requests it.

The reliable first test is structural: **does the route declare a rendered component at all?** But "no component" has TWO causes, and only one is machine-only: a handler returning JSON/XML to a program is machine-only; a route that throws a redirect is a person arriving via an old link. Check for the redirect before concluding machine. Fall back to naming conventions (`.well-known/*`, `sitemap*`, `robots*`, `*webhook*`, `*callback*`, feeds, health checks) only when the structure is ambiguous.

Coverage requirement: **100% of user-facing routes get full page files.** Machine-only and redirect routes are NEVER given full page files — each gets one line in its own appendix section: machine-only as "`/webhooks/stripe` — receives payment events from Stripe", redirects as "`/old/path` — an old address, kept working — sends you to `/new/path`". Do not drop either silently; hiding real surface area is how maps lie.

Output `map/_routes.json`: one entry per route with `path`, `source_file`, `layout_chain`, `auth_required` (from middleware/guards if detectable), `audience` (`user` | `machine` | `redirect`), `redirect_to` (for redirects, when readable).

### Phase 1b — When the repository has NO pages (skip if Phase 1 found routes)

Everything above this line assumes the thing you are reading is an app with screens. Some repositories are not. A **plugin** is skills and a manifest. A **library** is exported functions. A **CLI** is commands. An **MCP server** is tools another program calls. None of them has a router, a route, or anywhere a person can be.

Until now this skill had one slot for user-visible surface — a route — and every phase demanded pages. So a reading of the VibeAssist plugin did the only thing the shape allowed and filed each of its four skills as a page:

> "the plug-in is placing asks at the page level but the plug-in does not have any pages"

That was not a careless reading. **A format with one slot gets everything put in that slot.** This is the second slot.

**The test:** can a person *go* there? A page is somewhere you are. A skill you invoke, a command you run, a function you import, a tool another program calls — you do not go to any of them, you *use* them. If Phase 1 found no routes and this repository still plainly does something for somebody, its surface is capabilities, not pages.

**Do NOT reach for this to avoid work.** If the repository has pages, its capabilities belong on them, exactly as Phase 3 says. This is only for surface that genuinely has no address. A repository with both keeps its pages and lists only the address-less part here.

Enumerate deterministically, the same discipline as Phase 1 — from the manifest, the exports, the command registration, the tool list. Not from memory, and not from the README's marketing copy.

Write `map/_capabilities.json`: a list of

```json
{ "name": "Map a repository",
  "purpose": "Read a codebase the way its users meet it and produce a map.",
  "file": "plugins/vibeassist/skills/vibeassist-map/SKILL.md",
  "actions": [{ "name": "Run the mapper",
                "whatHappens": "map.json and MAP.md are written",
                "trigger": "the user asks to map a codebase",
                "tables": [] }] }
```

Same rules as a capability anywhere else. `name` is user language. **`purpose` is the one line saying what a person achieves** — without it the card arrives on the owner's board with a template sentence and nothing to agree or correct, which is the "very thin" complaint that got `purpose` added in the first place. `file` is where it lives, so the card can be checked against something.

Then **skip Phases 2 and 3** and go to Phase 5, which picks `_capabilities.json` up automatically.

**Phase 4 still runs — in capability mode.** It used to be skipped, because `check_evidence.mjs` reads `map/pages/` and there are none, so it exited with an error on a perfectly good reading of a plugin. Point it at the capabilities instead:

```bash
node scripts/check_evidence.mjs map/pages/ --capabilities map/_capabilities.json
```

(It finds `_capabilities.json` beside the pages directory on its own, so the bare Phase 4 command works too.) It checks the half a machine can check: every capability has a name, and names a file that exists.

**The other half is still yours, by hand.** A file existing is not the claim; what you wrote about it is. Before you finish, re-read each capability's source and confirm what you wrote is what is there. Say in your feedback that you verified by hand and how many you checked — a run that skipped the only verification step must not read like one that passed it.

**Both files missing is a failure, not an empty map.** If Phase 1 wrote no `_routes.json` and you write no `_capabilities.json`, the emitter refuses rather than producing an empty map. That is deliberate: an empty board and a reading that never happened look identical to the person receiving it, and the second must never be printed as the first.

### Phase 2 — Map page linkage (navigation lives in THREE places)

Only the first is in the route file:

1. **Links inside the page itself** — grep the route file for `<Link>`, `navigate(`, `router.push`, `redirect(`, `href=`.
2. **Shared chrome** — sidebar, header, footer, tab rails. These components are usually NOT the route file and NOT a layout in the router's sense. Find them (they render on many pages) and scan them. Attribute their edges to `«global navigation»` rather than to any single page, because they reach most of the app from anywhere.
3. **Config arrays** — rails and tab strips are usually built by mapping over a list like `const NAV = [{ to: "/settings/ai", label: … }]`, so there is no literal `<Link to="…">` to find. Grep for route-path string literals across the whole `src/` tree, not just for Link components.
4. **Computed paths** — a rail may build its target from a list: ``to: `/products/${p.slug}` ``. The finished address never appears as a literal anywhere in the source, so no string search can find it. Take the **fixed prefix before the first `${`**, normalize its parameters, and treat every known route beneath that prefix as reached from this rail. Record the trigger as "rail built from a list" so the reader knows the edge was inferred from structure rather than read from a literal. (Watch the character class when writing the prefix pattern: the prefix itself often contains a `$` — `/projects/$projectId/…` — so a pattern that excludes `$` matches nothing.)

**Normalize route-parameter syntax before matching links to routes.** Frameworks write the same placeholder four ways: `$projectId` (TanStack), `[projectId]` (Next), `:projectId` (React Router/Rails-ish), `${…}` (template literals). Convert both sides to one canonical form (e.g. `:param`) before comparing, or every dynamic route will falsely appear unreachable.

Also record programmatic redirects (post-login, post-submit).

**A route with no inbound edge is a CLAIM, not an observation.** Before reporting one, confirm you checked all three places above. Routes genuinely without internal links usually have an external entry instead — see **Reached from outside** in the template.

Run the bundled edge builder — `node scripts/gen_edges.mjs map/_routes.json --repo-root . -o map/_edges.json`. It scans ALL of `src/` for literal links (normalizing parameter syntax on both sides), attributes edges to the page when the file is a route's own file and to `«global navigation»` otherwise, records automatic redirects, and infers computed rails from template literals (the fixed prefix before the first `${`). Its "NO INBOUND" list at the end is the claim to check, not the conclusion to publish.

### Phase 3 — Per-page deep pass (ONE page per pass, in reach order)

**First, run the bundled harvester once for the whole app:**

```bash
node scripts/harvest.mjs map/_routes.json --repo-root . -o map/_harvest.json
```

For each route it resolves the route file plus imports two levels deep — relative imports AND path aliases (read from `tsconfig.json`/`jsconfig.json` `compilerOptions.paths`, falling back to `@/` → `src/`), including `export … from` re-exports and dynamic `import(…)` — then extracts with line numbers: interactive elements, server function declarations, and every database call tagged READ / INSERT / UPDATE / DELETE. Phase 3 then writes user language *from* `_harvest.json` instead of grepping ad hoc per page — you have the line number in front of you before you write the sentence, which is what makes honest citation cheap. (The harvester is regex-based and will miss unusual patterns; anything you find by reading that it missed, cite normally.)

**`_harvest.json` is a list of CANDIDATES, not a list of claims.** Two levels of imports through shared chrome will offer a page far more tables than it touches — a dashboard resolving 45 files may be offered 23 tables while truly touching 8. Use the harvest to find the line, then confirm the call is on a path the page's own controls actually trigger before writing the claim. A citation can be real and the claim still false — the checker verifies the line, not the reachability, so this class of error is yours to catch in prose. Rough smell test: a page offered more than about ten tables is almost certainly inheriting them from shared components; narrow it by hand.

**Sanity-check the harvest before writing anything.** The harvester enforces the dangerous half itself: if controls were found but the data layer is unrecognised, it REFUSES (exit 3) rather than blessing a map that would falsely claim no page touches data — tell it the layer or add an adapter, never work around the refusal. If it instead warns that everything is empty (no controls either), imports aren't resolving — almost always a path alias it does not know about. Fix that first. Writing pages from an empty harvest produces pages that claim nothing touches any data, which is worse than no map: it is a confident wrong answer.

**Page-file naming (the assembler depends on it):** slug = route path with the leading slash stripped, `/` replaced by `-`, and parameter markers (`:`, `$`, `[`, `]`) dropped; the root `/` is `index`. The harvester emits this slug per route in `_harvest.json` — use it, so both ends agree.

Process each user-facing route in its own focused pass — do not batch pages, or depth becomes inconsistent.

**Order matters because runs get cut short.** Map in this sequence, so a partial run is still a useful map (what's missing is the least-visited part, not a random half):

1. Entry pages: `/`, auth, pricing, anything public.
2. The pages `«global navigation»` links to (the everyday surface).
3. Interior pages, by distance from the entries.

If you cannot finish, stop at a page boundary and state coverage in the MAP.md header. **Never reduce depth to increase count** — a shallow page is worse than a missing one, because a missing page is honest.

For each page:

1. Read the route file and every component it renders (follow imports as deep as needed to reach the handler — depth is set by where the logic lives, which you learned in Phase 0).
2. Inventory every interactive element: buttons, forms, toggles, links that mutate state, drag targets, keyboard shortcuts.
   Then inventory what the page tells the user WITHOUT being asked — the passive layer: error toasts, sync/offline banners, retry behavior, live-updating regions. The harvest's `feedback` and `live_sync` candidates point at these; they have no trigger element, which is exactly why earlier maps missed them.
   The harvest also carries per-page candidates for the other invisible layers — `validation` (what a form will refuse and why), `auth` (sign-in/session behavior on this page), `paid_gates` (where free stops), `outbound` (messages this page's actions cause to be sent), `state_literals` (status values this page moves records into). Same candidates-not-claims discipline: confirm each on a path the page's controls actually reach, then write it in user language. Repo-wide layers (scheduled work, record state enums, delete cascades) land in `_meta` and become their own MAP sections via the assembler — read them in Phase 0 so page writeups can reference the journeys records take.
3. For each element, trace: handler → client mutation/query → server function or API endpoint → database statements → tables and columns touched, and whether it's a READ, INSERT, UPDATE, or DELETE.
   **And state the RULES the trace passes through.** Wherever the path branches, calculates, or filters — a condition that gates the write, a formula that produces the number, an ordering rule — the action's writeup must state that rule in user terms ("a task counts as buildable when it has an agreed shape and no open questions"; "the total is hours × rate, rounded up to the half hour"). A rule you cannot state plainly is an action you have not finished tracing — and it is the first thing a rebuild gets wrong.
4. Group actions into capabilities (noun-phrases a user would recognize: "Manage your account"), and give each ONE LINE saying what it is for — what a person achieves by using it, not a restatement of its name. A capability travels to the owner's board as a card of its own, and without that line the card arrives with no words on it: "they do seem to be in there, but very thin." Typical pages have 1-7. **Zero is a valid answer** — a policy page you only read has no capabilities, and saying so is correct. Never invent a capability to fill the section; that is how a map starts lying.
5. Note what the page displays on load (which tables are READ to render it).

Save as `map/pages/<route-slug>.md`.

### Phase 4 — Verify (evidence gate; run the checker, don't intend it)

Run the bundled checker:

```bash
node scripts/check_evidence.mjs map/pages/
```

It extracts every `file:line` citation, asserts the file exists, the line range is in bounds, AND that the cited range actually contains the symbols/tables named in the Evidence line. Existence alone is not enough — a citation can point at a real file and the wrong line.

**It also fails an Action that carries NO Evidence line at all.** It used to read only lines containing "Evidence:", so a missing citation was the one shape the gate could not see — while the quality bar below claimed every action has one. An action with nothing behind it is traced or deleted; those are the two honest endings.

**A failed check means RE-TRACE, not soften.** Do not reword a failing claim until it is vague enough to be safe — that produces exactly the useless output this skill exists to prevent. Re-read the code and fix the citation, or delete the claim. Anything you cannot re-verify gets an explicit `⚠ UNVERIFIED` marker — the checker honours that marker, counts those lines separately and prints them, so an unverified claim is a stated cost rather than a hidden one. (It used to fail them anyway, which left this paragraph's own escape hatch leading nowhere.) Report the count in your feedback.

Practical tip: grep for the line number BEFORE writing each Evidence line, not after. Cite what you found, don't find what you cited.

Process rule: if the checker fails in a way you believe is the checker's fault, you may fix the script to unblock the run — but **report the fix and the failing case in your feedback**, and never edit a script to make a claim of yours pass. A gate you widened is not a gate. State which version of the scripts the run used.

Authoring gotcha: **never backtick a file name on an Evidence line.** Backticks mark symbols the checker must find inside the cited range, and a file does not contain its own name. Cite paths bare — the citation pattern picks them up anyway.

### Phase 5 — Assemble

Run the bundled assembler — never write MAP.md freehand, or the map changes shape depending on which session assembled it:

```bash
node scripts/assemble.mjs map/ -o MAP.md --harvest map/_harvest.json [--machine-notes map/_machine_notes.json]
```

It produces: a coverage table with counts read from the JSON (never typed); the stack summary from `_stack.md`; the `«global navigation»` set listed once instead of repeated on every page; the sitemap split public / signed-in with link edges; page files concatenated in Phase 3 order; a data appendix (per table: read by / written by) parsed from the Evidence lines; the machine-only appendix; and — when given `--harvest` — up to TEN more sections built from what the scan collected — **What runs on its own** (scheduled/background work), **Messages the app sends out**, **Record journeys** (the state machines nobody drew), **What dies when you delete** (cascades and soft delete), **Getting in and staying in** (the sign-in journey), **Free vs paid** (where the app draws the line), plus the four from before: **When things go wrong** (the app's shared error/progress machinery, written once so pages can reference it), **Findings** (dead surface, tables nothing touches, tables with no row-level security, destructive actions with no confirmation step, writes with no visible feedback), **Who's allowed to do what** (the database's own access rules, read from the migrations), and **Keys & services** (external services the app depends on, and every secret/environment variable the code expects, each with where it is first used).

**Findings are computed candidates, not verdicts.** Before publishing, verify each one the same way as any claim: read the cited code. A finding that survives is among the most valuable lines in the map — the BM run caught a dead navigation button this way. If something flagged is intentional, keep the line and say it is intentional; deleting it hides the question from the next reader. The one input that needs a human sentence is the machine-notes file — a small JSON of `{route: "what fetches this"}`.

Two more Phase 5 outputs, both bundled: `node scripts/emit_map_json.mjs map/ -o map.json` produces the structured, machine-readable version of the whole map (the contract an importer consumes — pages, capabilities, actions, tables, all with evidence), and

**It reads `_harvest.json` too, and this matters more than it sounds.** For a long time it did not, while `assemble.mjs` did — so everything app-wide the scan learned (what runs on its own, what the app sends out, record journeys, delete cascades, the sign-in path, free vs paid, access rules, keys and services) reached a human reader in MAP.md and reached an importer NOT AT ALL. Half the reading stopped at the page files. It now picks `map/_harvest.json` up automatically; `--harvest` only overrides the location. **If it prints `WARNING: no harvest read`, the map you are about to hand over is pages and nothing else — fix that before shipping it**, because a file that looks complete and silently omits half the reading is worse than one that fails.

Output is stamped `user-lens-map/3`. Every `/1` field is unchanged; `/2` added the app-wide `app` section, per-page `signals`, `defects`, and `capabilities[].purpose`; `/3` adds top-level `capabilities` — the surface of a repository that has no pages (Phase 1b). The number exists so a consumer that only understands an earlier version says so rather than quietly dropping what was added — which is exactly why adding fields without bumping it would be the wrong move.

**A page-less run does not print like a broken one.** `0/0 user pages mapped` is what a failed enumeration looks like, and for a plugin it is also the right answer, so the emitter says `no pages: N capabilities carry this repository's surface instead` and names them. If it instead warns that the map has **no user-visible surface at all**, believe it: that is a reading which found nothing, and shipping it would put an empty board in front of somebody.

**If it warns about a page file that reached nothing, STOP and fix the heading.** A page file is attached to a route by its `# /path — Title` heading, so a heading that does not match a route exactly — a trailing slash, a rename between Phase 1 and Phase 3, a typo — means the whole file is parsed and then dropped: its capabilities, its actions, its defects and every citation you verified. It used to happen in silence, and the run printed the same clean summary it prints when everything landed. The warning names the file and what its heading says; the fix is one word, in a file you now know.

Two more things the emitter carries that a reader of MAP.md would otherwise have and an importer would not: a redirect's destination (`redirectTo`), and `generatorVersion` — the plugin release that produced the file. `schema` says which FORMAT this is; it cannot say that a thin reading is thin because the mapper was old, which is the question somebody actually asks when a board arrives with no defects on it.

**`noWayIn` is only ever claimed about a page that was actually read.** A route with no page file has no **Reached from outside** line to weigh a missing link against, so a partial run used to report "nothing links to this page" about pages nobody had opened — on one repo that flagged the email-confirmation page and the payment-provider return page, the two whose way in is external by design. A claim nobody checked must not arrive on the owner's board as something to triage.

`signals` carries the harvest's per-page regex hits (outbound mail, paid gates, sign-in, validation). They are **candidates, not claims** — the same discipline as Phase 3 — and are marked as such so a consumer never renders them as agreed behaviour. The prose you wrote and checked is the claim; these are leads.

Also bundled: `node scripts/tree_from_map.mjs map/ -o tree.md` renders the sitemap as a properly nested tree (in the flat sitemap, indentation means "links to"; in the tree it means "contains" — both views are useful, never confuse them). For an app with NO router at all (vanilla HTML/JS), `node scripts/nav_edges.mjs` and `node scripts/index_calls.mjs` are the Phase 2/3 strategy: screens instead of routes, and data calls attributed to the function that contains them.

## Page template (fill every field; write "None" rather than omitting)

```markdown
# /account/settings — Account Settings

**Purpose:** Where you manage your personal account details and security.
**Who can see it:** Signed-in users only.
**Arrives from:** Header avatar menu → "Settings"; post-signup redirect.
**Reached from outside:** None — internal only.
  <!-- other valid values: a link in an email / the payment provider after paying /
       a search result / another program connecting. Who can reach a page is often
       the most useful line in the whole entry. -->
**Shows on load:** Your profile details and notification preferences.
  - READS: `profiles` (display_name, email, avatar_url), `notification_prefs`
  - Evidence: src/routes/account/settings.tsx:14-31

## Capability: Manage your account
**What it's for:** Keeping the details other people see about you correct, and your sign-in secure.
### Action: Update your username
- What happens: You type a new name and save; it changes everywhere your name appears.
- Trigger: "Display name" field + "Save changes" button
- Feedback: on success, a saved toast and the field shows the new value; on failure, an error toast ("Couldn't save — try again").
- Rules: names are 2–40 characters; leading/trailing spaces are trimmed before saving. 
  <!-- Feedback covers success AND failure. If no failure feedback exists, write
       "on failure: nothing visible" and add it to Findings — a silent failed
       save is a defect the owner wants to know about. -->
- Evidence: handler `onSaveProfile` src/components/ProfileForm.tsx:42 → server fn `updateProfile` src/server/profile.ts:18 → UPDATE `profiles` (display_name)

### Action: Reset your password
- What happens: You request a reset link; an email is sent to your address.
- Trigger: "Send reset link" button
- Feedback: Confirmation banner; button disabled 60s.
- Evidence: src/components/SecurityCard.tsx:27 → `supabase.auth.resetPasswordForEmail` → (auth service; no app tables)

## Capability: Control your notifications
**What it's for:** Deciding which emails this app is allowed to send you.
### Action: Turn email digests on or off
- What happens: Flipping the toggle immediately changes whether you get the weekly summary email.
- Trigger: "Weekly digest" toggle
- Evidence: src/components/NotifPrefs.tsx:33 → server fn `setPref` src/server/prefs.ts:9 → UPDATE `notification_prefs` (weekly_digest)
```

An optional field, used whenever tracing reveals one: `**⚠ Defect worth knowing about:** <what is broken, in user terms> — Evidence: file:line`. A reader tracing what a button does is in the ideal position to notice that it does nothing; recording that is first-class output, not a digression.

**Write one line per defect, and repeat the field as many times as needed** — page level for something wrong with the page, or directly under an Action for something wrong with that control. Do not join two defects into one sentence: they are carried as a list and attached individually to the thing they are about, so a page with two problems should arrive as two. Keep the `— Evidence:` on the same line; it is split from the sentence on the way out, so the claim can be checked without anyone re-reading prose.

Match this register exactly. "What happens" lines are written to the user as "you". A read-only page states `**Capabilities:** None — this page is for reading.` and stops there. If a page's purpose can't be stated without code vocabulary, you haven't understood it yet — read more code, then write.

## Quality bars

- 100% of user-facing routes have page files; machine-only routes all appear in the appendix. A user-facing route with no page file is a failure.
- Every action has Evidence — `check_evidence.mjs` now fails an action that has none, so this bar is enforced rather than asserted — and it passes with zero failures. Anything you genuinely could not check is marked `⚠ UNVERIFIED`, which the checker counts and prints; report that count rather than letting it pass unmentioned.
- Every "no inbound link" claim was checked against page links, shared chrome, AND config arrays, with param syntax normalized.
- Every capability has a **What it's for** line, and it says something its name does not already say. "Manage your account — lets you manage your account" is a failure; it is the sentence the owner reads on the card.
- A non-technical reader can answer "what can I do on this page and what data does it change?" for any page without opening the code.
- Depth is uniform: the last page mapped is as detailed as the first.
- `emit_map_json.mjs` counted the **What it's for** lines above and did not warn — a run where no capability states one produces a board of cards that all read the same.
- `emit_map_json.mjs` printed an app-wide line, not `WARNING: no harvest read`. A map.json without it is half a reading wearing a complete one's face.
- Defects are one line each, not joined, and each carries its own Evidence.
- `emit_map_json.mjs` warned about no page file reaching nothing. A page whose heading does not match a route is dropped whole, and the run otherwise looks identical to one where everything landed.
- The scripts' own selftests pass: `node scripts/selftest_emit_map_json.mjs` and `node scripts/selftest_check_evidence.mjs`. They hold the contract this map is one half of — run them after touching any script here, and especially after fixing one under the process rule in Phase 4.
