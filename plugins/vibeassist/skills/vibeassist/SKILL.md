---
name: vibeassist
description: Take the next Ask the user approved in VibeAssist, build it, check it, review it and merge it, so the Ask updates itself. Use when the user runs /vibeassist, or says "build my VibeAssist Asks", "work my VibeAssist queue", "drain my VibeAssist backlog", or similar. Modes — "review" (default: one Ask at a time, confirm before the next), "run" (work through the run, then pause), "drain" (keep going until nothing is approved). Listening roles (smart kickoff, run once per working session): "worker" (build approved Asks, then keep listening — new work starts automatically when the user presses Start in VA), "standby" (the listening loop: call wait_for_work, do what comes — shaping, building, checking and reviewing — and re-arm).
---

<!-- vibeassist-skill-version: 0.30.2 (single-sourced from plugins/vibeassist/.claude-plugin/plugin.json — keep them in step) -->
<!-- 0.30.2 (25 Aug 2026): a review ends in a MERGE or a SEND-BACK — never held. A clash that only needs conflict markers resolved is resolved; a STRUCTURAL clash, where the main line has moved the ground the build stood on, is a fail — report_review({ passed: false, found: “<what moved> ; build it again on the current main line” }) — which re-queues the ask for a fresh build on today’s code. complete_job(error) is narrowed to “could not run the review at all”; a conflict never goes down it, and a merge is never forced. See references/review.md § Two outcomes, and only two. -->
<!-- 0.30.1 (25 Aug 2026): every git command targets the REPO’S OWN main line, resolved per job — `git -C <where> rev-parse --abbrev-ref HEAD` — never the literal `main`. In a `master` repo the hardcoded name made every fetch, `worktree add` and merge reach for a branch that is not there, so nothing merged and asks stranded at `delivered`. See references/standby.md § The repo’s main line. -->
<!-- 0.30.0 (25 Aug 2026): THE MERGE MODEL. One ask is THREE jobs to three different workers — `build` → `code_check` → `review` — and the REVIEWER MERGES on a pass. There are no pull requests, nothing waits on CI and nothing self-merges; `next_approved_ask`, `report_ask_progress`, `report_ask_delivery`, `open_pr`, `get_updates` and the whole curl delivery road are gone, along with `bun run verify` as a gate. `code_check` and `review` are live job kinds (see references/code-check.md and references/review.md) — undocumented, they were refused as unknown kinds and every ask stopped at `delivered`. EVERY `wait_for_work`/`next_job` PASSES A STEADY `workerId`: a review may not go to whoever built the thing, so an unnamed worker is never handed one and nothing ever merges. Worktree cleanup belongs to the MERGE, not the builder. -->
<!-- 0.29.0 (25 Aug 2026): `plan` is THE PLAN — one artifact the owner approves and the builder builds to. A `write_build_notes` job is the ONLY pass that writes it (a `shape_ask` never does), it needs the repo because it reads code, it asks the owner NOTHING (a shape too thin to plan says what is unclear in the plan and finishes done), and it is written owner-readable and plan-level, sized to the change. A `build` reads the plan from `get_ask` and builds to it, not to the three shape lines alone. See references/standby.md and references/delivery-on-asks.md. -->
<!-- 0.28.0 (24 Aug 2026): a `shape_ask` job is now the WHOLE shaping conversation — Form and Confirm in one talk, one question at a time through `ask_user`, no verdict and no list handed back. `check_shape` is retired: a stray one is run as the Confirm movement and finished with `report_shape_review({ jobId })` carrying no findings. `report_build_notes` takes `jobId`, not `askId`. See references/standby.md. -->
<!-- 0.27.0 (24 Aug 2026): where a project’s code lives comes from the app — `list_projects` returns `repo: { kind, where }` — and the local register is retired. A project with `repo: null` is one plain question pointing at Project settings → “Where the code lives”, and the listener writes no config of its own. -->
<!-- 0.26.0 (24 Aug 2026): one listener serves every repo. The repository is resolved per job from the job’s `projectId`, the worktree is made under that checkout with `git -C`, and a project with no entry is one plain question, never a guess. -->
<!-- 0.25.1 (24 Aug 2026): an owner-only step — restart the dev server, apply a migration — is stated as one plain instruction, never as a status about yourself, and nothing is said when none is needed. -->
<!-- 0.25.0 (24 Aug 2026): silent completion — the standing manners. Cleanup, worktree and branch tidying, merges, retries and version bumps are part of the work, never a question and never a status update. Interrupt only on a genuine fork (irreversible AND unreadable); never hand back a command to run; a real question is one line; done is one short message about what it now does. Binds the standby listener too. -->
<!-- 0.23.0 (23 Aug 2026): a job kind — `rewrite_finding`: write one shape line again so it carries what a finding still wants, on top of how the line reads NOW. The job carries its own instructions; it finishes through `report_line_rewrite`, empty wording is refused, and what it sends goes on the finding, never on the ask. See references/standby.md. -->
<!-- 0.20.1 (21 Aug 2026): the build worktree goes BESIDE the served checkout, inside the project folder — a sibling named <checkout>-<shortId> — never a global scratch location outside the project. Superseded in part by 0.30.0: the builder no longer removes it. -->
<!-- 0.20.0 (21 Aug 2026): a build makes its own worktree off the latest main line and does every edit, test and commit there. Never build in the served folder; never leave the served folder sitting on a build branch. -->
<!-- 0.19.0 (20 Aug 2026): `write_build_notes` became a live job kind, dispatched to the decompose skill in a fresh sub-agent and reported through report_build_notes. Its builder-facing framing is superseded by 0.29.0. -->
<!-- 0.18.1 (20 Aug 2026): the build path never hunts files for the ask — the board is the app behind get_ask, not a plan/ folder or a board.md; and the playbook is read ONCE per build. Reading code to build the thing is unaffected. -->
<!-- 0.18.0 (20 Aug 2026): a build reads its shape with get_ask on the job's ask id — never list_asks, never the running app's page; and a missing report_delivery fails the job out loud rather than falling back to complete_job and stranding the ask on building. -->
<!-- 0.17.1 (20 Aug 2026): on a build, report_delivery reports AND finishes in one call — it is the last call on the success path; complete_job is the failure path only, never both. -->
<!-- 0.16.0 (20 Aug 2026): asking a question PARKS the job and ends the turn — no polling get_answer, no report_progress to hold a claim; the answer re-queues the job and a fresh helper resumes it. See references/question-channel.md. -->
<!-- 0.14.0 (20 Aug 2026): standby rebuilt on the wait_for_work MCP tool — the curl-and-token poller is retired; a fresh sub-context per job; a build lane and a quick lane, concurrent and bounded. -->
<!-- 0.12.0 (18 Aug 2026): verify inward (green from the tool is not the running thing — open every touched surface after a generator/scaffold/rename/move); the build note is read from code, never transcribed. -->

# VibeAssist Ask runner

You take an Ask the user approved in VibeAssist, build it, check it, review it
and merge it. The user drives WHICH work; you drive HOW.

**One Ask is THREE jobs, and each goes to a different worker.** A `build` makes
the branch and reports what it now does. A `code_check` — someone else — runs
the project's checks on the combined result. A `review` — a third worker, never
the builder — reads it against the Ask and, on a pass, **merges it**. That merge
is the only merge there is.

**There are no pull requests.** Nothing is pushed for review, nothing waits on
CI, and nothing merges itself when checks go green. If you find yourself
reaching for a PR, for `next_approved_ask`, for `report_ask_delivery` or for
`bun run verify`, they are gone and following any of them strands the Ask.

This core is the whole cold happy path. Detail loads on demand from
`references/` in this skill's directory — each pointer below says when.

## 0 · Silent completion — the standing manners

**Do the work, clean up after yourself, merge, report done.** Between taking a
job and finishing it, the owner hears nothing.

**Cleaning up is PART of the work, not a question and not a status update.**
Worktrees and branches tidied, merges, retries, version bumps, a rerun after a
flaky check — none of it is reportable and none of it needs a nod. The owner
asked for the thing to be built; the housekeeping around it is what building it
means.

**Interrupt only on a genuine fork, and only when BOTH are true:**

1. Getting it wrong would cost the owner something they cannot get back, AND
2. you cannot tell which way they would want it.

**One of those alone is not a fork.** A choice you can undo, you make. A choice
you can read off the Shape, you make. A safe, reversible default you simply
take — silently.

**Never hand back a command for the owner to run**, and **never ask permission
for a safe tidy-up.** If the way you tried is blocked, find another safe way; if
there is none, leave the harmless leftover and move on. A leftover folder costs
them nothing. A question costs them their attention.

**Destructive still means confirm** (§ 6). Silent completion covers safe,
reversible work; it is never licence to delete something the owner cannot get
back. That is the fork rule doing its job, not an exception to it.

**A real question is ONE LINE.** Context they already have is not context.

**An OWNER-ONLY step is one plain instruction.** Some things only they can do
— restart the dev server, apply a migration, put a key somewhere. Say it as the
instruction it is: *"restart your dev server to load this."* Never as a status
about yourself — "I have not restarted the app" leaves them working out whether
that is a warning, an apology or a job. **If no such step is needed, say
nothing.** An empty line about it is noise. The delivery's `flags` (§ 4) is the
same rule written into the record.

**Done is one short message: what it now does.** Not a ledger of what you
cleaned up, not a tour of the branches you deleted, not the retries it took.
They asked for a working thing, and the answer is that it works.

**This binds every mode and every role** — review, run, drain, worker and the
standby listener alike.

## 1 · Connect — MCP only

**The whole loop runs on the `mcp__vibeassist__*` tools.** They authenticate
themselves through the one-click connection, and each tool's description carries
its own playbook. There is no token to set, no URL to configure and no checker
script to run.

**Tools missing → this session is not connected.** Say exactly that and point
the user at VibeAssist's **connect screen**. Never ask for a token, never reach
for `curl`, and never simulate a loop that cannot reach anything. Then stop.

**The curl delivery road is gone.** `next_approved_ask`,
`report_ask_progress`, `report_ask_delivery`, `get_updates`, `open_pr` and their
HTTP twins do not exist on either road. If you find yourself composing a
`curl` to `/api/public/claude/…` to move an Ask along, stop — that is the dead
road, and every one of its endpoints answers nothing.

Here is the live surface, end to end:

| What you need                  | The tool                                       |
| ------------------------------ | ---------------------------------------------- |
| Work, handed to you            | `wait_for_work({ workerId })` / `next_job`      |
| What one Ask says              | `get_ask({ askId })`                            |
| Where a project's code lives   | `list_projects` → `repo.where`                  |
| Say what you are doing         | `report_progress({ jobId, note })`              |
| Finish a build                 | `report_delivery({ jobId, does, check, flags })` |
| Finish a code pass             | `report_code_check({ jobId, … })`               |
| Finish a review (and merge)    | `report_review({ jobId, passed, merged, found })` |
| Ask the person something       | `ask_user({ jobId, question, … })`              |
| Give up on a job               | `complete_job({ jobId, error })`                |

## 2 · Kickoff (once per session)

1. **Check the tools are there** (§ 1). Missing → not connected; say so and
   stop.
2. **Pick your `workerId`** — one steady name for this session — and read § 4.0
   below before you call anything. It is the single most load-bearing argument
   in this skill.
3. **Repo safety.** The checkout a project serves from stays on its main line.
   Never
   switch it onto a build branch to get past something — make the Ask's own
   worktree beside it (§ 4.1) or yield.
4. **Settings sync (offer-first, and only a nicety).** If a worker profile sync
   is available to this session, missing allow-rules or an unconfigured profile
   → load `references/kickoff-sync.md` and follow it. **It is never a gate**:
   unavailable, or the user says no, → skip it and carry on. Applying ANY
   settings change is offer-first in EVERY mode — the consent to build an Ask
   never covers the user's settings file.
5. **Listening roles:** invoked as `standby` → load `references/standby.md`
   BEFORE arming the loop. Invoked as `worker` → load
   `references/listening-roles.md`, which sends you to the same place.

## 3 · Mode

Every served Ask carries a `config` block
(`{ mode, onFailure, onQuestion, contextHygiene, selfReview }`) set per-project
— use `config.mode` as the default and apply `config.onFailure` on failures,
unless the user gave an explicit mode at invocation (that overrides). No config
yet → default **review**.

- **review** — ONE Ask, then ask (through `ask_user`) before the next.
- **run** — work the run in order; at its end, ask before going on.
- **drain** — keep taking approved Asks until there are none.
- **standby** — the listening loop: `references/standby.md`. It calls
  `wait_for_work`, hands each job to a fresh sub-context (a quick lane and a
  build lane, concurrent and bounded), and re-arms.
- **worker** — the build listener: `references/listening-roles.md`.

### Overnight drain — the build-overnight doctrine

The VibeAssist rhythm is **plan during the day, build overnight, review in the
morning** — the listener owns the overnight half, and the promise is to clear as
much as possible and ENSURE it happens.

- **Build everything buildable.** In drain (and any overnight run) the default
  is to finish every approved Ask you are handed — never defer buildable work
  for tidiness.
- **Finish the whole chain, not just the build.** An Ask is not done when it is
  delivered; it is done when it is merged. A run that leaves a pile of
  `delivered` Asks with no code pass and no review behind them has not cleared
  the queue — it has moved the queue. **Keep listening: the check and the review
  arrive as their own jobs.**
- **Stop for exactly two reasons,** each recorded where the user will see it:
  (a) it needs a decision — `ask_user`, which parks the job; or (b) it is
  clearly superseded. Anything else gets built.
- **End every run with ONE complete report:** what got merged, what didn't, and
  why for each stop. A run that leaves the owner guessing has failed its promise.
- **The approval gate is the user's.** Approval is the only thing that makes
  work available, and nothing you can pass relaxes it. If the user expects work
  and nothing comes, the answer is almost always that the Ask is shaped but not
  approved — tell them that rather than looking for another way in.

## 4 · The loop — one Ask, three jobs

```
build  ──report_delivery──▶  code_check  ──all clean──▶  review  ──merges──▶  accepted
 (worker A)                   (worker B)                  (worker C)
```

Each arrow is the app firing the next job. You never call the next step
yourself, and you never do two of the three on the same Ask.

### 4.0 · GET NAMED. Everything else depends on it.

**Every `wait_for_work` and `next_job` call passes a steady `workerId`** — one
name for this session, the same one every time.

**A review may never go to whoever built the thing.** An unnamed worker cannot
be told apart from the builder, so the app **never hands a review to one at
all**. And a review is the only thing that merges anything.

So the failure is silent, and it looks like nothing is wrong: builds run,
deliveries land, Asks reach `delivered`… and stop there forever. From the
outside it reads as "the workers aren't finishing". **It is one missing
argument.**

If you are ever handed the code pass or the review of a build you made in this
session, do not run it — `complete_job({ jobId, error: "I built this — it needs
a different worker" })` and keep listening.

**One listener cannot finish an Ask by itself.** Follow the rule to its end: a
lone listener builds everything, so it is the builder of everything, so it is
never handed a review. **Two listeners with two different `workerId`s is the
working arrangement** — each builds its own Asks and reviews the other's. If you
are the only one running and Asks are stacking up at `delivered`, say so to the
owner in one line: *"Start a second listener — a review can't go to whoever
built the thing, so one on its own can't merge anything."*

### 4.1 · `build` — make it, report it, leave it

Full playbook: **`references/delivery-on-asks.md`** — read it once per build and
follow it. In short:

a. **Read the Ask** — `get_ask({ askId })`. The `want`, the **must-do** (that IS
the definition of done), the **must-not** (a hard boundary), the `plan` the
owner approved (**build to it** — the three shape lines alone are not your
brief), and `changeAsked` when the owner wants what they already have to be
different. A gap in the Shape is a question, never a guess. An empty line is
empty on purpose. **Never `list_asks`, never the running app's page, and never
hunt for a `plan/` folder** — the board is the app, not a folder in the repo.

b. **Resolve the repository from the JOB** — `list_projects`, find the job's
`projectId`, use `repo.where`. Never the folder you are standing in. `repo` null
→ one plain question, then stop.

c. **Build in the Ask's own worktree**, a sibling of the served checkout inside
the project folder, named `<checkout>-<shortId>`. Resolve the repo's main line
first — `git -C <where> rev-parse --abbrev-ref HEAD`, call it `<mainline>` — and
never write the literal `main` into a git command:

```bash
git -C <where> fetch origin <mainline>
git -C <where> worktree add -b <branch> ../<checkout>-<shortId> origin/<mainline>
```

Every edit, test, typecheck, build and commit happens there. **Never in the
served folder**, never on a global scratch path outside the project. The served
folder stays on its main line. The name is a handshake — it is how the next two workers
find this work.

d. **Say what you are doing** — `report_progress({ jobId, note })`, one short
line in the product's words, whenever you move to a different part of the work
and every few minutes on a long build. It is also what keeps the job yours:
silence and death look the same from outside.

e. **Stamp every commit** with `VibeAssist-Ask: <askId>` after a blank line.
Load-bearing twice: it links commits to the Ask, and it is what the code pass
reads to answer `broughtIn` honestly.

f. **Get it right before handing it on** — run the project's own tests,
type-check, linter and build as you work, and apply any database change your
work needs. **Verify inward:** after any generator, scaffold, rename or move,
open each touched surface and confirm the real content survived. Green from a
tool is not the running thing being right.

g. **Report it** — `report_delivery({ jobId, does, check, flags })`. `does` is
what it NOW DOES in the person's own words about their own product; `check` is
the branch and what to open; `flags` is anything left for them, usually empty.
**This reports AND finishes the job and fires the code pass** — no
`complete_job` after it.

h. **STOP.** **No push. No merge. No cleanup.** Leave the worktree and the
branch exactly where they are — they are the handoff, and removing them strands
the two jobs that come next.

Could not build it → `complete_job({ jobId, error })`, one honest sentence, and
no delivery report. Needing a decision is not a failure: that is `ask_user`.

### 4.2 · `code_check` — a DIFFERENT worker, and nothing here is a judgment

Full contract: **`references/code-check.md`**. In short:

a. **Work in the worktree the build left** — `<checkout>-<shortId>` under the
job's `repo.where`.

b. **Bring the build up to date FIRST** — merge the main line into the branch
and **fix what clashes.** Do not abort and hand conflicts back.

c. **Check the COMBINED result, never the branch alone.** The branch on its own
is not the thing that would be merged.

d. **Run the project's own checks** — its tests, its type-check, its linter, its
build. Read the real commands off the project; do not invent one and do not run
a subset. **Then the database:** apply the changes this build needs, and confirm
the code and the database still agree.

e. **The honesty contract.** `broughtIn` is every Ask id you merged in, **read
off the `VibeAssist-Ask:` trailers** — not remembered. `ranMigrations` is every
database change you ran, by version. **The app checks both against real state,
and if what you say and what it finds disagree, the build goes back.** Name them
accurately rather than generously.

f. **Report what the commands SAID** —
`report_code_check({ jobId, broughtIn, ranMigrations, tests, types, lint, build, dbAgrees, found })`.
Not what you expected them to say, and not what the build said about itself.
**`found` is owed on any failure**, in enough detail to fix.

g. **Any one false blocks the build right there** — no review starts, nothing
merges, the Ask goes back with `found` on it. All clean is the only thing that
starts a review. **Merge nothing**, and leave the worktree and branch in place
either way.

### 4.3 · `review` — a THIRD worker, and THE ONLY THING THAT MERGES

Full contract: **`references/review.md`**. In short.

**A review has exactly TWO outcomes: it MERGES, or it SENDS BACK.** "Held",
"stopped", "left unmerged" are not outcomes — an Ask left at `delivered` with an
unmerged branch is a review that did not finish, and nobody is watching that
branch.

a. **Only one review runs board-wide at a time.** Nothing else is landing while
you hold it — which is exactly what makes the merge at the end safe.

b. **The code pass is already clean** on the combined result, or this job would
not exist. **That half is settled** — not yours to reopen, not yours to wave
through. What is left is the reading only judgment can do.

c. **The build's own account is a signpost, never evidence.** Use it to find the
work; never believe it about the work.

d. **Bring it up to date again** (something may have landed since — a build
merged from an older start quietly undoes finished work), then **read the
combined result yourself**: `get_ask`, the real diff, and **run the thing.**

**A clash that needs the work REDONE is a fail, not a stop.** An ordinary
conflict you resolve. But where the main line has moved the ground the build
stood on — the counts it attached to are gone, the table it read was replaced —
you cannot merge it, so **send it back**:
`report_review({ jobId, passed: false, found: "<what moved, and why the branch no longer fits>; build it again on the current main line" })`.
That re-queues it and a fresh build works from today's code. **Never force a
merge past a clash, and never route one through `complete_job`.**

e. **Three questions.** Does it do what the Ask wanted? Is every must-do there
and every must-not respected? Was anything built that the Ask never asked for?
Judge against the Ask, not against your taste.

f. **It passes → MERGE IT YOURSELF FIRST**, then report:

```bash
git -C <where> merge --ff-only <branch>
```

then `report_review({ jobId, passed: true, merged: true })`. **A pass is refused
until the merge has landed**, because reporting the pass is what marks the Ask
**accepted** — a pass on an unmerged branch says something happened that didn't.

g. **Then clean up — this is yours, not the builder's.**

```bash
git -C <where> worktree remove ../<checkout>-<shortId>
git -C <where> branch -d <branch>
```

The builder finished long before this point and had to leave those behind for
you. **If nobody does it here, every Ask leaks a worktree and a branch.** Do it
silently — it is part of the work.

h. **It fails → merge NOTHING.** `report_review({ jobId, passed: false, found })`
— and `found` is owed. A build told to try again and not told what to change is
the loop this whole shape exists to prevent. Leave the worktree and branch for
the next build.

**After a few rounds of the same work failing, the app stops it on its own** and
waits for the person rather than going round again.

### Advance per mode

review → ask through `ask_user` before the next Ask. run → at the run's end the
go/no-go goes through a question, never a bare terminal prompt. drain → keep
taking work until there is none.

**Boundary hygiene — an optimisation, never a gate.** Never pause for
`/compact`: self-compact if you can, otherwise SKIP and keep working
(auto-compact carries it). After ANY compact or rotation, re-fetch state from
VibeAssist — durable truth lives there, not in conversational memory.

### The run — one ordered list, and it is theirs

The run is the approved Asks waiting for the next time the user presses go. It
is an ordering, not a container: an approved Ask left OUT of it is still built,
after the queued ones. Nothing becomes invisible by not being queued — that was
the mistake sprints made.

You may **propose** what goes in it and in what order — "six Asks are approved
and aren't in the run; add them?" Their tap is the consent. Read the current run
from `list_asks` (`runPosition` on each row; null means not in it).

### Shaping gate — chat is intake, not a delivery chute

A request that arrives in chat mid-run is INTAKE, never a cue to build inline.
Capture it as an Ask and shape it first: a clarifying-questions walk on the Ask
→ propose the shape → the user AGREES → only THEN is it deliverable work. (The
walk's full mechanics live in the `vibeassist-decompose` skill — its single-Ask
shaping entry is built for exactly this handoff.) You may shape it on the user's
behalf (quicker) rather than making them do it — but work out which Ask it
belongs to, apply the change there (or create a new Ask), and NAME where it
landed. This is the FRONT gate; the review (§ 4.3) is the matching BACK gate.
Approved Asks are already through this gate — build them.

## 5 · Questions — `ask_user`, and it PARKS the job

Anything you need the user for — decisions, ambiguity, risk, or a
capability/environment blocker (missing credential, tool, permission) — goes
through `ask_user({ jobId, question, options, recommendedOptionId, reasoning })`,
in EVERY mode including review. A terminal-only prompt is an invisible stall:
the queue looks healthy while nothing moves.

**Scope it to the job you hold.** The question then shows on the Ask that is
stopped, which is what lets the answer bring that job back to whoever is
listening then.

**Recommendation-first:** whenever you pass `options` (2–4, crisp,
mobile-friendly) you MUST pass `recommendedOptionId` and a one-sentence
`reasoning`, so the user can OK your call in one tap. **A question you could
answer yourself from the Shape is a defect** — answer it, don't ask it.

**Asking parks the job and ENDS your turn on it.** Do not poll `get_answer`. Do
not send `report_progress` to hold the claim — a parked job has no claim and the
call is refused. Do not also report the job failed; the question is already the
record of why you stopped. On a build, commit the work-in-progress on the Ask's
own branch as `[parked] WIP: <ask name>` — a real commit with the trailer, never
a stash — then stop. Full park-and-resume protocol →
`references/question-channel.md`.

## 6 · Guardrails (always binding — history in `references/incidents.md`)

- **Pass a steady `workerId` on every `wait_for_work` / `next_job`.** Without
  it no review is ever handed out and nothing on the board merges (§ 4.0).
- **There are no pull requests.** Never push a branch for review, never wait on
  CI, never expect anything to merge itself. The reviewer merges, by hand, on a
  pass — that is the whole gate.
- **Never commit to or fast-forward the main line except as the reviewer's merge**
  (§ 4.3f), and never inside a build.
- **Never do two of the three jobs on one Ask.** If you built it, you do not
  check it and you do not review it — refuse and say why.
- **Build in the Ask's own worktree, beside the served checkout** (§ 4.1c). One
  worktree per Ask, a sibling of the served checkout inside the project folder,
  off the latest main line. **Which checkout is decided by the JOB's project,
  not by where you were started** — `list_projects` says where each one lives
  (`repo.where`). A project with no repo set is one plain question — the owner
  sets it in Project settings → "Where the code lives" — never a guess. Never
  build in the folder the dev app serves, never leave that folder on a build
  branch, and never put the worktree outside the project.
- **The builder never removes the worktree or the branch. The merge does.**
  Cleaning up at the end of a build strands the code pass and the review;
  skipping it at the merge leaks one of each per Ask, forever.
- **Check and review the COMBINED result**, never the branch on its own — both
  passes bring the main line in first and fix what clashes.
- **Say what a command SAID.** A code pass reports the real result of the real
  command; a red test is `tests: false` with `found` filled in, never a job
  error and never a note to carry on with. An unapplied migration and a
  code/database disagreement are failures exactly like a red test.
- **`broughtIn` and `ranMigrations` are read, not remembered.** The app checks
  them against real state and sends the build back on an overclaim.
- **A fail must say what was wrong.** `found` is owed on any failed check and
  any failed review — a build told to try again with no reason is the loop this
  design exists to prevent.
- **Verify inward** (§ 4.1f): after any generator, scaffold, rename or move,
  open each touched surface and confirm real content survived.
- **Beat while you work** (§ 4.1d). Silence is how a live job gets reclaimed.
- **One delivery report per Ask, right after it, in the product's words.**
- Chat is intake, not a delivery chute: a request arriving in chat is captured
  as an Ask and SHAPED (walk → propose → agree) before any build — never built
  inline. Name which Ask it landed on.
- New work you SPOT becomes a proposal on the board, never a silent diff change.
  Keep changes scoped to the Ask you hold.
- When work comes back, fix your side — **never edit the Ask's shape to make a
  send-back go away.** Work that overstepped or does not work is yours; a shape
  that asked for the wrong thing goes back to the owner as a question.
- Overnight/drain runs build everything buildable, **and see each Ask through to
  merged**, stopping ONLY for needs-a-decision or superseded, each recorded
  where the user sees it, and ending with one complete report.
- Confirm before destructive actions, regardless of mode.
- Stop after 2 consecutive failures and report — don't burn through the queue.
- A claimed job you won't finish never goes quiet — `complete_job` with an
  error, so it returns for someone else.
- NO INVISIBLE PAUSES: every deliberate stop goes through `ask_user`, never
  ONLY the terminal — in all modes. A terminal prompt may MIRROR the question,
  never replace it.
