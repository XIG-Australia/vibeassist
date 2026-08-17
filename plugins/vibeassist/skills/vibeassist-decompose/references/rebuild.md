# Rebuild — greenfield with witnesses

Load this when: entering REBUILD mode, or deciding whether code in front of
you should be mirrored (breakdown) or replaced (rebuild).

The founding observation of this mode, in the user's own words: **"a great
idea buried behind a horrible implementation will never ever work."** The
user who asks for a rebuild is telling you two things at once — the ideas
are proven (they built the thing, they use the thing, the wants are real),
and the implementation has failed them badly enough that they would rather
start again than patch. Both halves matter. Treat the code as truth and you
rebuild the pig; ignore the code and you forget wants the user relies on,
repeat mistakes the old app already taught, and re-write parts that were
never broken.

## The truth hierarchy

In breakdown mode, code is truth. In rebuild mode:

1. **The WANT is the truth.** The tree you propose is the tree of the app
   the user wants, carved at product-owner altitude by the normal greenfield
   rules — shallow-tree judgment, pages-first, no umbrellas. The old app's
   structure is **not an argument** for the new tree's structure: "that's
   how it's organized today" is precisely the sentence a rebuild exists to
   stop deferring to.
2. **The old app is a witness.** It testifies to three things — the wants it
   proves, the lessons it taught, the parts worth salvaging — and its
   testimony enters the walk as evidence and questions, never as asks.
3. **Rule 3a (ingest exactly what's there) does not apply.** A rebuild
   proposes; it never mirrors.

## Step 1 — Survey: build the want-inventory

Survey the existing app first — the `vibeassist-map` skill if available, an
existing `map/map.json` / `MAP.md` if one was already made, or a broad manual
read (routes, pages, actions, jobs). But the output you want from the survey
is different from breakdown's: not a candidate tree, a **want-inventory** —
a flat list of every capability the current app gives its user, in user
language, one line each.

The inventory exists for one reason: **so nothing the user relies on is lost
by accident.** A rebuild's characteristic failure is silent regression — the
shiny new tree simply forgets the CSV export someone uses every Friday. The
inventory is the checklist that makes forgetting impossible.

## Step 2 — The keep / reshape / drop walk

Every inventory item enters the new tree through a question, batched and
recommendation-first like every walk question:

- **keep** — the want survives as-is; it gets an ask in the new tree (shaped
  fresh — keeping the want is not keeping the old shape).
- **reshape** — the want is real but the current expression is wrong; the
  ask is carved the way it should have been, and what was wrong feeds the
  hate-capture below.
- **drop** — the want is dead. Record it (a dropped ask with a reason, or a
  graveyard entry with a removal report — see `references/graveyard.md`);
  never just omit it, because a rebuild that silently loses capabilities is
  indistinguishable from a buggy one.

You may batch obvious keeps ("these eight look like plain keeps — object to
any?") — the point is the user says drop, not you.

New wants — things the old app never had — arrive through the normal
greenfield walk alongside these. A rebuild tree is usually a mix: kept wants,
reshaped wants, and new wants the old implementation was too painful to add.

## Step 3 — Hate-capture: lessons become guardrails

Ask it outright, per area as you walk: **"what do you hate about how this
works today?"** This is the highest-value question a rebuild has, because
the answers are guardrails no greenfield walk could ever surface — they were
bought with the user's actual suffering.

Write each answer as a **concrete must-not on the new ask it governs** (or an
app-level fact when it is global), at the altitude of an observable
behaviour, never a virtue:

- Good: "must not open a modal on top of another modal", "must not reload
  the whole list after a single-row change", "must not require more than two
  clicks from board to any ask's detail".
- Bad: "must be user-friendly", "must be fast", "must not be clunky" — a
  build session can nod along to these while rebuilding the pig exactly.

The test: could a reviewer, using the delivered app, catch a violation
without asking anyone what the words mean? If not, sharpen it — usually by
naming the old behaviour that hurt.

When the user's complaint is about the whole app rather than one surface
("everything takes five clicks", "it never remembers where I was"), record
it once in the **app-level facts register** and let must-nots on individual
asks refine it — same delta discipline as everywhere else, never copied onto
every ask.

## Step 4 — The salvage register: quarry, not anchor

While surveying you will meet code that is sound — an isolated component
that works, a tricky algorithm that took weeks to get right, a well-tested
service. Salvage is recorded as **reuse notes on the ask it would serve**:
file paths, what the code does, one line on why it is worth keeping.
Machinery-level evidence, exactly like breakdown's dossiers — **never a
ask, and never an argument about the tree's shape.**

The discipline that keeps salvage honest:

- **Reuse serves the want; the want never bends to fit the salvage.** If the
  agreed shape of an ask makes a salvage candidate awkward to reuse, the
  candidate loses — flag the cost so the user can overrule, but the default
  is always the want.
- Salvage-worthy usually means: does one thing, does it correctly, and can be
  lifted without dragging the pig along (few tangled imports into the parts
  being rebuilt). "It exists and sort of works" is not salvage-worthy — that
  is how the old architecture sneaks back in.
- Uncertain candidates are walk-questions with a recommendation, like every
  other fork: "the recurrence engine under `lib/recur/` looks lift-able —
  carry it as a reuse note on Scheduling? Recommended: yes; it's isolated
  and the logic is the hard-won part."

## Step 5 — Landing the new tree

Where the rebuild tree lives is a decision, not a default — ask it early,
recommendation-first. Two workable homes: a **fresh project** (cleanest —
the old board, if any, stays an honest mirror of the running app), or a
**clearly separated tree on the existing board** (when the user wants old
and new side by side). What is never acceptable is blending rebuild asks
into a breakdown mirror so nobody can tell the app that is from the app
that is wanted.

Materialization is unchanged (see SKILL.md): after acceptance, `create_ask`
per agreed ask, shape via `update_ask`, reuse notes and lessons recorded on
their asks — draft-first, always.

## The regression sweep — close the loop

Before declaring the decomposition done, walk the want-inventory one last
time and check every line is accounted for: kept (points at its new ask),
reshaped (points at its new ask), or dropped (points at its record). Show
the user the tally. This sweep is cheap, and it converts "I think we got
everything" into a checked claim — which is the difference between a rebuild
and a gamble.

## A worked micro-example

The old app: a task tracker where creating a task opens a modal, whose Save
triggers a full-page reload, with a Reports tab nobody opens, and one gem —
a recurrence engine that correctly handles "every second Tuesday".

- Want-inventory: create/edit tasks · recurring tasks · task list ·
  reports · CSV export.
- Walk: create/edit → **keep** (reshaped: "must not open a modal; inline or
  side panel", "must not reload the list on save"). Recurring → **keep**,
  reuse note: `lib/recur/engine.js — handles nth-weekday correctly; lift
  as-is`. Reports → user says **drop** — dropped with reason "never used".
  CSV export → **keep** (it was the one thing that worked).
- New want surfaced during the walk: a mobile view — enters as a normal
  greenfield ask, held for later.
- Regression sweep: five inventory lines, five pointers. Done — and the tree
  the build sessions receive describes the app the user wants, fenced with
  must-nots bought from the app they hated.
