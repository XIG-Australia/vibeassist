---
name: vibeassist-decompose
description: Turn a raw idea (greenfield), an existing codebase (breakdown/ingestion), or an app the user wants to replace (rebuild) into an Idea Tree of asks on the VibeAssist board, through a collaborative, recommendation-first Q&A walk. Use when the user runs /vibeassist decompose, or says "decompose my idea", "break down this app", "break this down into asks", "build my idea tree", "turn this repo into asks", "map my codebase in VibeAssist", "ingest this project" — for a rebuild — "rebuild this app", "rewrite it from scratch", "the ideas are right but the implementation is awful", "re-platform this" — and for shaping one ask — "shape this ask", "spec this ask", "flesh out this ask". Five entries — greenfield (propose from knowledge and judgment), breakdown (decompose from what the code contains), rebuild (decompose the idea fresh, the old app as witness and quarry, never as truth), the shaping conversation (skip the tree and shape the one ask — Form and Confirm as one continuous conversation, one question at a time, never a verdict), and the plan (the read-back written after that conversation ends — what will be built, owner-readable and plan-level, approved by the owner and followed by the builder; it lands as the build notes, is sized to the change, and asks the owner nothing). Proposals are draft-first — the user accepts before the board changes.
---

<!-- vibeassist-skill-version: 0.42.0 (single-sourced from plugins/vibeassist/.claude-plugin/plugin.json — keep them in step) -->
<!-- 0.35.0 (26 Aug 2026): MUST-NOT IS A NEGATIVE REQUIREMENT, NOT A SCOPE FENCE. Three spots that told the shaper to fence scope by writing a must-not are corrected: a must-not is a gate or constraint the built thing must obey ("never allow login during maintenance"), never a record that a whole feature wasn't asked for — that is scope, owned by the cake rule's default. AND the cake rule gains its flip side, SUGGESTION IS NOT INVENTION: the shaper MAY propose a proportionate extra the owner might want, as a recommendation-first question — a birthday message on the cake or plates and napkins, yes; twelve tiers with someone leaping out, no. See § The cake rule and § Must do and must not. -->
<!-- 0.33.0 (26 Aug 2026): THE SKILL IS THE AUTHORITY FOR HOW VA BUILDS. The whole loop is stated once in § 4 — the stages and who ends each, the status ladder, and the database rule — and a project’s CLAUDE.md never overrides it (it owns what the repo IS: stack, branch names, folders, real commands). THE LADDER IS CORRECTED: `building` spans the WHOLE run; `report_delivery` moves NOTHING, it fires the code pass; a PASSING REVIEW writes `delivered` and must carry `mergedCommit` or it is refused; `accepted` is the OWNER’s alone. So a stranded board sits on `building`, not `delivered`. DATABASE CHANGES ARE THE CODE PASS’S: safe ones applied silently, destructive ones gated behind `ask_user` — replacing the old “the owner applies every migration by hand”. -->
<!-- 0.32.0 (26 Aug 2026): the plan records prerequisites as ROWS as well as prose. `needs_first({ askId, needs, forget })` writes what the board acts on — the run order and the one-press “cue those first” — and the prose line is what the owner reads; both name the same asks and never drift. The pass writes the CURRENT set: read first, add each, forget every row it did not name, and do it all BEFORE `report_build_notes`, which ends the job. An unshaped prerequisite still gets a row (the cue-check shows “still needs shaping”); a prerequisite with no ask id gets the prose line only — never an invented row. “Nothing needed” is recorded on both channels. See the decompose skill § Record it TWICE. -->
<!-- 0.31.0 (26 Aug 2026): the PLAN works out the BUILD ORDER. Every plan ends with a line or two saying what has to be built first — whether the parent is a real prerequisite or only a grouping, and any prerequisite that is NOT the parent (a sibling, a cousin, a foundation elsewhere). “No order needed” is written down too: a stated no is information, silence is not. The tree says what groups under what, never what comes first. This pass reasons and RECORDS — it never moves, re-parents or reorders anything. See the decompose skill § Build order. -->
<!-- 0.29.0 (25 Aug 2026): the read-back is THE PLAN — one artifact with two readers. The owner approves it and the builder builds to it, so it is written owner-readable and plan-level ("here's what I'll build"), with technical names only where the decision or the build genuinely turns on one. The old "technical direction for the builder, not for the owner" framing (0.19.0) is superseded. It is sized to the CHANGE — a one-line change gets a one-line plan — and empty stays a real answer. ONE WRITER: the `write_build_notes` pass the app fires when the conversation ends; a `shape_ask` never writes `build_notes` too. THE PLAN PASS ASKS NOTHING — no `ask_user`, no parking; a shape too thin to plan says what is unclear IN the plan and stops, and the owner takes it Back to shaping. The build reads the plan from `get_ask` and builds to it, not to the three shape lines alone. -->
<!-- 0.28.0 (24 Aug 2026): shaping is ONE conversation. Form and Confirm are two movements of the same talk — same channel, same voice, one question at a time — and the owner cannot tell which is happening. A Confirm question puts the AI's reading up ("I'm taking this as X — right?") with options and a recommendation; a genuine blocker is asked the same way ("this fights X — which wins?"), never handed back as a verdict. The separate shape-review entry is RETIRED: no pass/fail, no gate, no wall of findings. When it understands, it says "anything else to add?" and the owner's go ends it. (It also wrote the read-back; 0.29.0 moved that to the `write_build_notes` pass.) A stray `check_shape` job is run as the Confirm movement. `report_build_notes` takes `jobId`, not `askId`. -->
<!-- 0.24.0 (24 Aug 2026): superseded by 0.28.0 — shape-review findings are brief. -->
<!-- 0.22.0 (22 Aug 2026): superseded by 0.28.0 — the shape review passed on "good enough to build". -->
<!-- 0.21.0 (22 Aug 2026): superseded by 0.28.0 — added the shape-review entry a `check_shape` job landed on. -->
<!-- 0.19.1 (20 Aug 2026): build notes are written as light Markdown — backticks around field names, identifiers, table/column names, paths and commands; fenced blocks for multi-line code; prose stays prose. Legibility only, never licence to write more. -->
<!-- 0.19.0 (20 Aug 2026): superseded by 0.29.0 — build notes arrived as builder-facing technical direction, explicitly not for the owner. They are now the plan the owner approves. What survives: the residual rule (subtract the Rules, subtract what the code shows), usually empty, and the language check not running on them. -->
<!-- 0.15.0 (20 Aug 2026): plain wording enforced on the single-ask shaping entry too (not only tree drafts); dash-asides and vague deferrals are flags; VA's furniture words (ask, tree, board, branch, leaf, room, card) may only carry the APP's meaning on a shape — a notice for a human, never a hard ban. -->
<!-- 0.13.0 (18 Aug 2026): check_language ported from Python to node ESM (byte-for-byte identical); the skill now runs it with node, so drafts can be checked where there is no Python. -->
<!-- 0.12.0 (18 Aug 2026): the rebuild-board dogfood pass. Define-the-project-first + the three registers (Rules / Decisions / Ethos); think in cross-dependencies; the return path (the second half of the loop) + one-way-back and send-back routing; the want is a plain complete action; record a change only when the shape's own words go wrong. -->
<!-- 0.11.0 (14 Aug 2026): added the plugin-only markdown-file transport — the free-tier path (one file, heading=tree, prose shape, two doors decompose/map, findings on overlap, one-way import). -->

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

## Transport — the board, or a markdown file

Two places asks can land, and you pick by what's present:

- **The board (MCP).** When the `mcp__vibeassist__*` tools are in the session,
  they are the transport; **each tool's description carries its own mechanics**
  (arguments, defaults, side-effects) — this file is orchestration + judgment and
  never restates them. A decomposition leans on `list_projects`, the board tools
  that read and write asks — `list_asks`, `create_ask`, `update_ask`, `move_ask`
  — and the question channel (`ask` / `get_answer` / `get_updates`).
- **A markdown file (plugin-only / free tier).** When those tools are NOT
  present, do not stop — this is the free-tier path, not a missing dependency.
  Materialize the asks into a single markdown file instead (see "Materialize to
  a markdown file", below). The walk is identical; only where the asks land
  changes.

## The core concept — what an ask is

An **ask** is a distinct CAPABILITY — a thing the user wants, at the level a
product owner thinks in. It is what you'd point at and build.

- An ask is **not a task**. Tasks are HOW — build notes that recede below the
  user's level. They live under an ask as evidence, never as tree nodes.
- An ask is **not a shape-detail**. Options, fields, rules and behaviours are
  the ask's SHAPE — its spec — and hang ON the ask, never beside it.
- **The word is "ask", always.** Card, room, peek and list-row are just how
  an ask is drawn on screen — display words, never the noun. Say "ask" in
  every proposal, question and record. The owner's correction, verbatim:
  "not cards, asks."

**The data model you decompose into:** the tree is **asks, nested to any
depth** — an ask contains sub-asks, and a sub-ask is simply an ask with a
parent. Each ask is one ask on the board; the map is one tree of asks and
nothing else. Tasks attach to an ask as its build notes and never become
asks.

**The shape, and it is three lines — not four.** Rewritten 7 August 2026; the
old `goal / intent / guardrails / acceptance` cascade is gone, because goal and
intent were the same thought twice.

| Line | What it is |
| --- | --- |
| **What you want** | The picture, in one or two short sentences. The why lives in here too. A competent builder infers the rest |
| **Must do** | Callouts a builder might MISS — needed, but not obvious from the want. Empty is fine |
| **Must not** | Refusals of what a builder might WRONGLY add or assume. Empty is fine. **Inherits down** — a child shows its parents' must-nots marked "also applies here". NEVER copy the text onto a child |

**Say nothing twice.** If the want says "$20 through Stripe when the
customer books", then "charge exactly $20" as a must-do is noise — it
restates what any builder already read. Full doctrine: "Must do and must
not — corrections, not summaries", below.

**The want is a plain, complete action — not a fragment, and not a smuggled
constraint.** State what the ask does, whole and plain ("Sign in with email and
password, or Google"), never a terse fragment ("Email and password, and nothing
else"). Words like "only", "never", "nothing else" are **not wants** — they are
must-nots, or already implied. Jargon stays off the want too: "Google" on the
shape; "OAuth" is the mechanism and rides with the build note. Before/after:
want `Email and password, and nothing else.` → `Sign in with email and password,
or Google.`; must-not (was empty) → `Never create an account here — new users
come in through beta approval or payment.`

### The cake rule — an ask means what it says, and no more

The failure this whole system exists to prevent, in the founder's image: the
user asked for a chocolate cake and the build session delivered a chocolate
*experience* — fountains, oompa-loompas, no off switch. Vibe-coding tools
fail this way because they treat **silence as licence**: anything the shape
doesn't forbid becomes room for invention, and the result is an app the user
never asked for wearing the name of the one they did.

So the rule, binding in every mode and every shaping pass:

- **The default reading of every ask is the plainest competent version of
  the want.** Not the impressive version, not the "delightful" version — the
  plain one. The user can always ask for more; they should never have to
  fight off more.
- **Silence is not licence.** A capability, screen, option, animation or
  flourish the shape does not name is not permitted-by-omission — it is
  UNDECIDED, and undecided means a walk-question or a held ask, never a
  delivery.
- **Scope is the default, not a must-not.** During shaping, ask "how plain?"
  and land the answer in the want. The generic fence lives ONCE, as an
  app-level rule the builder now carries too: "Build only what the asks say.
  Anything extra is a question first" (build skill § 6). Don't repeat it per
  ask, and don't turn it into must-nots. "No settings screen nobody asked
  for" is not a must-not — it is scope, and the default already refuses it.
  A must-not is a different tool, for a different job (§ Must do and must not).
- **The shape is the stop button.** Review judges delivered-vs-agreed
  against the shape's lines, so an unrequested embellishment is a
  *violation* to send back, never a bonus to applaud. Write shapes tight
  enough that this is checkable.

**The flip side — suggestion is not invention.** Everything above restrains
what gets BUILT unasked; none of it restrains what the shaper may OFFER.
Proposing an extra the owner might want is the shaper's job, and a delight
when it lands — as long as it serves the want they already have and stays in
proportion to it. A birthday message on the cake, plates and napkins to eat
it with: offer them. Twelve tiers with someone leaping out: no — that trades
their want for a grander one they never had. The test, per suggestion: would
a thoughtful person filling THIS request naturally add it, or does it turn
the request into a bigger, different one? Offer the first as a
recommendation-first question — one or two at most — never the second, and
never a stream of them.

This is why a bare-titled ask is dangerous, not just unfinished: a title
with no fence is an invitation for the build session to imagine the rest.

### Must do and must not — corrections, not summaries

The want is general on purpose. A competent builder reads "take a flat $20
card deposit through Stripe when the customer books; the balance is paid in
person" and correctly infers the charge amount, the processor and the
moment. That inference is expected and welcome — the cake rule stops new
capabilities, screens and options, never ordinary competence within the
want.

The two must lines exist for where inference goes wrong, and only there:

- **Must do** calls out what a builder might MISS — needed, but not obvious
  from the want. For the deposit: "send a confirmation text", "block out the
  time in the calendar once payment succeeds". Neither is in the want, and a
  builder could plausibly skip both.
- **Must not** is a negative requirement — a gate or constraint the built
  thing must obey. It refuses what a builder might WRONGLY add or assume:
  something that could be considered a real option, actively refuted in
  advance. "Never save customer card details." "Never allow login during
  maintenance." "Never let this page be crawled." In the owner's words:
  must-nots are "things that could be considered as a possible option, but
  we're making sure they're actively refuted." It is NOT where you record
  that a whole feature wasn't asked for — that is scope, and the cake rule's
  default handles it, never a must-not line.

Three rules follow:

1. **Say nothing twice.** Nothing repeats across want, must-do and must-not.
   "Charge exactly $20" under that want is noise — the want already said it.
   A repeated line isn't just clutter: it drifts out of sync with the want
   and then the shape argues with itself.
2. **Both lines are optional.** A want clear enough to need no corrections
   is a finished shape. Forcing a line is worse than leaving it empty.
3. **The test, per candidate line:** would a competent builder, reading only
   the want, get this wrong? Might miss it → must-do. Might wrongly assume
   it → must-not. Would get it right anyway → leave it out. ("Never delete
   all records when one is deleted" — nobody would; noise.) Might be wanted
   later → a held ask, not a shape line.

**Which line does a mixed thought go on?** Some corrections carry a do and a
don't in one thought — soft delete is the classic: hide the record, keep the
row. Ask which mistake you are correcting. A builder's default reading of
"delete" is to remove the row — you are refusing that default, so it is a
must-not, and it names the replacement in the same breath: "Never remove a
deleted record from the database. Hide it from view." One thought, one line,
one home. Never split it across both sections — two copies of one fact
drift apart.

### Actions are sentences, never structure

Delete, save, archive, approve, resend — the small verbs on an ask. A real
map of a real app carried 196 of them. None is a tree node, and none gets
its own record inside the ask. How each lands is decided by size:

- **Nothing to correct → absent.** "Open a project" is implied by the want.
  Write nothing.
- **One thing to say → one line.** "Delete asks once and cannot be undone."
- **Several rules → a named block** of two or three short lines inside the
  shape: "**Rotate the webhook secret:** asks first. Say plainly that the
  old secret stops working."

The ask carries the contract; the map (when one exists) carries the full
record with evidence. Never copy the map's action detail onto the ask —
attach it.

**Two layers, one test.** A map's action writeup mixes the owner's layer
(what happens, the rules as behaviour, the feedback shown) with the
developer's layer (handlers, tables, mechanisms, file:line). When lifting
onto an ask, keep only what passes this test: **could the owner see it or
say it?** Worked on a real delete action: "only offered on a dropped ask,
as a second step", "never takes the functions or data it used", "the
Deleted message names anything left behind" — all owner layer, all valid
shape lines. "Enforced by a database trigger on `asks`" — mechanism; its
owner-level truth ("no matter how the delete happens, it can't take
machinery") is what goes on the ask, and the mechanism stays in the map.
The evidence trail always stays in the map. Implementation detail copied
onto an ask goes stale the moment the code changes; the attached map is
dated testimony, the ask is the standing contract.

### Copy is the builder's, not the shaper's — unless it is long

The actual words on a screen — a button label, a heading, an empty state, an
error — are **not shaped**. The builder writes them, to the UI copy standard
(`vibeassist` skill `references/ui-copy-standard.md`), checked by `check_copy.mjs`
and read again at review, and hands them all back on the delivery so the owner
sees every one. So do not spend the shaping conversation authoring microcopy, and
do not put button or label text on the shape.

**The one exception is LONG copy** — more than a few words: a paragraph, an
empty-state explanation, onboarding or help text. That is worth agreeing at
shaping even when it reads fine, because it carries meaning the owner has a view
on. Shape that; leave the short controls to the builder.

### The language rule — plain words, few words

A standing must-not from the product owner, in their words: **never use
convoluted language.** Everything the user reads — ask names, wants,
must-dos, must-nots, questions, options — is written in the fewest and
simplest words that keep the meaning.

This is a hard rule, not a style preference. The board is a contract. The
owner reads it on a phone. The build session builds what the words say. A
ask the owner has to read twice hides mistakes. Plain words are the
cheapest guardrail there is.

How to write:

- One thought per sentence. Short sentences.
- Everyday words. "Use", not "utilize". "Book a time", not "secure an
  appointment slot".
- Say the thing. "Never open a pop-up on top of another pop-up", not "avoid
  stacked modal interaction patterns".
- No developer jargon on asks unless the owner used the word first.
- Cut filler: "seamless", "robust", "intuitive", "streamlined",
  "comprehensive", "delightful", "leverage", "empower", "experience",
  "journey" say nothing. Delete them.
- No metaphors on asks.
- A want is one or two short sentences. If it needs more, it is probably
  two asks.
- The test: read it aloud. Would the owner say it that way? If not,
  rewrite. Cut words until cutting changes the meaning.

Bad → good:

| Bad | Good |
| --- | --- |
| "A streamlined, mobile-first booking experience enabling customers to seamlessly select services and secure appointment slots" | "Customers pick a service and book a time. Works on a phone." |
| "Must not proliferate stacked modal interaction paradigms" | "Never open a pop-up on top of another pop-up." |
| "Robust session persistence ensuring contextual continuity across save operations" | "Saving never reloads the page or loses your place." |

**The second disease: bard-speak.** Simple words can still make a garbage
sentence. Bard-speak is writing that sounds wise instead of saying the
thing — aphorisms, poetic fragments, "X, not Y" constructions, method talk.
The owner called it "like talking to a 12th century bard" and it is the
biggest failure this rule exists to kill. Real ask text that failed, and
what it should have been:

| Wrote | Should have written |
| --- | --- |
| "the screen you land on after sign-in; the app's home" | "Your home screen." |
| "say plainly the diary is full for that period and show the salon phone number (this is 'nothing fits', not an error)" | "If no times are free, say so and show the phone number." |
| "Everything else stays a leaf — its detail is shape, not structure." | Nothing. This is method talk. Never write it where the user reads. |
| "Child of Task board. Ancestors' must-nots apply." | "The Task board rules apply here too." |
| "Never move an ask from here. Dragging one onto another must not change what it sits inside — that happens somewhere else." | "You can't drag an ask into a different parent here. Moving asks happens on the board." |

The rules that kill it:

- **Never use this method's vocabulary on an ask.** Leaf, shape, carve,
  ancestor, cascade, inherit, lens, umbrella, altitude, fence, cake,
  register, materialize — these words are for YOU, reading this file. The
  owner never sees them. Bookkeeping ("which rules apply here") is either
  carried silently by the tree or said plainly: "The Task board rules apply
  here too."
- **If a sentence sounds wise, rewrite it.** Asks state facts. They never
  philosophize, never balance one idea against another for effect.
- **No "X, not Y" constructions.** Say what it is. The contrast is padding.
- **No dash-asides.** A clause hung off an em-dash at the end of a line is an
  afterthought the writer could not place. Give it its own sentence or delete
  it. (An em-dash in the middle of a finished sentence is fine.)
- **No vague deferrals.** "That happens somewhere else", "handled elsewhere",
  "done elsewhere" — name the place, or cut the clause. A deferral that names
  nowhere is the shape admitting it does not know.
- **No semicolons on asks.** Write two sentences.
- **The over-the-counter test.** Say the line out loud as if the owner is
  standing in front of you. If you wouldn't say it that way, don't write it
  that way.

**The third disease: our furniture words carrying our meaning.** **ask, tree,
board, branch, leaf, room, card** are VibeAssist's own words for its
workspace. They are also ordinary English, so they turn up honestly in real
apps: a gardening app's tree is a plant, its ask is a question a gardener
types, its branch is part of the tree. On that app's shapes those words are
exactly right.

What is never right is **VA's board meaning leaking onto a shape**. "You
can't move this ask to another branch" describes VibeAssist, not the app being
built. Shape every ask in the app's OWN words, read from the app itself.

Two traps worth naming:

- The collision is invisible when the app is itself about asks in a tree.
  Then our words and its words are the same tokens with no daylight between
  them, and only meaning tells them apart. Slow down there.
- It is not memory bleeding across sessions. The shaping helper runs in a
  fresh sub-context with no knowledge of our work. It reaches for "ask"
  because shaping asks is its trade.

**No checker can settle this.** A garden tree and a board tree are the same
word. So `check_language.mjs` raises these as a **notice**, never a failure —
hard-banning them would break every legitimate gardening, forestry or to-do
app. The notice asks one question and a human answers it: *is this the app's
meaning, or ours?*

**Check before you show.** Run `node scripts/check_language.mjs` over every
draft proposal — tree outlines, shapes, question batches — before the user
sees it, and fix what it flags. It catches filler words, method vocabulary,
dash-asides, vague deferrals, semicolons and overlong sentences, and it
raises a furniture-word notice for your eye. **Flags must be fixed. Notices
must be read.** The over-the-counter read catches the rest.

**This check is not only for tree drafts.** Every shape runs it before it
lands on the board, including the single-ask shaping entry and a shape_ask
job handed to a listening session. The tree road had the check and the
per-ask road did not, which is how the bad lines above reached a real board.

**Do not copy this file's voice onto the board.** This method file explains
rules to a model, and it talks like it — it would fail its own checker. The
board talks like its owner: plain, short, direct.

### The states, and they are SET, not derived

**Seven, on one axis. Exactly one, always.**

`proposed` → `shaping` → `approved` → `queued` → `building` → `delivered` →
`accepted`

**The old list said `shaping → needs-answers → proposed → agreed → queued →
building → delivered → live`, and that states are "DERIVED from activity, never
set by hand". Both halves were wrong.**

| Old | Now |
| --- | --- |
| `needs-answers` | **Not a status.** It is a REASON — see the second axis below |
| `agreed` | `approved` |
| `live` | **Not a status.** Going live is a date recorded on the Ask, because shipping is a threshold crossed, not a phase occupied |
| `proposed` after `shaping` | `proposed` comes FIRST — it means the assistant suggested it and it is not yours yet |
| "derived, never set by hand" | **Set deliberately.** Proposing, approving and queueing are things a person DOES. A status derived from activity cannot express "agreed, but not now" |

**`dropped` is not on this axis either.** It is a flag, because dropping can
happen from anywhere and a status holding it would overwrite where the Ask got
to. A dropped Ask keeps its status and shows it: "dropped while approved".

### The second axis — why it is not moving

Separate from the status, because a status word is a noun and cannot also carry
a verb. **At most one shows. Higher wins.**

1. **needs you** — you are the blocker, right now
2. **stopped without finishing** — the last attempt died, **and something
   checked**. Silence alone NEVER sets this
3. **came back** — you sent it back
4. **parent not ready** — what it sits under is not ready
5. **something it uses isn't ready** — what it LINKS to is not ready; its parent
   may be perfectly fine

**On hold is separate again**, and it masks the reason without erasing it —
lifting the hold brings the question back so it can still be answered.

**Decomposition's job still ends at a shaped, approved tree.** What changed is
that the later rungs are not "computed downstream" — they are recorded as the
work actually moves.

### The return path — the second half of the loop

The seven states carry work forward. The return is the other half, and it is
**one path with one door**:

- **Delivered → review → accept, or send back.** Accepting is the owner's call;
  a send-back returns the ask to **shaping** — the same door every time.
- **Everything returns the same way.** A defect, a change of mind, a later
  realisation, a build handed back in review — none makes a separate status, and
  timing or cause never forks the path. `came back` plus the history carry the
  "shipped before" story, and the version that is **live holds until the new one
  is accepted** — nothing goes dark mid-change.
- **A send-back carries a routing reason** that names *where the process failed*,
  so the pattern can be learned from: **missed intent → shaping** · **overstep →
  the worker** · **rule breach → the product** · **doesn't work → the build**.
  The user tags it (you may suggest); VA aggregates where it is leaking and
  self-adjusts — deepen the walk, tighten the worker payload.

### Record a change only when the shape's own words go wrong

When a change comes back to an ask, update its **shape** only if the change makes
the shape's own words untrue. The trigger is not "is it significant" — it is
whether the record is now wrong. Renaming a thing the shape names, changing what
it does, adding or removing a must-line → the shape now lies, so fix it. A
preference the shape never stated — where a control sits, spacing, on-screen
order → there is no false record to correct, so it flows to the build and never
touches the shape. And the build note is **read from code**, so what got *built*
records itself on the next read; the only thing hand-maintained is the want.

## Labels — Page, Element, Capability, Automation

**Rewritten 12 August 2026, agreed with the product owner.** The old
place/capability/background model and its `place_size` field are described at
the end of this section only because the transport still stores those values.

> **There is one kind of thing: the Ask.** It carries a **label**, and the
> label only tells you what kind of thing you're looking at. It never decides
> where something can sit, never gates a field, and is never destructive when
> changed. Unlabelled is legitimate — never guess a label to fill the blank.

| Label | Means | Where it lives |
| --- | --- | --- |
| **Page** | A screen with its own address | Its own ask |
| **Element** | A piece of a page the owner can point at — a panel, a table, an avatar, a banner | Child of its page |
| **Capability** | Something you can do | A line on its page or element. Its own ask ONLY when promoted — see below |
| **Automation** | Runs by itself, on a schedule or trigger | Always its own ask. It has no surface to live on |

Relationships are said as **parent** and **child**, plainly: "child of Task
board" is fine. "Ancestors' must-nots apply" is not — say "The Task board
rules apply here too", or let the tree carry it silently.

### Capabilities live ON the thing — the cart rule

A capability belongs to a surface. By default it is written on the shape of
the page or element it sits on, as a must-do line — never pulled out as its
own ask. The owner's example, now the named rule: **a cart table where you
can delete items or update quantities has NO capability asks. Delete and
update are two lines on the cart.** They are not their own thing in their
own right, so they get no ask.

This matters most when reading code (breakdown, enrichment, or a map
ingest): every click handler in the code looks like a capability. It isn't.
**Controls found in code default to shape lines on the surface that holds
them.** A tree that lists Delete-item, Update-quantity and Apply-voucher as
children of Cart has mistaken handlers for wants.

### Promotion — when a capability earns its own ask

Promote a capability from shape line to child ask when any of these is true:

1. **It is its own delivery.** An ask is a work order — it gets queued,
   built, delivered and reviewed as a unit. If you'd want it built and
   reviewed separately, it's an ask. "Book a groom" — yes. "Export to CSV"
   on the task board — a line, it arrives with the board.
2. **It needs its own shape.** Its must-dos and must-nots would crowd the
   parent.
3. **It's reused across surfaces** (the avatar rule).

A capability that passes none of these stays a line. Two quick sanity tests
for the floor: the **demo test** (could you show it on its own in a sprint
review?) and the **friend test** (would the owner mention it when describing
the app to a friend?). Dialogs, confirmations, form fields, validation,
empty states, sort and filter controls, single buttons — always shape, never
asks.

**The button is never the thing.** The owner's example: "decompose my idea"
and "map the repo" are capabilities. Each is started by a button, and nobody
would talk about the button — you talk about the capability. So when a
control starts a big capability, the ask is the capability and the control
is one line of its trigger. The owner's own speech decides which noun an ask
wears: what they point at ("the cart") is an element; what they do ("map the
repo") is a capability, whatever starts it.

### The split rule — many capabilities means hidden elements

When one surface's shape lists more than about 5–7 capabilities, it probably
contains elements — find them and split, each element carrying a few
capabilities. The guard: an element must be something the owner can **point
at on the screen**. Never invent an element to tidy a list; if you can't
point at it, the page just has a lot of capabilities, and that's honest.

### Transport mapping — until the app renames its stored values

The board still stores the old values. When writing asks: **Page** →
`kind: place` (size page), **Element** → `kind: place` (size element),
**Capability** → `kind: capability`, **Automation** → `kind: background`.
Renaming the stored values and their display is an ask for the VibeAssist
rebuild board, not something this skill can do.

**The trigger is a property every ask can carry** — a page reached from a
menu, a capability reached from a button, an automation set off by a
schedule. Record it in `trigger_description`.

### Machinery — unchanged, and still never an ask

**Function** — a named executable unit; the register lists every surface item
that uses it. **Data** — a named store, referenced from surface items as
reads / writes / creates.

Machinery is referenced from Asks and **never becomes an Ask**. Reconciliation
still stands: functions nothing uses, data nothing reads, data written but never
read — all become retirement PROPOSALS the user ratifies, never deletions.

### Folders — new on 4 August

**A folder is a named container in the tree.** It holds Asks and other folders.
It has **no shape, no status, no type and no queue position**, and it is never
built.

**Nesting an Ask under an Ask is a CLAIM** — that this belongs to that. **Putting
one in a folder is not a claim about anything.** So a person can group work
without inventing a relationship that is not real.

An Ask has exactly ONE home: under another Ask, or in a folder. Never both.

### VOCABULARY, not types

A **feature** is a noun that crosses places (avatar, shopping cart) → a TAG/lens,
never a tree level. The deliverables under it are capabilities, and the filing
test is: _if you deleted it, what could the user no longer do?_

### FINE PRINT — spec lines riding on the Ask they govern

At the lowest level where they are true. **Nine sections:**

rules and calculations · validation · feedback (success AND failure) ·
confirmation steps · **state journeys** · visibility and permissions ·
shows-on-load · **when there is nothing there** · live-updating behaviour

**Two changes from the old list, both 4 August:**

- **`arrival` is GONE.** It merged into the **trigger**. Where it recorded a
  condition rather than a route — "landed cold with no session", "deep-linked
  mid-flow" — that is **shows-on-load**.
- **State journeys live on the ASK that owns the thing**, not "on the data item
  they belong to". Data is machinery and machinery is never an ask, so the old
  wording named the one home that cannot exist — and nothing was ever written
  because of it.

A journey is a sentence you read: `draft → sent → paid`. That is all. Do not
build a graph, and do not require each transition to name its cause.

**"When there is nothing there" is new** and it is on EVERY Ask, not only places.
A search with no matches and a list with nothing to approve are empty cases too,
and they are the ones that ship as a blank rectangle. Record **which kind of
empty** it is — "nothing sits inside this one, it is the whole thing" is a
different sentence from "nothing lives here yet".

### CROSS-CUTTING REGISTERS

decisions/principles (dated, ratified, BIND named asks) · findings (flags pinned
to asks) · app-level facts (sign-in journey, free-vs-paid line, global error
machinery, delete cascades, database shape, keys & services).

## The decomposition rules

1. **Sub-divide only for genuinely distinct wants.** The same want with more
   detail is still ONE ask. Depth appears only where wants genuinely fork.
2. **The shape lives ON the ask, not beside it** — captured as the
   ask's SHAPE (want / must do / must not). They are crucial
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
4. **No umbrellas — the name-specificity rule.** An ask earns its place by
   being recognizable from its name alone. "Settings" is too general; "User
   settings" and "App settings" are each their own ask. A parent whose only
   job is categorization is taxonomy, and taxonomy is forbidden — depth is
   earned by decomposition, never classification. Tags are lenses, never
   places: tags may be categories; ask names may not.
   **The test is whether YOU invented the category.** A grouping you made up
   to tidy a list is taxonomy. A section that exists in the app — one the
   user navigates, with its own address — is a place, and it keeps its name
   even when that name is a category word. "Legal" invented over four
   unrelated asks is an umbrella; "Legal" read off `/legal/*`, holding the
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
   tag**, never jumbled in as flat peers beside the screens. (In kind terms:
   the engine segment is background statements plus machinery references —
   see the kind system above.) This is the
   two-segment doctrine — the surfaces the user sees (brain) vs the engine
   (spine) — and tags-as-lenses (rule 4) for what cuts across. It refines
   PLACEMENT only: a page is a real recognizable surface, not a taxonomy bucket.
   No-umbrellas still holds against categories YOU invent — but not against
   sections the app actually has, and not at all when ingesting a map (rule 3a).

Worked examples of every rule: `references/decomposition-examples.md`.

## Branch first — which mode is this?

The modes are genuinely different approaches; decide before proposing
anything. The decisive question when code exists is: **does the user want the
map to MIRROR this app, or to REPLACE it?** Mirror → breakdown. Replace →
rebuild. Getting this wrong wastes the whole walk — a breakdown of an app the
user hates faithfully reproduces everything they hate. If their words leave
it ambiguous ("break down this app" over a repo they've been complaining
about), ask — one question, before anything else.

**GREENFIELD — from an idea.** There is no code. Use knowledge and judgment
to propose the shape: what capabilities would this product need, at the level
its owner thinks in? You are free to propose structure — but every fork you
are unsure about is a walk-question, not a guess.

**BREAKDOWN — from an existing codebase (ingestion).** There is code, and the
code is the truth. **Survey with the mapper first:** if the `vibeassist-map`
skill is available (it ships in this same plugin), run it — or consume an
existing `map/map.json` / `MAP.md` if a survey was already done — and decompose
from its verified output: its pages ARE your top-level surfaces (rule 8), its
capabilities/actions default to SHAPE LINES on the surface that holds them
(the cart rule — promote one to its own ask only when it passes a promotion
test), its Findings become walk-questions, and every claim arrives with
file:line evidence already checked. The mapper sees every click handler;
most of them are lines, not asks. Only when the mapper cannot run, read the code broadly by hand
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

**REBUILD — from an app the user wants to REPLACE.** There is code, but the
code is NOT the truth — it is the evidence. The user is here because the
implementation failed them; a great idea buried behind a horrible
implementation will never work, and the rebuild exists to dig the idea out.
So run the walk as GREENFIELD — decompose the WANT, at product-owner
altitude, shallow-tree judgment and all — with the existing app serving as
three witnesses, never as the blueprint:

1. **Proof of the wants.** Survey the existing app first (the mapper, or an
   existing map, or a broad read) so no capability the user relies on gets
   silently forgotten. But every existing capability enters the new tree
   through a **keep / reshape / drop** walk-question — never as an automatic
   ask. Existing ≠ wanted.
2. **A record of lessons.** What is wrong with the current app is the most
   valuable input a rebuild has. Ask it outright — "what do you hate about
   how this works today?" — per area, during the walk. The answers become
   **must-nots and guardrails on the NEW asks**, written concretely enough
   that a build session cannot reproduce the failure ("must not open a modal
   on top of a modal", not "must be user-friendly").
3. **A quarry.** Code worth salvaging is recorded as **reuse notes on the ask
   it would serve** — machinery-level evidence (file paths, what it does, why
   it is sound), never an ask, and never a reason to bend the tree: reuse
   serves the want; the want never bends to fit the salvage.

Rule 3a does NOT apply — a rebuild proposes, it never mirrors. Full method,
including the survey, the hate-capture, the salvage register and where the
new tree lands: `references/rebuild.md` — load it before running this mode.

**THE SHAPING CONVERSATION — one ask, and it is ONE conversation.** The user
brings ONE ask ("shape the export ask", "spec this ask"), or a `shape_ask` job
lands naming one. Skip the tree work entirely: find the ask on the board (or
create it if it's new intake), then talk it through — **Form and Confirm as one
continuous conversation**, one question at a time, landing the answers into its
SHAPE (want, must do, must not). Say which ask it landed on. This is the same
front gate the worker skill enforces mid-run ("chat is intake"): when a build
session hands a voiced request over, THIS is where it gets shaped.

**There is no verdict, no gate and no list of findings** — anything you noticed
leaves as one more question, a blocker included. Full method below, under **The
shaping conversation**.

**Run the language check before the shape lands** — `node
scripts/check_language.mjs` over the want, the must-dos and the must-nots, fix
every flag, read every notice. This entry is reached without any tree draft,
so nothing else runs the check for it. It is also the entry a `shape_ask` job
lands on, so an unchecked line here goes straight onto the user's board.

**THE PLAN — the read-back, and it is `build_notes`.** A `write_build_notes` job
lands, fired when the owner ends the shaping conversation. Write **what you will
build** — owner-readable, plan-level, sized to the change and near-empty when the
shape was clear. **The owner approves this text and the builder builds to it: one
artifact, two readers.** It reports through **`report_build_notes({ jobId, notes
})`**. **This pass asks the owner nothing** — if the shape is too thin to plan,
say so in the plan and stop. Full method below, under **The plan**.

**`check_shape` — retired.** There is no separate shape-review entry any more.
If such a job still lands, run it as the Confirm movement of the shaping
conversation; the handling is under **The shaping conversation**.

In both modes, read the existing board first (the list tools named in the
persistence note under Materialize): decompose INTO what's already there —
extend and correct, never duplicate an ask that already exists.

## Enrichment — decide the STRUCTURE before you shape

Breakdown often runs over a board a rough ingest already populated: asks that
are **naked** (no code evidence), **flat** (one ask standing in for several
capabilities), or **thin**. Enrichment is breakdown applied ask-by-ask to
fix that — and the decisive move is that **structure comes before shape**. You
cannot shape an ask until you've decided whether it should even BE one ask.
For each existing ask, read the code it names, classify it, THEN act:

- **Evidence-rich, single capability** → shape it flat from its dossier
  (routes / tables / apis / files → want / must do / must not).
- **Naked** (no dossier) → the code is still the truth. Trace it from the
  ask's name + description to the code that implements it — its evidence may
  live under a _sibling_ ask — build the evidence, then shape. Never shape a
  naked ask from its title alone.
- **Umbrella** → an ask whose real shape splits across levels is not one ask.
  Propose its **child asks** and shape each; give the parent only an umbrella
  want, no flat must-do/must-not list. (e.g. _Sprints_ → **Create / Run /
  Review**.)
- **Latent sibling** → when the code reveals a capability the ask isn't
  really about, spin it off as its **own ask** beside this one rather than
  cramming it in. (e.g. the beta domain's **paid early access** is its own
  ask, sibling to invite-code beta operations.)

This is the same no-umbrellas / quirk-reuse judgment (rules 4–5) applied to
existing asks. It obeys draft-first: the split, the new sibling, and the
shape are all PROPOSALS the user ratifies. Work in batches, ask by ask —
never restructure the whole board in one silent sweep.

## Define the project first — then its rules, decisions and ethos

**Greenfield and rebuild open here, before any tree** — a short, higher-level
round that filters into everything below. (Breakdown/ingestion skips it: the
project is read from the code, not asked.)

- **The project itself** — its name, what it does in a sentence, its value
  proposition, what it is **for** and **not for**, and its **founding beliefs**:
  the things that shape which questions even get asked ("single user now, sharing
  later"; "bring your own AI"; "a paid product"). Settle these before
  decomposing — one belief here quietly answers dozens of later forks.

Then three registers sit at the project root. They are **different things** and
must not be lumped together as "rules":

- **Rules** — binding constraints on *how* a thing is built (plain language,
  styling, owner-scoped). The worker obeys them, review enforces them, they apply
  to every ask, and the user can add to them.
- **Decisions** — the choices of *what* it is built on (the database, the payment
  processor, the framework, the owner column). Facts the build works from,
  revisable, not constraints.
- **Ethos** — VA's own operating spine. It binds **every** app VA builds, is
  inherited and **read-only** per project, and gets published (marketing, and
  surfaced in-app). The user adds their own rules; ethos stays VA's. So far:
  - **No scope creep** — the plainest competent version of the want; elaboration
    is a proposal, never a delivery (the cake rule).
  - **Verify from reality** — never trust a self-report; check the running thing.
  - **Never guess** — a missing answer means ask, not invent.
  - **Think in cross-dependencies** — weigh each choice against *every* standing
    belief and decision, not only the ask above it. A choice that fights a stated
    plan — a per-user column when sharing is planned — gets surfaced *before* the
    user has to catch it.
  - **Build on what's there** — VA holds what already exists (the map, the
    standards, yesterday's code); build on it rather than forgetting, re-asking or
    breaking it.
  - **The screen reflects reality** — a change the user makes shows at once in
    every place that shows it, no manual refresh; a stale view is a broken view.
    (Scope: the user's own actions; live-syncing another session or device is a
    later thing.)

**Rules bind the worker, not the talk.** The rules and ethos bind the assistant
that *builds* (and any instructions VA passes it). VA itself is less bound — it
can discuss a rule with the user and change it. The worker cannot ignore
whichever version stands.

**P·E·C·A is not a project rule.** The four labels are a shaping decision on the
ask, kept in the ask's own model — never in a project's rule list. And a label
never gates placement: any ask sits anywhere, root included (a root-level
capability or automation is fine; the user arranges freely and can move it
later).

## The walk — collaborative, recommendation-first Q&A

1. **Survey.** Greenfield: restate the idea in one short paragraph and get a
   nod. Breakdown: read the code and say, plainly, what you found. Greenfield and
   rebuild: define the project first (the section just above) before proposing a
   tree.
2. **Propose the tree — top level first, breadth-first.** Decomposition is
   just-in-time: propose the TOP-LEVEL asks first (an indented outline —
   place-name per ask, one-line description each), agree those, THEN drill
   into each on demand. Never dump one massive deep tree. Keep a batch
   readable — roughly 10–15 asks at a time; on a large repo, chunk by domain
   (the survey's major areas become the first batch of root asks, each drilled
   into later). Proposing is your job; deciding is the user's.
3. **Ask in batches.** Only genuinely ambiguous forks become questions — a
   question you could answer yourself from the code or the idea is a defect;
   answer it instead. Every question carries a **recommended answer + one
   line of reasoning**, with 2–4 crisp, mobile-friendly options. Batch the
   questions (one round, not twenty single asks). **Each option carries enough
   context to choose it** — an option the user "can't see why they'd pick" is a
   badly written option, not a real choice. And **before you ask or land a
   decision, scan the standing beliefs, decisions and rules for anything the
   choice would contradict**, and lead with the contradiction and your proposed
   reconciliation rather than asking a question the project's own plan already
   answers.
4. **Apply after acceptance — draft-first, always.** The user's acceptance of
   the proposal is the gate; never mutate the board silently. The proposal
   itself is the draft — an ask is written to the board only once its
   proposal is accepted; nothing is created speculatively.
5. **Channel.** In a live conversation, ask right here in chat. Detached or
   asynchronous (the user may be away), use **`ask_user({ jobId, question })`**
   so the question lands on the ask they are looking at and can be answered from
   a phone. That channel takes **one question at a time** — it refuses a second
   on the same job until the first is answered — so a batch is a live-chat thing
   only.

## Shape every ask — the tree is not the finish line

A tree of bare titles is not a finished decomposition. After the tree is
agreed, run a **shaping pass per ask**: get the want right, then add only
the corrections a builder needs.

- For a UI ask: columns, states, behaviour, filters, sorting, design rules.
- For any other ask: the equivalent defining detail — inputs, rules, edge
  behaviour, what "done" observably looks like.
- For EVERY ask: ask "how plain?" (the cake rule). Land the answer in the
  want. What NOT to build is the default, never a must-not; only a genuine
  constraint the built thing must obey becomes a must-not. Where there is no
  such constraint, write none — the app-level fence covers the generic case.

Shaping questions are recommendation-first, mostly proposals the user confirms.
Land each answer in the right line: general picture → the want; a builder might
miss it → must-do; a builder might wrongly assume it → must-not; already
inferable from the want → nowhere, it's done (say nothing twice). Shape
ask-by-ask; don't block the whole tree on one ask's shaping.

**How many questions at once depends on where you are.** In a live tree walk,
with the user in front of you, a batch is fine — it is one screen of a
conversation they are already in. **On ONE ask — the shaping conversation, and
every `shape_ask` job — it is one question at a time**, and the channel refuses
a second anyway. That doctrine is below, under **The shaping conversation**;
follow it whenever the ask, not the tree, is what you are shaping.

**The cascade INHERITS — write deltas, never restatements.** An ask inherits
its ancestors' intent down the tree, so a child holds only what it ADDS
underneath its parent, never a copy:

- **goal** resolves to the nearest ancestor that set one — give a child its
  own goal only when it genuinely narrows the parent's.
- **intent** accumulates down the whole chain — write the intent specific to
  THIS ask; the parents' still apply above it.
- **must not** is the union of every level's — add only the ones this ask
  introduces, and link one with `refines` to the parent rule it makes more
  specific rather than repeating it.
- **must do** is the exception — it does NOT inherit; each ask carries its
  OWN criteria, the observable "done" for this ask alone.

Never copy a parent's want or must-nots onto a child; the tree already
carries them down, and a restatement is a lie waiting to drift out of sync.

## The shaping conversation — Form and Confirm as one

Shaping is **ONE conversation**. It has two movements, and the owner can never
tell which one is happening:

- **Form** — help the owner say what they want. What it is, what it must do,
  what it must never do.
- **Confirm** — check that you read it right. _"I'm taking this as X — right?"_

They are not two passes, not two jobs, and not two voices. You move between them
freely, mid-conversation, and both go out through the same channel in the same
manner: **one question at a time, options, a recommendation, short.**

There is no verdict at the end of this. **You are not a gate.** You confirm you
understood; the owner decides.

### One question at a time — always

`ask_user` carries every question, Form and Confirm alike. Asking parks the job
and ends your turn; when the owner answers, the job comes back to whoever is
listening then. A second question on the same job is refused until the first is
answered, so **there is no way to batch and no reason to want one.** Full
mechanics: `references/question-channel.md` in the `vibeassist` skill.

In a LIVE terminal conversation — the user typed "shape this ask" and is sitting
there — ask in chat instead. Still one at a time. The channel changes; the
manner does not.

### What a Confirm question looks like

It puts your reading up and asks the owner to agree with it or correct it:

> _"I'm taking 'archive' as hide it from the board, still there if you go
> looking — right?"_ → **hide it (recommended)** / delete it for good

> _"When you said the team can see it, did you mean everyone, or only the people
> on that project?"_ → **only that project (recommended)** / everyone

Same furniture as a Form question — 2–4 options, one recommended, each option
carrying enough to pick it. **Never a bare "is this right?"** with nothing to
press.

### A blocker is a Confirm question too — never a verdict

Sometimes the ask genuinely cannot be built as it stands: it fights the ask
above it or one beside it, or a want reads two ways that build two different
things. **That is still a question**, asked the same way:

> _"This says exports run nightly, but the ask above says nothing leaves the app
> without a click. Which wins?"_ → **the ask above — a click starts it
> (recommended)** / this one — nightly, and loosen the parent

- **Never hand back a pass or a fail.** A blocker is something to settle
  together, not a judgment to deliver.
- **Never leave the owner unable to answer.** Every blocker arrives with the
  options that resolve it. A blocker they cannot answer is a wall, and the
  conversation dies there.
- **Loop, do not stop.** They answer, the shape moves, the conversation carries
  on from there.

### Never a wall of findings

Whatever you noticed leaves as questions — one at a time, most important first.
Six things dumped on an owner at once is the thing this replaced. Sort what you
noticed into three piles:

- **Worth settling with them** → a Confirm question.
- **You can settle it yourself** → settle it, and it shows in the plan later.
- **A nice-to-have neither of you needs to discuss** → let it go.

### Keep it short, or nobody shapes anything

A wordy shaping is a chore, and a chore does not get done.

- **One line per question.** Options are a few words each — never a sentence
  standing in for a label.
- **No preamble.** Ask the thing.
- **Ask only what you cannot work out.** A question you could answer from the
  ask, from the ask above it, or from the code is a defect — answer it.
- **Stop when you can build it.** The bar is _a competent builder could build
  this without coming back to ask_. Not perfect, and not everything you would
  have written yourself.

### Signal done, and stop there

When you understand it well enough to build it, say so and wait for the go:

> _"That's everything I need. Anything else to add?"_

**Their go ENDS your job.** Land the shape, finish, and stop. The app fires a
`write_build_notes` job off the back of it, and THAT pass writes the plan —
the next section. **You do not write it here.**

**One writer, one plan.** The plan lives in one field and is written by one
pass. A `shape_ask` job that also writes `build_notes` gives the ask two plans
that drift apart, and the owner approves whichever one the screen happened to
show. **Never call `report_build_notes` from a shaping conversation.**

### The language check runs before any line lands

`node scripts/check_language.mjs` over the want, the must-dos and the must-nots,
every flag fixed, every notice read. A listening session writes onto the board
with nobody watching, so the check is the only thing between a sloppy line and
the owner's ask.

### Legacy — a `check_shape` job

`check_shape` was the old separate review, and its own entry is retired. If one
still lands, **do not run it as a review.** Run it as the Confirm movement of
this conversation: questions through `ask_user`, one at a time, and finish it
with `report_shape_review({ jobId })` carrying no findings. Never send a
`passed: false`, and never hand back a list.

## The plan — the read-back, and it IS `build_notes`

**The plan is ONE artifact with two readers.** The owner reads it and approves
it; the builder reads it and builds to it. It is not a builder's brief that the
owner happens to see, and it is not owner prose the builder has to guess at. One
text, written so both get what they need.

It is written by the **`write_build_notes`** pass, which the app fires when the
owner ends the shaping conversation. It lands on the ask as `build_notes` and it
reports through `report_build_notes`.

**Older wording called this "technical direction for the builder", builder-facing
and not for the owner. That framing is gone.** Where the two registers disagree,
this section wins: the plan is what the owner approves.

### Write it as "here's what I'll build"

**Owner-readable, plan-level.** Say what you will build, in the words the owner
used for their own product. Someone who cannot read code has to be able to read
this and say yes or no.

- **Plan-level, not step-level.** What the thing will do and where it will
  appear — not the functions you will write to do it.
- **Technical specifics only where they genuinely matter.** A backticked name
  earns its place when the owner's decision turns on it, or when a builder would
  otherwise pick the wrong one: `asks.status`, `src/lib/session.ts`, "reuse the
  existing session helper rather than adding a second one". A file path listed
  because you happened to open the file is noise.
- **Say the WHY when the why is the point.** A choice whose reason is invisible
  gets overridden by the next person who thinks they know better.
- **Never a technical brief.** "Add a `useMemo` around the selector" is not a
  plan the owner can approve. "The list stays smooth on a big board" is.

**Owner-facing does NOT mean dropping the real risks.** A genuine catch — a
trap, a wrong-copy risk, a migration, an ordering hazard — belongs in the plan.
Hiding it to keep the plan tidy is the worst version of this. **Name it in terms
the owner can act on: here is the risk, and here is what I'll do about it.** Do
not tour the internals to get there.

- **The register, in one pair.** Say: _"The pending state needs its own wording
  or it'll show the wrong text — I'll add a line just for it."_ Not:
  _"`notesNow` bakes the Build-Notes-tab copy into `working.headline` via its
  `WRITING` constant."_ Same risk. Only one of them can be approved.
- **The test: could the owner read it and nod, or would they have to open the
  code to work out what you meant?** The first is the plan. The second is
  builder-internal and stays out.

### Size it to the CHANGE, not to your effort

**A one-line change gets a one-line plan.** Never manufacture an overhaul
because the field looks like it wants one.

- **The shape was clear and small** → one or two lines, or nothing at all.
- **You had to interpret** → say what you took it to mean, and what that makes
  the build do. That is the part the owner most needs to see.

Two things stay out, however much you know about them:

1. **The standing Rules.** Every ask inherits them. A rule restated on twenty
   asks is twenty copies to keep in step, and the first one that drifts is a lie
   on somebody's board.
2. **What the code already shows.** The builder reads the codebase. It sees the
   pattern, the file layout, the existing helper, and how the last three of
   these were done. Writing that down again costs a read and adds nothing.
   **A real risk you found in the code is not "what the code shows"** — that
   goes in, in the owner's terms. What stays out is the tour.

### This pass NEVER asks the owner anything

**Do not call `ask_user` here, and never park this job on a question.** Shaping
is where the owner is talked to; the plan pass is not a second conversation, and
opening one puts the ask in two places at once.

Write the plan from three things only: **the agreed shape**, **the code you
read**, and **where the ask sits on the board** (§ Build order). Nothing else,
and nobody asked.

**If the shape is too thin to plan confidently, say what is unclear IN the plan,
and stop.** Name the hole plainly — "The shape doesn't say where the export
control lives, so I can't say where it will appear" — finish the job with that
in the notes, and leave it. The owner reads it and takes the ask **Back to
shaping**, which is where the question belongs. That is the loop working, not a
failure.

**Never guess past a hole and never fill it quietly.** A plan built on an
invented answer is worse than a plan that says it does not have one.

### Empty is a REAL answer, and it is a common one

A shape so plain you interpreted nothing needs no plan. **Write none, and say
so** — bar the order line, which is always there (§ Build order). "Empty" here
means that line and nothing else.

**Empty is a SUCCESS, not a failure.** This is where it differs from a delivery
report: `report_delivery` refuses to say nothing, because an ask marked
delivered with nothing to show is a lie. A plan carries no such claim, so
`report_build_notes` with empty `notes` finishes the job clean and correctly.
Reach for it without hesitating.

**Never invent direction to fill the space.** A line written because the field
looked empty is scope creep with a technical accent: it puts a decision on the
builder that nobody made, in a place that reads as though somebody did. An
honest empty field is worth more than a paragraph of filler.

### Build order — what has to come first, worked out HERE

**Every plan ends with a line or two about order, and they are never left out.**
No heading, no list — the last line of the plan, in the same prose as the rest.
This is the read before the build, so it is the moment to notice that something
else has to exist first — and the owner should never have to spot it themselves,
weeks later, when a build lands on nothing.

**Work out three things.**

1. **What the parent link actually is.** A parent is sometimes a real
   prerequisite — the child cannot stand until the parent exists — and sometimes
   only a grouping, a place on the board where like things live. **Say which
   one it is.** Never assume: **the tree says what groups under what, and that
   is not the same question as what has to come first.**
2. **What else has to exist first.** Look wider than the parent. A prerequisite
   is often a **sibling**, a **cousin**, or a **foundation somewhere else
   entirely** — the thing everything quietly stands on. **A prerequisite is not
   always the parent, and a parent is not automatically a prerequisite.**
3. **Whether the answer is "nothing".** Most of the time it is, and **that is an
   answer worth writing down.** "These are independent" told plainly is
   information; the same thing left unsaid is a silence the owner has to
   interpret.

**Read it from three places, and none of them is the owner.** The shape (what
does this thing stand on — a session, a table, a page that has to be there?),
the board (`get_ask` for this ask, `list_asks` for what is around it), and the
code (**a thing already built is not a prerequisite** — check before you name
one).

**Write it as one plain line per real prerequisite**, in the owner's words,
naming the other ask by its name:

> Needs **Sessions that survive a refresh** first — this reads the signed-in
> person, and there is nobody to read until that lands.

> The parent, **Account settings**, is a grouping, not a prerequisite — this can
> be built before it.

**And where there is none, one line, and only one:**

> No order needed — this can be built any time.

**Keep it to that.** One line per real dependency and one line when there are
none. A paragraph of maybes is the thing this is meant to save the owner from.

**This pass REASONS and RECORDS. It never rearranges.** Do not move an ask, do
not re-parent one, do not change the run order, do not cue anything, and do not
set a status or a blocked reason. What you conclude gets written down — and
**the owner and the app** decide what to do with it.

### Record it TWICE — the prose line, and a row

**Two channels, and both are owed.** The prose line is for the owner to read.
The **rows** are what the board can act on: they are what orders the run and
what puts the one-press "cue those first" in front of the owner. **A prose line
on its own leaves the press dead**, however right the reasoning was.

The tool is **`needs_first({ askId, needs, forget })`** — `askId` is the ask that
needs something, `needs` adds one prerequisite by id, `forget` takes one back.
Pass neither and it just reads. **It locks nothing**: nothing refuses work
because of a row, it is shown to the owner at the moment they cue, and they may
go ahead anyway. So **record what is TRUE, not what you wish were enforced.**

**Do it in this order, and finish before you report:**

1. **Read what is already there** — `needs_first({ askId })` comes back with the
   rows this ask already has, by name and status.
2. **Add every prerequisite you named**, one call each, with the ask id you
   already looked up on the board. **The row and the prose line name the same
   asks** — if it is in the prose, it is a row; if it is a row, it is in the
   prose. They must never drift apart.
3. **`forget` every row you did NOT name this time.** A plan pass writes the
   current set: re-running it leaves no duplicates (the same pair recorded twice
   is stored once) and **no stale leftovers** from a reading that has moved on.
   The read comes back by name — match the name against `list_asks` to get the
   id to forget.
4. **Then `report_build_notes`** — that call finishes the job, so every
   `needs_first` call has to be done before it.

**A prerequisite that is not shaped yet still gets a row.** Never skip one for
being unready — the row carries its status, and the owner's cue-check is built
to show "still needs shaping". A silently missing row is the failure; an unready
one is the check working.

**Never write a row without a real ask id.** If what has to come first is not on
the board at all, it has no id, so it gets the **prose line only** — say plainly
that the thing it needs is not an ask yet. **Do not invent an id, and do not
turn a guess into a row.**

**"Nothing needed" is recorded on BOTH channels too** — no rows (forget any that
are left over), and the prose line saying so. A stated no on one channel and
silence on the other is exactly the drift this rule exists to stop.

**`needs_first` missing from this session's tools?** Say so out loud, once, and
**still write the prose line** — the reasoning is not lost, only the row.
Never quietly substitute another tool, and never drop the prose to match.

### Write it as light Markdown — the tab formats it

It is read in the app, which renders Markdown. Use it so the owner can read it
and a builder can scan it:

- **Backticks around anything that is a name, not a word** — where a name earns
  its place at all. Field names, identifiers, table and column names, file
  paths, commands: `build_notes`, `asks.status`, `src/lib/session.ts`, `bun run
  verify`. A path in bare prose reads as a typo; in backticks it reads as a
  path.
- **A fenced code block for anything over one line** — a command sequence, a
  snippet, a shape to match. One-liners are fine inline. Rare: most plans need
  none.
- **Prose stays prose.** Sentences in sentences, not bullets of fragments. A
  short list is fine when the content is genuinely a list.

**Light Markdown means light.** No headings, no tables, no nested structure. If
it needs a heading to navigate, it is too long — size it to the change and cut.
**Formatting is not permission to write more.**

### Reporting it — one call, and it is the end of the job

**`report_build_notes({ jobId, notes })`.** It writes the notes onto the ask AND
finishes the job in one call, so there is no half-done state where the job
closed but the notes never landed.

- **Do not call `complete_job` after it.** The job is already finished, and a
  second finish comes back an error. On a pass that worked,
  `report_build_notes` is the last call you make.
- **It does not change the ask's status.** Writing a plan is not progress on the
  build and must never look like it.
- **`notes` is never wholly empty any more** — the order line always lands
  (§ Build order). The shortest real plan is that one line on its own, and that
  is a perfectly good answer.
- **Every `needs_first` call comes BEFORE this one.** This call ends the job, so
  a row written after it is a row never written (§ Record it TWICE).
- **A plan you genuinely cannot do** — the ask is not there, the code is
  unreadable — finishes with `complete_job` and one honest sentence instead.
  Never both. **A shape too thin to plan is NOT this case**: that plan gets
  written, it says what is unclear, and the job finishes done.

### The language check does not RUN on the plan — but the owner still reads it

`scripts/check_language.mjs` guards lines going onto a shape — the want, the
must-dos, the must-nots — so it does not run here. **That is a fact about the
script, not a licence.** The owner reads and approves this text, so the same
plain-wording standard applies: fewest and simplest words, no method vocabulary,
no bard-speak. The few technical names that earn their place are the exception
the script would have flagged, and that is the only reason it stays off.

**The check still runs on every shape, exactly as before.** A plan never relaxes
it, and it is never a back door for putting technical language onto a shape.

## Materialize on the board

Only after acceptance, via the MCP tools:

- Create each accepted ask with `create_ask` — omit `parentAskId` for a
  top-level ask, or pass the parent ask's id to nest a sub-ask, so the tree
  mirrors the agreed outline.
- Set each ask's **Shape** with `update_ask` — `want` (what you want),
  `mustDo` (what it must always do), `mustNot` (what it must never do) — from
  the walk and shaping answers.
- Ask names are **place-names** in plain English (recognizable alone, rule
  4); `want` is one or two short sentences in the USER'S plain language —
  what it is and covers, never implementation layers, and never convoluted
  (the language rule).
- **Home every piece of work under the ask it belongs to.** If no ask fits,
  CREATE the ask to hold it — never a catch-all/umbrella bucket, ever.

> **Read before you propose.** `list_asks(projectId)` returns the tree the user
> actually sees, and `list_asks(projectId, parentAskId)` returns what is already
> inside one ask. Suggesting something already on the board is the most common
> way a walk wastes the user's time.
>
> The epics and features tools this skill used to name were retired on
> 2026-07-31 along with the board they wrote to. There is one ask type now, it
> is an ask, and it nests. "Epic" and "feature" are not ask types — "feature"
> is ordinary English and nothing more.

## Materialize to a markdown file — the plugin-only path

When there is no board (no MCP transport), the asks land in **one markdown file
per project** — the free-tier front gate. Files are good at what you decide, bad
at what happens: status, run order and blocking questions all need something
watching. So this file is for **shaping**; real work moves to VibeAssist after a
one-way import. The walk that fills it is exactly the walk above — clarifying
questions, recommendation-first, draft-first, the cake rule and the language
rule all still bind. Only the landing changes.

**The format:**

- **One file, not one per ask.** Heading depth IS the tree — `#` project, `##`
  top-level ask, `###` child, and down. Document order IS sibling order.
- **A banner at the top, always.** It is a one-way export; it goes **stale the
  moment it is imported**; after import you work in VA, not the file. In rebuild
  mode add the mode line too — witnesses-not-blueprint, everything unapproved.
- **One metadata line under each heading:** *label · door · status* — plus
  `lens: <tag>` where the ask carries one. Label is Page / Element / Capability /
  Automation, or nothing (never guess one). Door and status are below.
- **Shape as prose, data as a table.** The three lines — **Want** / **Must do** /
  **Must not** — are plain sentences (a table makes people write worse ones); an
  empty must-line is "—". A data table appears only where the ask has data.
- **Everything lands unapproved.** Do not pre-approve; import takes each ask
  through the gate.

**The two doors, and mark every ask with one:**

- **decompose** — a want you shaped. Lands **`shaping`**.
- **map** — read from code. Lands **`delivered — not accepted`** (built, but the
  person has not accepted it into this board).
- An ask that does not say its door cannot be told apart from code by an
  importer — so it is not optional. Where a mapped (built) thing meets a
  decomposed want, **that overlap is a Finding on the ask**, never a silent
  merge: the person decides whether the built thing is accepted, reshaped or
  dropped. Map only the repo being built; a separate app the user is replacing
  is salvage (reuse notes), never mapped in.

**Import is one-way.** Shape offline, import once, then work in VA. That kills
the id-matching problem and the sync problem both — the file is a starting
state, never a living mirror.

## The graveyard — retire, never delete

Work that doesn't belong in the product tree — retired asks (with a removal
report), research, spikes, housekeeping lessons — is **retired to a
graveyard**, not deleted: out of the product tree but preserved and findable.
Mechanics and what belongs there: `references/graveyard.md`.

## The three-role audience

Three roles read this board: the **Product Owner** sees delivered-vs-agreed;
the **Developer** sees the grain, one drill-down deep; the **PM-assistant**
(you) TRANSLATES — show the delivered ask, not the code. This shapes every name
and every sentence you write on an ask. Full rationale and the review model:
`references/three-role-audience.md`.

## Guardrails

- **Draft-first.** Every proposal gates on the user's acceptance; the board
  never changes silently.
- **Code-grounded.** In breakdown mode, never invent structure absent from
  the code — raise it as a walk-question instead.
- **Rebuild is greenfield with witnesses.** In rebuild mode the old app is
  evidence — of wants, of lessons, of salvage — never truth. Never mirror it,
  and never lose a want the user relies on without them saying drop.
- **Surface-first.** Propose and let the user decide — the walk is the
  mechanism, the user is the gate.
- **Recommendation-first.** Every question carries a recommended answer and
  one line of reasoning.
- **Never delete.** Retirement is a move to the graveyard with a record —
  never a drop.
- **No umbrellas, no catch-alls.** Name-specific asks; work homed under the
  ask it belongs to, creating the ask when none fits.
- **Don't stop at bare titles.** An unshaped ask is unfinished work.
- **The cake rule.** Plainest competent version by default; silence is not
  licence. One app-level fence ("build only what the asks say"); per-ask
  fences only where the temptation is real. Elaboration is a proposal or a
  held ask, never a delivery.
- **Shape lines are corrections.** The want carries the picture. A must-do
  calls out what a builder might miss; a must-not refuses what they might
  wrongly assume. Nothing repeats across the three. Both must lines may be
  empty. Never pad.
- **The language rule.** Never use convoluted language. Fewest and simplest
  words on everything the user reads. No method vocabulary and no bard-speak
  on asks. Run `node scripts/check_language.mjs` on EVERY shape before it
  lands — tree drafts, the single-ask entry and `shape_ask` jobs alike. Fix
  every flag; read every notice.
- **Our furniture words never carry our meaning.** ask, tree, board, branch,
  leaf, room and card may only mean what they mean in the APP being built. A
  gardening app's tree is a plant. Never describe VibeAssist's own board
  mechanics on an app's shaped lines.
- **Shaping is the front gate.** A want becomes deliverable only after the walk
  shapes it and the user agrees — intake → shape → agree, never build inline.
  You may shape on the user's behalf, but land the change on a named ask (or
  create one) and say where it landed.
- **Shaping one ask is ONE conversation.** Form and Confirm are two movements of
  the same talk, in the same voice, and the owner cannot tell which is
  happening. One question at a time. Never a verdict, never a gate, never a wall
  of findings — a blocker is a question with the options that settle it, and the
  conversation loops until it is settled.
- **End with the go, not with the plan.** When you can build it, say "anything
  else to add?" — and on the owner's go, land the shape and stop. The plan is
  written by the `write_build_notes` pass that follows. **One writer, one plan.**
- **The plan is one artifact with two readers.** The owner approves it and the
  builder builds to it, so write it owner-readable and plan-level, sized to the
  change, near-empty when the shape was clear. **That pass asks the owner
  nothing** — a shape too thin to plan says what is unclear in the plan and
  stops.
- **Define the project first.** Greenfield and rebuild open by defining the
  project and its three registers — Rules (how), Decisions (what it's built on),
  Ethos (VA's own, inherited, read-only). P·E·C·A is a shaping decision, never a
  project rule, and a label never gates placement.
- **Think in cross-dependencies.** Weigh each choice against every standing
  belief and decision; surface a contradiction before the user has to catch it.
- **One way back.** Delivered work returns to shaping the same way whatever the
  cause; the live version holds until the new one is accepted; a send-back
  carries a routing reason (missed-intent → shaping, overstep → worker, breach →
  product, doesn't-work → build).
- **Record a change only when the shape's words go wrong.** Else it flows to the
  build; built reality is read from code, never hand-transcribed.

## References — load on demand

"Load" means pull the named file's contents into context when its trigger hits
— it lives in this skill's `references/` directory and is NOT in context until
you load it (use whatever mechanism your runtime gives for a skill's bundled
files). Load it before you rely on it.

- `references/decomposition-examples.md` — Load this when: judging whether
  something is a sub-ask or shape, carving or naming feels ambiguous, or you
  want the worked examples behind the rules.
- `references/three-role-audience.md` — Load this when: naming asks, writing
  descriptions or acceptance text, or deciding what to show to whom.
- `references/graveyard.md` — Load this when: you meet pulled or dead work,
  research, spikes, or housekeeping during a breakdown, or the user asks to
  remove something.
- `references/rebuild.md` — Load this when: entering REBUILD mode, or unsure
  whether code in front of you should be mirrored (breakdown) or replaced
  (rebuild). The full rebuild method: survey, keep/reshape/drop, hate-capture,
  salvage register, landing the new tree.
