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
