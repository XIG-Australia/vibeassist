# Skill: vibeassist-decompose — the walk

**Purpose:** Turns a raw idea, or a codebase that already exists, into a tree of asks on your
VibeAssist board — through a question-and-answer conversation where it proposes and you decide.
It also shapes one single ask on its own.
**Who can use it:** Anyone with a VibeAssist account and the plugin installed.
**Arrives from:** Saying "decompose my idea", "break this down into asks", "turn this repo into
asks", "ingest this project" — or, for one card, "shape the export ask", "spec this card",
"flesh out this ask".
  - Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:3
**Reached from outside:** No. It runs in conversation with you.

**Where it sits in the rhythm:** this is the plan-during-the-day half. Nothing reaches the
overnight build until its ask has been through this walk and you have agreed it. It is the
front gate.
  - Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:16-22

**If it cannot reach your board it stops and says so** rather than improvising some other way
to get the work in.
  - Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:26-35

## The vocabulary it works in — read this first
An **ask** is one thing you want, at the level a product owner thinks in. It is not a task —
tasks are how, and they hang underneath an ask as build notes, never as cards. It is not a
detail — options, fields and rules are the ask's *shape* and hang on it, never beside it.
There is one card type, and it nests to any depth.
  - Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:37-53

Every ask has a **kind**, and the list is complete: **place** (where things live — a page, a
piece of fixed chrome, or a widget), **capability** (what you can do at a place), **action**
(one move a person makes), **background** (something that happens with nobody pulling a
trigger), **function** (a named piece of machinery), and **data** (a store the app keeps). The
first four are the surface; the last two are machinery and are referenced, never carded.
  - Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:55-92

## Capability: Decide which of three jobs this is, before proposing anything
**What it's for:** Getting the approach right up front, because proposing a structure for an
app that already exists is a completely different job from imagining one.

### Action: Take a raw idea and propose a shape
- What happens: With no code to read, it uses judgment to propose what the product would need,
  and turns every fork it is unsure about into a question rather than a guess.
- Trigger: "decompose my idea", or an idea with no repository behind it.
- Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:187-191

### Action: Read an existing codebase and mirror it
- What happens: It surveys the code with the mapper skill first — or uses a map already
  produced — and decomposes from that verified output: the map's pages become the top-level
  cards, its capabilities and actions become the candidates beneath, and its findings become
  questions for you.
- Trigger: "break down this app", "turn this repo into asks".
- Rules: the code is the truth. It never invents structure the code does not have. The one
  exception is something the code plainly lacks but obviously should have — that becomes a
  question, never a silent addition and never a silent omission.
- Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:193-213

### Action: Shape one ask and nothing else
- What happens: It skips the tree entirely, finds that one card, and runs the shaping questions
  on it. It tells you which ask the answers landed on.
- Trigger: "shape this ask", or a build session handing over something you said in passing.
- Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:215-221

## Capability: Propose a tree you can actually read
**What it's for:** Getting a structure agreed a piece at a time, instead of dropping a wall of
cards nobody can judge.

### Action: Propose the top level first
- What happens: It offers the top-level cards as a short indented list with one line each, gets
  those agreed, and only then goes deeper — on demand.
- Trigger: After the survey.
- Rules: roughly 10 to 15 cards at a time. Never one massive deep tree. On a large repository
  it chunks by area. **Proposing is its job; deciding is yours.**
- Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:260-267

### Action: Ask questions in one batch
- What happens: Only genuinely ambiguous forks become questions, and they arrive together in
  one round.
- Trigger: Whenever the walk hits something it cannot decide.
- Rules: every question carries a recommended answer, one line of reasoning, and two to four
  crisp options. **A question it could have answered itself from the code is a defect.** If you
  are away, the question goes to your inbox so you can answer from a phone.
- Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:268-283

### Action: Write to the board only after you accept
- What happens: Nothing appears on your board until you have agreed the proposal. The proposal
  itself is the draft.
- Trigger: Your acceptance.
- Rules: nothing is ever created speculatively.
- Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:274-278

## Capability: Shape every ask so it is buildable
**What it's for:** A tree of bare titles is not a finished decomposition — this is what turns
names into something that can actually be built and judged.

### Action: Capture what makes each ask properly specified
- What happens: For each card it captures the defining detail — for a screen, its columns,
  states, behaviour, filters and sorting; for anything else, the inputs, rules, edge behaviour,
  and what "done" observably looks like. Those answers become the card's acceptance checklist.
- Trigger: After the tree is agreed, card by card in batches.
- Rules: it does not block the whole tree on one card's shaping.
- Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:285-298

### Action: Write only what a card adds, never what it inherits
- What happens: A card holds only what it adds underneath its parent. The goal resolves to the
  nearest ancestor that set one; the intent accumulates down the chain; the guardrails are the
  union of every level. Acceptance is the exception — every card carries its own.
- Trigger: Every time it writes a card's shape.
- Rules: **never copy a parent's goal or guardrails onto a child.** The tree already carries
  them down, and a copy is a lie waiting to drift out of step.
- Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:300-311

## The decomposition rules, in plain terms
- Split only where two genuinely different wants fork. More detail about the same want is still
  one card.
- Detail lives on the card, never beside it as a child.
- Prefer a shallow tree — but this is judgment, not law. Defend depth when the thing really is
  nested, and never flatten something real to hit a number.
- **When reading an existing app, reproduce exactly what is there.** A structure read off a
  real app is a fact, not a proposal to be tidied. Four levels in the app means four levels on
  the board.
- No umbrellas: a card must be recognisable from its name alone. The test is whether *you*
  invented the category — a grouping made up to tidy a list is forbidden; a section the app
  actually has keeps its name even when that name is a category word.
- Something quirky or reused widely earns its own card even when it would otherwise be detail.
- Something that should exist and does not becomes a question, never a silent addition.
- Carve by the surfaces people navigate, with the machinery nested beneath — except for the
  things that span every surface, which stay at the top rather than being crammed under
  whichever screen they happen to touch.
  - Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:120-181

## The standing guardrails
- Draft-first: your acceptance is the gate; the board never changes silently.
- Code-grounded: never invent structure the code lacks — raise it as a question.
- Recommendation-first: every question carries a recommended answer and a reason.
- **Never delete.** Retirement is a move to a graveyard with a record, so nothing is lost.
- No umbrellas and no catch-alls: work is homed under the ask it belongs to, creating one when
  none fits.
- An unshaped ask is unfinished work.
  - Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:358-378

**⚠ Worth knowing about:** the file records that the tools it used to name were retired on
2026-07-31 along with the board they wrote to, and names the replacement — a useful precedent,
because the review skill was left naming retired tools for four days after the same change.
— Evidence: plugins/vibeassist/skills/vibeassist-decompose/SKILL.md:331-337
