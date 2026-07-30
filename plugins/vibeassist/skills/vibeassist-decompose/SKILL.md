---
name: vibeassist-decompose
description: Turn a raw idea (greenfield) or an existing codebase (breakdown/ingestion) into a well-formed Idea Tree of asks on the VibeAssist board, through a collaborative, recommendation-first Q&A walk. Use when the user runs /vibeassist decompose, or says "decompose my idea", "break down this app", "break this down into asks", "build my idea tree", "turn this repo into asks", "map my codebase in VibeAssist", "ingest this project" — AND for shaping a single ask: "shape this ask", "shape the <name> ask", "spec this card", "flesh out this ask", "help me shape it", or similar. Three entries — greenfield (propose the shape from knowledge and judgment), breakdown (decompose from what the code actually contains), and single-ask shaping (skip the tree; run the shaping pass on the one ask the user brought). Proposals are draft-first — the user accepts before the board changes.
---

<!-- vibeassist-skill-version: 0.6.0 (single-sourced from plugin.json by scripts/build-plugin-zip.cjs — do not hand-edit; bump plugin.json and rebuild) -->

# VibeAssist idea decomposition — the walk

You turn what the user wants — a raw idea, or a repository that already
exists — into a well-formed **Idea Tree of asks** on their VibeAssist board,
through a collaborative Q&A **walk**. The user is the gate; you bring the
method. This file IS the method: it ships to sessions that have no other way
to reach it, so everything needed to run a decomposition is here or in
`references/`.

This is the **plan-during-the-day** half of the VibeAssist rhythm — _plan by
day, build overnight, review in the morning_. Decomposition and shaping are the
**front gate**: the walk (clarifying questions → propose the shape → the user
AGREES) is what turns a want into deliverable work, and nothing reaches the
overnight build until its ask is shaped and agreed. Chat is INTAKE, not a
delivery chute — a request voiced in chat is captured as an ask and taken
through the walk, never treated as a build instruction.

## Transport — MCP-first

The `mcp__vibeassist__*` tools are the transport; **each tool's description
carries its own mechanics** (arguments, defaults, side-effects) — this file is
orchestration + judgment and never restates them. A decomposition leans on:
`list_projects`, the board tools that read and create asks (their
storage-level names live in the ONE persistence note under Materialize),
`set_intent`, and the question channel (`ask` / `get_answer` /
`get_updates`). If those tools are not present in this session, stop and tell
the user to connect first
(VibeAssist → Claude connection, the one-click Connect button) — do not
improvise a transport.

## The core concept — what an ask is

An **ask** is a distinct CAPABILITY — a thing the user wants, at the level a
product owner thinks in. It is what you'd point at and build.

- An ask is **not a task**. Tasks are HOW — build notes that recede below the
  user's level. They live under an ask as evidence, never as tree nodes.
- An ask is **not a shape-detail**. Options, fields, rules and behaviours are
  the ask's SHAPE — its spec — and hang ON the ask, never beside it.
- "Ask" is the genus. Card, room, peek, list-row are display forms of the
  same entity — different views, one thing.

**The data model you decompose into:** the tree is **asks, nested to any
depth** — an ask contains sub-asks, and a sub-ask is simply an ask with a
parent. Each ask is one card on the board; the map is one tree of asks and
nothing else. Tasks attach to an ask as its build notes and never become
cards. Every ask carries a Structured-Intent `intent_spec` — the cascade of
**goal / intent / guardrails / acceptance**, each element individually
ratifiable by the user — plus a derived state (shaping → needs-answers →
proposed → agreed → queued → building → delivered → live). Those states are
DERIVED from activity, never set by hand: decomposition's job ends at an
agreed, shaped tree; the later rungs (queued / building / delivered / live)
are computed downstream from sprints, build progress and deploys — not by you.

## The decomposition rules

1. **Sub-divide only for genuinely distinct wants.** The same want with more
   detail is still ONE ask. Depth appears only where wants genuinely fork.
2. **Shape and guardrails live ON the ask, not beside it** — captured as the
   ask's spec (its intent / guardrails / acceptance). They are crucial
   detail, never spun out as sub-asks.
3. **Prefer a shallow tree — as JUDGMENT, not law.** Depth for detail is
   almost always wrong, and that much is firm. But how deep a real thing
   goes is a question you answer by looking, not a number to hit. Simon,
   2026-07-30: "I think the flat rule might hold, but I think it's a genuine
   judgement question, not a strict rule." So: reach for shallow, defend
   depth when the thing is genuinely nested, and never flatten something
   real to satisfy the preference.
   **This rule does not apply at all when INGESTING A MAP** — see rule 3a.
3a. **Ingestion reproduces what is there.** When the structure came from
   reading an app rather than from imagining one, it is not a proposal to be
   tidied — it is a fact. Simon, 2026-07-30: "map ingestion we should ingest
   exactly what's there." If the app has a Legal section holding four
   documents, and a project holding Config and Tools sections each holding
   their own pages, that is four levels and it is CORRECT. Do not flatten it,
   do not merge sections away, do not apply rules 3 or 4 to it. The user
   corrects their own map; you do not pre-correct reality on their behalf.
4. **No umbrellas — the name-specificity rule.** A card earns its place by
   being recognizable from its name alone. "Settings" is too general; "User
   settings" and "App settings" are each their own ask. A parent whose only
   job is categorization is taxonomy, and taxonomy is forbidden — depth is
   earned by decomposition, never classification. Tags are lenses, never
   places: tags may be categories; card names may not.
   **The test is whether YOU invented the category.** A grouping you made up
   to tidy a list is taxonomy. A section that exists in the app — one the
   user navigates, with its own address — is a place, and it keeps its name
   even when that name is a category word. "Legal" invented over four
   unrelated cards is an umbrella; "Legal" read off `/legal/*`, holding the
   four documents that live there, is the app.
5. **The quirk / reuse exception.** Something quirky enough — or reused
   widely (an avatar that appears across many surfaces) — earns its OWN ask
   even when it would otherwise be shape.
6. **Ground the decomposition** in the mode you're in (next section).
7. **Gaps become walk-questions.** When something clearly should exist and
   doesn't, PROPOSE it as a question in the walk — never silently add it,
   never silently omit it.
8. **Pages-first — carve by the surfaces, not the internals.** A product owner's
   first mental model is the PAGES / parts they navigate — the UI, because that
   is what delivery mostly is; functions and logic sit UNDERNEATH the page they
   serve. So the top level is the **surfaces/pages a user recognizes and
   navigates** (screens + delivery-facing areas), each with the functions that
   power it nested beneath. **Cross-cutting engine capabilities** — things that
   span every surface (sync, auto-merge, the intent/attention machinery, DB
   chores, health/watchdog, launcher/wake, an operator checklist) — do NOT nest
   under one page; forcing them under a single screen mis-files them. Keep them
   top-level/visible and surface them via an **`engine` (or `platform`) lens
   tag**, never jumbled in as flat peers beside the screens. This is the
   two-segment doctrine — the surfaces the user sees (brain) vs the engine
   (spine) — and tags-as-lenses (rule 4) for what cuts across. It refines
   PLACEMENT only: a page is a real recognizable surface, not a taxonomy bucket.
   No-umbrellas still holds against categories YOU invent — but not against
   sections the app actually has, and not at all when ingesting a map (rule 3a).

Worked examples of every rule: `references/decomposition-examples.md`.

## Branch first — which mode is this?

The two modes are genuinely different approaches; decide before proposing
anything.

**GREENFIELD — from an idea.** There is no code. Use knowledge and judgment
to propose the shape: what capabilities would this product need, at the level
its owner thinks in? You are free to propose structure — but every fork you
are unsure about is a walk-question, not a guess.

**BREAKDOWN — from an existing codebase (ingestion).** There is code, and the
code is the truth. **Survey with the mapper first:** if the `user-lens-map`
skill is available (it ships in this same plugin), run it — or consume an
existing `map/map.json` / `MAP.md` if a survey was already done — and decompose
from its verified output: its pages ARE your top-level surfaces (rule 8), its
capabilities/actions are your candidate sub-asks and shape, its Findings become
walk-questions, and every claim arrives with file:line evidence already
checked. Only when the mapper cannot run, read the code broadly by hand
(routes, tables, major components/services/jobs). Either way, decompose from
**what it actually contains** —
never from the structure you imagine it ought to have. Carve it **pages-first**
(rule 8): the route/page layer gives you the top-level surfaces the user
navigates, the functions/services/jobs that power each one nest beneath it, and
the cross-cutting engine capabilities (sync, watchdogs, schedulers, DB chores)
stay top-level under an `engine`/`platform` lens tag rather than being crammed
under whichever screen they happen to touch. The one exception to
code-grounding: something the code clearly lacks but plainly should have
becomes a **question in the walk** for the user to decide — decompose what
exists; flag the gaps as questions. This keeps the map an honest mirror of
the real app while still catching what's missing. If the user VOICES a new
feature that isn't in the code yet, don't force them to finish the breakdown
first and don't blend it into the mirror — capture it as a **gap ask, clearly
marked proposed / not-built**, sitting beside what exists.

**SINGLE-ASK SHAPING — the third entry.** The user brings ONE ask ("shape the
export ask", "spec this card"). Skip the tree work entirely: find the ask on the
board (or create it if it's new intake), then run the shaping pass below on
just that ask — same walk mechanics, recommendation-first, batched, landing the
answers in its `intent_spec` cascade. Say which ask it landed on. This is the
same front gate the worker skill enforces mid-run ("chat is intake"): when a
build session hands a voiced request over, THIS is where it gets shaped.

In both modes, read the existing board first (the list tools named in the
persistence note under Materialize): decompose INTO what's already there —
extend and correct, never duplicate an ask that already exists.

## Enrichment — decide the STRUCTURE before you shape

Breakdown often runs over a board a rough ingest already populated: cards that
are **naked** (no code evidence), **flat** (one card standing in for several
capabilities), or **thin**. Enrichment is breakdown applied card-by-card to
fix that — and the decisive move is that **structure comes before shape**. You
cannot shape a card until you've decided whether it should even BE one card.
For each existing card, read the code it names, classify it, THEN act:

- **Evidence-rich, single capability** → shape it flat from its dossier
  (routes / tables / apis / files → intent / guardrails / acceptance).
- **Naked** (no dossier) → the code is still the truth. Trace it from the
  card's name + description to the code that implements it — its evidence may
  live under a _sibling_ card — build the evidence, then shape. Never shape a
  naked card from its title alone.
- **Umbrella** → a card whose real shape splits across levels is not one ask.
  Propose its **child asks** and shape each; give the parent only an umbrella
  intent, no flat guardrails/acceptance. (e.g. _Sprints_ → **Create / Run /
  Review**.)
- **Latent sibling** → when the code reveals a capability the card isn't
  really about, spin it off as its **own ask** beside this one rather than
  cramming it in. (e.g. the beta domain's **paid early access** is its own
  ask, sibling to invite-code beta operations.)

This is the same no-umbrellas / quirk-reuse judgment (rules 4–5) applied to
existing cards. It obeys draft-first: the split, the new sibling, and the
shape are all PROPOSALS the user ratifies. Work in batches, card by card —
never restructure the whole board in one silent sweep.

## The walk — collaborative, recommendation-first Q&A

1. **Survey.** Greenfield: restate the idea in one short paragraph and get a
   nod. Breakdown: read the code and say, plainly, what you found.
2. **Propose the tree — top level first, breadth-first.** Decomposition is
   just-in-time: propose the TOP-LEVEL asks first (an indented outline —
   place-name per card, one-line description each), agree those, THEN drill
   into each on demand. Never dump one massive deep tree. Keep a batch
   readable — roughly 10–15 asks at a time; on a large repo, chunk by domain
   (the survey's major areas become the first batch of root asks, each drilled
   into later). Proposing is your job; deciding is the user's.
3. **Ask in batches.** Only genuinely ambiguous forks become questions — a
   question you could answer yourself from the code or the idea is a defect;
   answer it instead. Every question carries a **recommended answer + one
   line of reasoning**, with 2–4 crisp, mobile-friendly options. Batch the
   questions (one round, not twenty single asks).
4. **Apply after acceptance — draft-first, always.** The user's acceptance of
   the proposal is the gate; never mutate the board silently. The proposal
   itself is the draft — an ask is written to the board only once its
   proposal is accepted; nothing is created speculatively.
5. **Channel.** In a live conversation, ask right here in chat. Detached or
   asynchronous (the user may be away), use the `ask` tool
   (`kind:"decision"`, options + `recommendedOptionId` + `reasoning`) so the
   question lands in the VA inbox and can be answered from a phone.

## Shape every ask — the tree is not the finish line

A tree of bare titles is not a finished decomposition. After the tree is
agreed, run a **shaping pass per ask**: capture the guardrails and detail
that make it properly specified.

- For a UI ask: columns, states, behaviour, filters, sorting, design rules.
- For any other ask: the equivalent defining detail — inputs, rules, edge
  behaviour, what "done" observably looks like.

Shaping questions follow the same walk mechanics — recommendation-first,
batched, mostly proposals the user confirms. The answers become the ask's
**acceptance checklist**, written into its `intent_spec` cascade (goal /
intent / guardrails / acceptance). Shape ask-by-ask in batches; don't block
the whole tree on one card's shaping.

**The cascade INHERITS — write deltas, never restatements.** An ask inherits
its ancestors' intent down the tree, so a child holds only what it ADDS
underneath its parent, never a copy:

- **goal** resolves to the nearest ancestor that set one — give a child its
  own goal only when it genuinely narrows the parent's.
- **intent** accumulates down the whole chain — write the intent specific to
  THIS ask; the parents' still apply above it.
- **guardrails** are the union of every level's — add only the ones this ask
  introduces, and link one with `refines` to the parent rule it makes more
  specific rather than repeating it.
- **acceptance** is the exception — it does NOT inherit; each ask carries its
  OWN criteria, the observable "done" for this ask alone.

Never copy a parent's goal or guardrails onto a child; the tree already
carries them down, and a restatement is a lie waiting to drift out of sync.

## Materialize on the board

Only after acceptance, via the MCP tools:

- Create each accepted ask with `create_ask` — omit `parentAskId` for a
  top-level ask, or pass the parent ask's id to nest a sub-ask, so the tree
  mirrors the agreed outline.
- Set each ask's `intent_spec` cascade — goal / intent / guardrails /
  acceptance — from the walk and shaping answers.
- Card names are **place-names** in plain English (recognizable alone, rule
  4); the description is one paragraph in the USER'S language — what it is
  and covers, never implementation layers.
- Propose 1–3 tags per card (lenses, never places).
- **Home every piece of work under the ask it belongs to.** If no ask fits,
  CREATE the ask to hold it — never a catch-all/umbrella bucket, ever.

> **Storage note — this note only.** `create_ask` is ask-native: omit
> `parentAskId` for a top-level ask, pass it to nest a sub-ask — you never
> create an epic or a feature by name. Under the hood an ask is stored as a
> `features` row (top-level = no parent; sub-ask = carries its parent); the
> `epics` table and the legacy `create_epic`/`create_feature` tools survive
> only for old data. Read the existing tree with `list_epics` +
> `list_features` and set a description with `update_feature` (ask-native
> read/update tools are a pending follow-up). "Epic" and "feature" are RETIRED
> concepts — this note is the only place those words belong; everywhere else,
> think, speak, and write in asks.

## The graveyard — retire, never delete

Work that doesn't belong in the product tree — retired asks (with a removal
report), research, spikes, housekeeping lessons — is **retired to a
graveyard**, not deleted: out of the product tree but preserved and findable.
Mechanics and what belongs there: `references/graveyard.md`.

## The three-role audience

Three roles read this board: the **Product Owner** sees delivered-vs-agreed;
the **Developer** sees the grain, one drill-down deep; the **PM-assistant**
(you) TRANSLATES — show the delivered ask, not the code. This shapes every name
and every sentence you write on a card. Full rationale and the review model:
`references/three-role-audience.md`.

## Guardrails

- **Draft-first.** Every proposal gates on the user's acceptance; the board
  never changes silently.
- **Code-grounded.** In breakdown mode, never invent structure absent from
  the code — raise it as a walk-question instead.
- **Surface-first.** Propose and let the user decide — the walk is the
  mechanism, the user is the gate.
- **Recommendation-first.** Every question carries a recommended answer and
  one line of reasoning.
- **Never delete.** Retirement is a move to the graveyard with a record —
  never a drop.
- **No umbrellas, no catch-alls.** Name-specific cards; work homed under the
  ask it belongs to, creating the ask when none fits.
- **Don't stop at bare titles.** An unshaped ask is unfinished work.
- **Shaping is the front gate.** A want becomes deliverable only after the walk
  shapes it and the user agrees — intake → shape → agree, never build inline.
  You may shape on the user's behalf, but land the change on a named ask (or
  create one) and say where it landed.

## References — load on demand

"Load" means pull the named file's contents into context when its trigger hits
— it lives in this skill's `references/` directory and is NOT in context until
you load it (use whatever mechanism your runtime gives for a skill's bundled
files). Load it before you rely on it.

- `references/decomposition-examples.md` — Load this when: judging whether
  something is a sub-ask or shape, carving or naming feels ambiguous, or you
  want the worked examples behind the rules.
- `references/three-role-audience.md` — Load this when: naming cards, writing
  descriptions or acceptance text, or deciding what to show to whom.
- `references/graveyard.md` — Load this when: you meet pulled or dead work,
  research, spikes, or housekeeping during a breakdown, or the user asks to
  remove something.
