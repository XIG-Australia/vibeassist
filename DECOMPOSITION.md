# VibeAssist plugin — decomposition

_Assembled by `map/assemble_plugin.py` from `map/_stack.md` and `map/pages/*.md`._
_Do not hand-edit: edit the inputs and re-run._

## Coverage — read this before trusting anything below

| | |
| --- | --- |
| Surfaces written in full | **5** |
| Pages (in the browser sense) | **0 — this repo has none; see the stack note** |
| Capabilities | 20 |
| Actions | 39 |
| Evidence lines (all checked) | 81 |
| Flagged for attention | 4 |

# Stack — and why this repo is mapped differently

**What this repo is:** the VibeAssist plugin for Claude Code. It is not an application. It has
no pages, no router, no database, no server and no user interface. It is four sets of written
instructions — "skills" — that a person installs into Claude Code, plus a handful of helper
scripts those instructions tell Claude to run.

**Why the page-by-page method does not apply here, stated plainly.** The mapping method
assumes a person opens pages in a browser and presses things. Nobody opens anything here. The
skill's own enumerators were run against this repo and both correctly reported nothing:
the route enumerator found no routes directory, and the harvester reported "data layer(s)
detected: NONE" with zero controls and zero database calls. Those are true answers, not
failures — so no page files were invented to fill the gap.

**What was mapped instead, and why it is the honest equivalent.** The person using this repo
is someone typing at Claude Code's prompt. What they meet is a **skill**; what opens it is a
**phrase they say**; what it then does is a **capability**. So each skill gets a file in the
same three-level shape the method demands — plain-language purpose, the trigger, and a
`file:line` citation behind every claim — and the same evidence checker was run over all of
them. The vocabulary changes; the discipline does not.

**How it is delivered:** a person adds the marketplace and installs the plugin from Claude
Code's own prompt. Nothing is downloaded from a website and nothing is signed into.
  - Evidence: README.md:10-19

**How the four skills reach the outside world:** three of them talk to a VibeAssist account —
first choice is a set of connected tools, and a fallback that uses a saved key. The fourth,
the mapper, talks to nothing at all and needs no account.
  - Evidence: README.md:29-44

**Version marker:** all four skills carry the same version, stamped from one manifest, so an
out-of-date install can be detected rather than failing quietly.
  - Evidence: plugins/vibeassist/.claude-plugin/plugin.json:3, README.md:46-48

**Scan provenance:** run 2026-08-08 against commit `12da0b8`, using the bundled
`vibeassist-map` scripts at plugin version 0.8.0 — the same scripts this repo ships.

---

# Skill: vibeassist — the worker

**Purpose:** The overnight builder. It takes work you have already approved on your VibeAssist
board, builds it on your own machine, opens a pull request, and reports each piece back so the
board updates itself.
**Who can use it:** Anyone with a VibeAssist account and the plugin installed. It cannot work
without an account — the work comes from your board.
**Arrives from:** Saying "work my VibeAssist sprint", "pull my VibeAssist tasks", "drain my
VibeAssist backlog", or running the skill by name.
  - Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:3
**Reached from outside:** Yes, and this is the point — once it is listening, your pressing
Start on the VibeAssist board is what sets it going. You do not type anything else at the
terminal.
  - Evidence: plugins/vibeassist/skills/vibeassist/references/listening-roles.md:7-11

**Shows on start:** Nothing, when everything is fine. It checks its connection, checks its
tools, and says nothing if all is well — it speaks only when there is something to say.
  - Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:75-79

**There are two roads, and it checks which one it is on first.** If the newer approved-ask
tool is available, that is the delivery loop and it follows that instead. The older
sprint-and-task loop still works for sprints already queued on it, but nothing new is sent
that way. Two rules bind on both roads regardless: every question goes to your inbox, and the
guardrails always apply.
  - Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:12-27

## Capability: Prove the connection before doing anything
**What it's for:** Making sure a run that cannot reach your board says so immediately, instead
of looking healthy while nothing moves.

### Action: Check the connection
- What happens: It reports one of five verdicts and acts on each differently.
- Trigger: Automatic, at the start of every run.
- Feedback: **configured** — carry on. **MISSING** — walk you through setting up.
  **STALE** — your saved key is fine, this session is holding an old copy; restart, do *not*
  make a new key. **REVOKED** — the key it actually read was rejected; make a new one.
  **UNREACHABLE** — a network problem, not a key problem.
- Rules: the distinction between STALE and REVOKED exists because getting it wrong sent people
  into a pointless loop of regenerating a perfectly good key. And when the *check itself*
  breaks, it says so and never tells you your key is bad.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:53-66
- Evidence: the reason the check reads the saved file rather than trusting the session plugins/vibeassist/skills/vibeassist/scripts/va-check.sh:16-21

### Action: Check its own tools are present
- What happens: It looks for the tools it needs and grades what is missing.
- Trigger: Automatic, once per session.
- Rules: a missing pull-request tool is not fatal, because the app opens pull requests itself;
  a missing package runner just means using the other one; a missing version-control or
  runtime tool genuinely blocks, and that becomes a question in your inbox.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:81-85

### Action: Refuse to build in the wrong place
- What happens: Before touching any files, it checks it is not on the main branch and that no
  other worker holds the same folder. Not safe means it stops.
- Trigger: Automatic, before any work.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:86-89
- Evidence: it also checks the folder is the right repository at all plugins/vibeassist/skills/vibeassist/SKILL.md:152-158

## Capability: Work through approved work overnight
**What it's for:** Clearing as much as possible while you are asleep, and making sure it
actually happens rather than stalling silently.

### Action: Choose how much to do in one go
- What happens: Four settings decide the pace — **review** does one piece then asks; **sprint**
  does a whole batch then asks; **drain** keeps going until nothing is left; **worker** and
  **standby** keep listening for more.
- Trigger: How you invoke it, or the setting stored on your project.
- Rules: what you say when you invoke it always beats the stored setting. With no setting at
  all, it does one piece at a time and asks.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:99-116

### Action: Work out what has to be built first
- What happens: It reorders the work so the things other things depend on get built first, and
  tells you the order it chose.
- Trigger: Automatic, after pulling the work.
- Rules: the order the work arrives in is treated as a hint, not the truth.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:160-165

### Action: Ask everything it can foresee, up front, in one batch
- What happens: Before writing any code it reads every piece of work and raises all the
  questions it can see at once, rather than interrupting you five times.
- Trigger: Automatic, before building.
- Rules: it first checks which questions you have already answered so it does not ask twice.
  If it can foresee nothing, it starts building immediately.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:167-171

### Action: Build one piece
- What happens: It claims the piece so nothing else takes it, builds it in its own separate
  working folder, and stops if someone else got there first.
- Trigger: Automatic, per piece.
- Rules: **the acceptance checklist on the work is the definition of done** — everything on it
  must be met, and anything not on it is out of scope and becomes a proposal rather than a
  quiet change. Work that arrives with an empty checklist is under-specified, and it asks
  rather than guessing what "done" means. It never builds on the main branch.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:186-192
- Evidence: it holds the checklist as its objective so a long build cannot drift off it plugins/vibeassist/skills/vibeassist/SKILL.md:197-203

### Action: Check its work before opening anything
- What happens: It runs the same checks the build system runs — types, style, formatting,
  tests, and a full build — and all of them must pass before any pull request is opened.
- Trigger: Automatic, before every pull request.
- Rules: never on a subset. If it changed anything about the database shape it also regenerates
  the type definitions and includes them, because a stale one is the most common thing that
  blocks a release.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:216-222

### Action: Report each piece the moment it is finished
- What happens: It sends back a plain-English note for you and a technical note for a
  developer, as two separate things, plus what it changed.
- Trigger: Automatic, right after each piece — never batched at the end.
- Rules: **every item on the acceptance checklist must be matched to the evidence that proves
  it** — preferably a named test that ran. A criterion with no evidence makes the piece
  incomplete, not done. If it genuinely could not finish, it says so honestly rather than
  claiming success.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:236-253
- Evidence: every finished report must carry a "Manual steps:" section and an "Outside the ask:" section, or say "none" plugins/vibeassist/skills/vibeassist/SKILL.md:339-343

## Capability: Ask you things without stopping dead
**What it's for:** Making sure a question never becomes an invisible stall — a queue that looks
healthy while nothing is moving is the failure this exists to prevent.

### Action: Put a question in your inbox
- What happens: The question appears on your VibeAssist board where you can answer it from your
  phone, and the piece of work is marked as blocked.
- Trigger: Anything it needs you for — a decision, an ambiguity, a risk, or a missing tool or
  permission.
- Rules: **a terminal-only question is treated as a defect**, in every mode. Whenever it offers
  you choices it must offer two to four, recommend one, and give a one-line reason — so you can
  agree with one tap. A question it could have answered itself from the brief is also a defect:
  it should answer it, not ask it.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:288-311

### Action: Park cleanly and keep going
- What happens: Work in progress is committed as a labelled, recoverable commit — never
  stashed — and it moves to the next piece that does not depend on the parked one.
- Trigger: After raising a question.
- Rules: an answered question outranks fresh work. If it runs out of safe work with nothing
  answered, it says the questions are waiting and stops rather than hanging forever.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:313-321

## Capability: Refuse to take work straight from chat
**What it's for:** Stopping a passing remark becoming an unreviewed change — the front gate
that matches the review at the back.

### Action: Treat a mid-run request as intake
- What happens: Something you say mid-run is captured as an ask and shaped first, never built
  on the spot. It works out which existing ask it belongs to, applies it there or creates a new
  one, and tells you where it landed.
- Trigger: Any request that arrives in conversation while it is running.
- Rules: it may do the shaping for you rather than making you do it, but the shaping has to
  happen and the landing place has to be named. Work pulled from the queue has already been
  through this gate and is built.
- Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:277-287

## The standing guardrails
These bind on every run, in every mode:
- Never push to or commit to the main branch. Branch, open a pull request, and stop — a human
  merges.
- Open pull requests as drafts while still pushing; mark ready exactly once, as the final act.
- One finished report per piece, immediately after that piece.
- Overnight runs build everything buildable and skip only for two reasons — needs more
  information, or clearly superseded — each logged with its reason.
- Confirm before anything destructive, regardless of mode.
- Stop after two failures in a row and report, rather than burning through the whole batch.
- A claimed piece it will not finish is released rather than left looking in progress.
- Never print or record your key.
  - Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:323-356

**⚠ Worth knowing about:** the skill documents an override it calls temporary — a forced drain
currently overrides the standing agreement that work waits in the pool, and the file says
plainly that this is unresolved and must not be treated as the final shape. — Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:127-134

---

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

---

# Skill: vibeassist-map — the mapper

**Purpose:** Reads a codebase and produces a map of it the way its *users* meet it: every page,
what a person can do on each, and which database tables each action reads or writes — with a
citation behind every single claim, checked before the map is written.
**Who can use it:** Anyone with the plugin installed. **This is the only one of the four that
needs no account and no connection.** Point it at a repository and it works.
  - Evidence: README.md:29-31
**Arrives from:** Saying "map this codebase", "understand this app", "document what this app
does", "import this codebase", or "create a sitemap from code".
  - Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:3
**Reached from outside:** No. It runs against a repository you already have.

**The bar it sets itself:** a competent builder who has never seen the codebase should be able
to rebuild the app from the map alone, and it would work the same way — different look,
identical behaviour. Every rule in it serves that test.
  - Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:12

**The rule the whole skill turns on:** everything is described at three levels, in order —
plain user language with no code words in it, then the visible thing you press, then the
technical trace with citations. The first two are the deliverable; the third exists so the
claims can be checked. Level-three vocabulary is never allowed to leak upward.
  - Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:16-22

## Capability: Find every page without relying on memory
**What it's for:** A list of pages recalled rather than extracted is the single easiest way for
a map to be quietly incomplete.

### Action: Enumerate the pages mechanically
- What happens: It runs a script that reads the routes out of the code, then sorts every one
  into three lists — pages a person opens and stays on, old addresses that send you elsewhere,
  and addresses only another computer ever requests.
- Trigger: Automatic, phase 1.
- Rules: **100% of the pages a person opens get a full write-up.** Machine-only addresses and
  old redirects each get one line in their own appendix — never dropped silently, because
  hiding real surface area is how a map lies. It handles file-based routers and config-based
  ones with two different scripts, and says to enumerate by hand on the same rules for
  conventions it does not know.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:30-49
- Evidence: `routes_file_based.py` plugins/vibeassist/skills/vibeassist-map/scripts/routes_file_based.py:1-5, `routes_react_router.py` plugins/vibeassist/skills/vibeassist-map/scripts/routes_react_router.py:1-5

### Action: Work out how the pages link to each other
- What happens: A script scans the whole codebase for links, attributing the ones in shared
  navigation to "global navigation" rather than to any single page.
- Trigger: Automatic, phase 2.
- Rules: navigation hides in four places, and it checks all four — links in the page itself,
  the shared sidebar and footer, lists of addresses the navigation is built from, and rails
  whose addresses are assembled from a list so the finished address appears nowhere in the
  code. It normalises the four different ways frameworks write a placeholder before comparing,
  because otherwise every page with a changing part in its address falsely looks unreachable.
- Rules: **a page with no inbound link is a claim, not an observation** — it must be checked
  against all of those before being reported.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:51-66
- Evidence: `gen_edges.py` plugins/vibeassist/skills/vibeassist-map/scripts/gen_edges.py:1-4

## Capability: Gather the evidence before writing a word
**What it's for:** Making an honest citation cheap — you have the line number in front of you
before you write the sentence, rather than hunting for one to justify a sentence you already
wrote.

### Action: Harvest what every page touches
- What happens: One script resolves each page plus its imports two levels deep and pulls out,
  with line numbers, every control, every server function and every database call, tagged as a
  read, an insert, an update or a delete.
- Trigger: Automatic, once, before the per-page work.
- Rules: **what it produces is a list of candidates, not a list of claims.** Following imports
  two levels deep offers a page far more tables than it actually touches — a dashboard can be
  offered 23 while truly using 8 — so each one has to be confirmed as something the page's own
  controls actually reach. A page offered more than about ten tables is almost certainly
  inheriting them.
- Rules: **it refuses rather than guessing.** If it finds controls but cannot recognise the
  data layer, it stops with an error instead of producing a map that would falsely claim
  nothing touches any data. If everything comes back empty it warns that imports are not
  resolving, and says to fix that first — because a map written from an empty harvest is a
  confident wrong answer, which is worse than no map.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:70-81
- Evidence: `harvest.py` plugins/vibeassist/skills/vibeassist-map/scripts/harvest.py:1-5

### Action: Write up one page at a time, in the order people reach them
- What happens: Each page is written in its own pass — the public entrances first, then
  everything the shared navigation reaches, then the interior by distance from the entrances.
- Trigger: Phase 3, per page.
- Rules: the order exists so that a run cut short still leaves a useful map, missing the
  least-visited part rather than a random half. **Never reduce depth to increase count** — a
  shallow page is worse than a missing one, because a missing one is honest.
- Rules: every action must also state the **rules** its path passes through — the condition
  that gates a write, the formula that produces a number, the ordering rule. A rule that cannot
  be stated plainly is an action that has not been finished, and it is the first thing a
  rebuild gets wrong.
- Rules: each capability must carry one line saying what it is *for* — what a person achieves
  by using it, not a restatement of its name.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:84-104

## Capability: Refuse to publish a claim it has not checked
**What it's for:** This is the difference between a map and a plausible-sounding document.

### Action: Check every citation
- What happens: A script pulls out every citation, confirms the file exists, confirms the line
  range is real, and confirms the cited lines actually contain the things named in the claim.
- Trigger: Phase 4, before assembling anything.
- Rules: **existing is not enough** — a citation can point at a real file and the wrong line.
  A failure means going back to the code, not softening the wording until it is vague enough to
  be safe; that would produce exactly the useless output the skill exists to prevent. Anything
  that cannot be re-verified is marked unverified in plain sight.
- Rules: the script may be fixed if it is genuinely wrong, but the fix and the failing case
  must be reported, and it may **never** be edited to make one of your own claims pass — "a
  gate you widened is not a gate".
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:107-124
- Evidence: `check_evidence.py` plugins/vibeassist/skills/vibeassist-map/scripts/check_evidence.py:1-5

## Capability: Assemble the result the same way every time
**What it's for:** Stopping the map changing shape depending on who assembled it.

### Action: Build the map, the data index and the machine-readable version
- What happens: One script writes the whole document — a coverage table with counts read from
  the data rather than typed, the sitemap, every page, an index of which page reads and writes
  each table, and up to ten more sections built from the scan: what runs on its own, what the
  app emails out, the states records move through, what gets deleted along with what, the
  sign-in journey, where free stops and paid starts, who is allowed to do what, and which keys
  and outside services the app needs. A second script produces the same thing as structured
  data, and a third draws the sitemap as a proper tree.
- Trigger: Phase 5.
- Rules: **never write the map by hand.** The findings it computes are candidates, not
  verdicts — each must be checked against the code, and one that turns out to be intentional
  keeps its line with a note saying so, because deleting it hides the question from the next
  reader.
- Rules: if the structured output warns that it read no harvest, the file is pages and nothing
  else — half a reading wearing a complete one's face — and must be fixed before it is handed
  over.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:125-145
- Evidence: `assemble.py` plugins/vibeassist/skills/vibeassist-map/scripts/assemble.py:1-5, `emit_map_json.py` plugins/vibeassist/skills/vibeassist-map/scripts/emit_map_json.py:1-4, `tree_from_map.py` plugins/vibeassist/skills/vibeassist-map/scripts/tree_from_map.py:1-4

## Capability: Record what is broken while tracing it
**What it's for:** Somebody tracing what a button does is in the perfect position to notice
that it does nothing — and that is first-class output, not a digression.

### Action: Note a defect on the thing it is about
- What happens: A one-line note is attached to the page, or to the specific control, saying
  what is broken in user terms with its own citation.
- Trigger: Whenever tracing reveals one.
- Rules: one line per defect, never two joined into a sentence, because they are carried
  separately and attached individually.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:189-191

**What it can handle:** file-based routers, config-based routers, and apps with no router at
all — for which it maps screens instead of pages and attributes data calls to the function
that contains them.
  - Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:145
  - Evidence: `nav_edges.py` plugins/vibeassist/skills/vibeassist-map/scripts/nav_edges.py:1-3, `index_calls.py` plugins/vibeassist/skills/vibeassist-map/scripts/index_calls.py:1-3

**It tests its own output format.** A self-test checks the structured output still matches what
an importer expects.
  - Evidence: `selftest_emit_map_json.py` plugins/vibeassist/skills/vibeassist-map/scripts/selftest_emit_map_json.py:1-3

---

# Skill: vibeassist-review — the morning review

**Purpose:** Walks what got built overnight and judges each delivery against what was actually
asked for, one thing at a time, demanding evidence rather than accepting a plausible report.
**Who can use it:** Anyone with a VibeAssist account and the plugin installed.
**Arrives from:** Saying "review what got built", "morning review", "what happened overnight",
"did it actually do what we agreed", or similar.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:3
**Reached from outside:** No. It runs in conversation with you.

**Not to be confused with the worker's "review" mode.** That mode paces how work is *pulled*
during a build. This judges *finished* work afterwards. Same word, different moment.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:130-132

**The posture, and it is the whole point:** you did not write this code — even if another
session of you did. It reads as a sceptic. Where it is uncertain, the default is *not
verified*. **A verdict is earned by evidence, never granted by a plausible report.**
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:14-17

**It states plainly what it cannot do.** There is no tool that records a review verdict from
this seat — the three that did were retired on 2026-07-31 along with the board they wrote to,
and this file went on naming them until 2026-08-04. Rather than pretend, it names the two paths
that do work: the verdict can be recorded by a job that exercises the feature, or you can send
the ask back on the board and your words travel with it. Its job here is to show you the
evidence and say what it thinks — not to stamp the record itself.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:27-44

## Capability: Get one complete picture before judging anything
**What it's for:** Making sure nothing that needs your attention is buried inside a report you
would have to go looking for.

### Action: Gather everything that finished
- What happens: It pulls everything completed since the last review, with each report's notes,
  technical details, commits, branch, pull request and build state, and groups the deliveries
  **by the ask they serve** — because you review capabilities, not commits.
- Trigger: Automatic, at the start.
- Rules: a report missing its required sections is itself a finding.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:46-54

### Action: Give you the morning digest
- What happens: One message covering what was delivered in your language, what was skipped and
  why, **every manual step collected into one deduplicated checklist in run order**, anything
  done outside what was asked for, notable errors the builder worked around, and any questions
  still waiting.
- Trigger: Automatic, before any judging.
- Rules: **nothing you have to do by hand may hide inside a task report** — a manual step you
  never saw is a delivery that silently does not work.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:56-70

## Capability: Judge each delivery against what was agreed
**What it's for:** Making the board's delivered-versus-agreed picture something you can
actually trust.

### Action: Demand evidence for every acceptance criterion
- What happens: For each criterion it looks for evidence on a three-rung ladder — strongest is
  a named test that ran and passed; next is a line of code it read itself and confirmed does
  what the criterion says; weakest is a claim in the report, accepted only where there is
  genuinely nothing testable, and said out loud when used.
- Trigger: Per ask.
- Rules: **uncertain means fail.** A criterion with no evidence is not done — the rule that
  bound the builder binds the reviewer harder. It uses each ask's own criteria, never ones
  inherited from a parent.
- Rules: the builder's own self-check is not a substitute — that one had the author's context,
  and this one deliberately does not.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:72-90

## Capability: Turn what it finds into something that survives the session
**What it's for:** A conclusion that lives only in one conversation window is one the board
will contradict tomorrow.

### Action: Put each verdict to you, one at a time
- What happens: Each verdict goes to your inbox on its own, with a recommendation. Your tap is
  what records it — you accept the ask, or you send it back and your words go with it.
- Trigger: Right after judging that ask.
- Rules: **never batched.** A list of six verdicts is a list nobody answers.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:92-97

### Action: Turn a finding into a new ask
- What happens: Something genuinely missing or wrong becomes a new ask underneath the one it
  came from, proposed for you to accept.
- Trigger: Any real finding.
- Rules: **a finding that becomes a note evaporates.** It has to become work.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:98-101

### Action: Work out why something missed before sending it back
- What happens: It asks whether the *build* was wrong or the *ask itself* was wrong. If the ask
  was badly specified, that goes back through the shaping walk and gets fixed first.
- Trigger: Before any send-back.
- Rules: **rebuilding to a broken specification fails twice.**
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:102-107

## What this skill deliberately is not
- **Not a fix-it session.** A problem found becomes a send-back or a new ask, never an inline
  patch from the review chair.
- **Not a merge authority.** A human merges; the verdict informs that call, it never performs it.
- **Not a rubber stamp for a green build.** Passing tests prove the named tests pass and say
  nothing about criteria no test covers — which is exactly why the evidence ladder has three
  rungs rather than one.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:117-132

## The standing guardrails
- Never state a verdict without the evidence trail, and never a stronger one than the evidence
  supports.
- Default to fail when uncertain.
- One verdict per ask, recorded right after judging that ask — never batched at the end where
  one stall loses them all.
- Surface every manual step.
- Never fix during review; never delete anything; you are the gate on every send-back and every
  new ask.
- Findings about the *process* — a missing report section, missing evidence, a criterion that
  could not be tested as written — are recorded too, because the loop only improves if the
  review says where it creaked.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:134-143

---

# How the plugin reaches people, and how it keeps itself honest

**Purpose:** Not a skill — the machinery that gets the four skills onto someone's machine and
stops them drifting apart from each other once there.
**Who it affects:** Everyone who installs the plugin, whether they ever think about it or not.
**Arrives from:** Two commands typed at Claude Code's own prompt — not a terminal, and not a
website.
  - Evidence: README.md:12-19

## Capability: Install and update the plugin
**What it's for:** Getting four sets of instructions onto a machine without anyone downloading
a file or signing into anything.

### Action: Add the marketplace and install
- What happens: Claude Code fetches the plugin from the repository and the four skills become
  available by name and by phrase.
- Trigger: `/plugin marketplace add` then `/plugin install`, at Claude Code's prompt.
- Rules: they are Claude commands, not terminal commands — the README says so explicitly,
  because typing them into a terminal is the obvious mistake.
- Evidence: README.md:12-19
- Evidence: what the marketplace advertises .claude-plugin/marketplace.json:9-18

### Action: Get updates
- What happens: Updates arrive on their own; a command forces one immediately.
- Trigger: `/plugin marketplace update`
- Evidence: plugins/vibeassist/README.md:23-25

## Capability: Let a session with no filesystem still read the skills
**What it's for:** A cloud session cannot install a plugin, so the skills have to reach it
another way — and the only channel that reaches one is the VibeAssist connection itself.

### Action: Keep a written list of every skill file
- What happens: A build step walks the skills folder and writes out a list of every skill, what
  it is for in its own words, and every file it contains.
- Trigger: Run by hand after adding, removing or renaming any skill file.
- Rules: the connection runs on a server with no checkout and no filesystem, so it fetches
  these files over the web — and GitHub's own listing service is rate-limited hard enough to be
  unusable for that. Hence a list committed next to the thing it describes. Each skill's "when
  to use" line is taken from the skill's own words rather than written separately, so the two
  cannot disagree.
- Evidence: plugins/vibeassist/skills/build-manifest.mjs:1-11
- Evidence: it reads the description out of the skill itself plugins/vibeassist/skills/build-manifest.mjs:25-31
- Evidence: the list it produces plugins/vibeassist/skills/manifest.json:1-8

**⚠ Worth knowing about:** the list is only correct if somebody remembers to run the build step
after changing a skill's files. Nothing enforces it — the instruction to run it is a comment in
the script. — Evidence: plugins/vibeassist/skills/build-manifest.mjs:11-12

## Capability: Make a stale install detectable
**What it's for:** An out-of-date copy of the instructions that fails quietly is worse than one
that says so.

### Action: Stamp every skill with the same version
- What happens: All four skills carry the same version marker, taken from one manifest.
- Trigger: Automatic, at build time.
- Rules: the worker checks the version the server reports against its own on every run, and if
  the server's is newer it tells you in one line to update and leaves a breadcrumb on the first
  piece of work it claims — otherwise it says nothing.
- Evidence: plugins/vibeassist/.claude-plugin/plugin.json:3, README.md:46-48
- Evidence: the check on every run plugins/vibeassist/skills/vibeassist/SKILL.md:93-96

### Action: Stop the README drifting from what actually ships
- What happens: A test asserts every skill folder is named in the plugin's README, so adding or
  renaming a skill without updating the README fails the tests.
- Trigger: Automatic, in the test suite.
- Rules: this exists because it has drifted before.
- Evidence: plugins/vibeassist/README.md:10-13

### Action: Ship files that work on every operating system
- What happens: Every file is committed with one style of line ending regardless of the machine
  it was written on.
- Trigger: Automatic, on every commit.
- Rules: the shell scripts break on Mac and Linux if they arrive with Windows line endings, and
  this repository is written on Windows — so the rule is set once at the repository level rather
  than relied on per file.
  ⚠ **Not citable by the checker, verified by reading.** The rule lives in the repo's
  `.gitattributes`, and the evidence checker can never cite it: its citation pattern caps a
  file extension at 10 characters and "gitattributes" is 13. The file says, in its own words,
  "Everything ships with LF. The shell scripts break on macOS and Linux if they arrive with
  CRLF, and this repo is authored on Windows", then sets `* text=auto eol=lf`.

## Capability: Give the worker helper scripts it can actually run
**What it's for:** A check the machine refuses to run because it needs approval every time is
not a check.

**The three scripts, and why they are files rather than typed-out commands:** an inline
compound command asks for permission every session, so the connection check, the tool check and
the listening loop each ship as a file that a person approves once by name. The skill says to
install them by **copying the packaged file, never by transcribing it**.
  - Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:30-33, the approval reason plugins/vibeassist/skills/vibeassist/SKILL.md:45-49
  - Evidence: the listening loop's filename must never change, because the approval matches the exact string plugins/vibeassist/skills/vibeassist/references/listening-roles.md:15-18

**The connection check prints its own version.** A session can tell an outdated copy from a
current one without reading the file, and the skill refuses a copy older than version 3 —
because a stale checker lies with authority.
  - Evidence: plugins/vibeassist/skills/vibeassist/scripts/va-check.sh:2-4, the refusal rule plugins/vibeassist/skills/vibeassist/SKILL.md:51-53

## Capability: Remember why every rule exists
**What it's for:** A rule without its reason gets argued with, re-litigated, or dropped.

**An incident archive sits beside the worker skill**, one entry per thing that went wrong: what
happened, the rule it produced, and where that rule now lives. It is explicitly never needed on
the happy path — it is loaded only when a rule needs justifying.
  - Evidence: plugins/vibeassist/skills/vibeassist/references/incidents.md:1-6

