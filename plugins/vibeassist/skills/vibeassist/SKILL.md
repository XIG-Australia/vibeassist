---
name: vibeassist
description: Take the next Ask the user approved in VibeAssist, build it, check it, review it and merge it, so the Ask updates itself. Use when the user runs /vibeassist, or says "build my VibeAssist Asks", "work my VibeAssist queue", "drain my VibeAssist backlog", or similar. Modes — "review" (default: one Ask at a time, confirm before the next), "run" (work through the run, then pause), "drain" (keep going until nothing is approved). Listening roles (smart kickoff, run once per working session): "worker" (build approved Asks, then keep listening — new work starts automatically when the user presses Start in VA), "standby" (the listening loop: call wait_for_work, do what comes — shaping, building, checking and reviewing — and re-arm).
---

<!-- vibeassist-skill-version: 0.43.0 (single-sourced from plugins/vibeassist/.claude-plugin/plugin.json — keep them in step) -->
<!-- 0.43.0 (31 Aug 2026): INGEST CARRIES THE MAP'S ATTENTION ITEMS — a finding becomes an ask, not litter. The map already computes per-page "⚠ Defect worth knowing about" items (dead button, count hard-coded to zero, empty panel, destructive action with no confirm) and a repo-wide Findings section (dead surface, table nothing touches, table with no row-level security, write with no visible feedback), and the ingest was dropping every one — the owner never saw a single defect their own code has. Now each becomes its own `proposed` fix-ask, parented under the ask it is about (a repo-wide finding under the ask it most concerns, else top-level), its want the FIX in plain owner speech ("Show the real needs-you and replies counts — today they are always zero"), never the file:line or the word "defect", held to the copy standard and check_copy'd, with a stable name so a second ingest lands no duplicate. Only what the map actually found, cited to code — never an invented issue; a defect already covered by a proposed gap-ask is not doubled. Purely the ingest instruction — no app change, no migration: a fix-ask is just another `proposed` entry in the reading the app already lands. See references/standby.md § the ingest job. -->
<!-- 0.42.0 (31 Aug 2026): INGEST COPY EXTENDS TO THE ASK'S OWN WORDS, + THREE NAMED FAILURE MODES. 0.41 held component definitions to the copy standard but left the ask's name / want / must-do / must-not untouched — and those were the worst offenders on the first real ingest ("Say what you want in your own words…", "Never take a message when no assistant is listening. Say so instead."). Now EVERY owner-facing word the ingest writes — name, shape lines, definitions — is held to references/ui-copy-standard.md and check_copy'd. That standard gains three failure modes drawn from real ingest copy: redundant qualifiers that state the obvious ("in your own words"), clever phrasing that has to be decoded ("leads with the half you need and the other half is a link away"), and a rule written where a description belongs ("never take a message when no assistant is listening" → "if nothing is listening it tells you instead of losing your message"). See references/standby.md § the ingest job and references/ui-copy-standard.md. -->
<!-- 0.41.0 (31 Aug 2026): INGEST COPY IS PLAIN, AND ACTIONS ARE THEIR OWN COMPONENTS. The ingest job's component names and definitions were coming out in the codebase's own literary comment voice ("makes me sick"), and actions were being buried inside a part's prose so the owner never saw them. Fixed in references/standby.md § the ingest job: every name and definition is now held to references/ui-copy-standard.md (plain and standard — a tooltip, not a novel; never echo the code's comments, which are evidence for the map, not copy for the owner), names are the plainest true label ("Menu", not "Where you can go"), and each distinct action a person DOES is split out as its own component rather than folded into a part's description. check_copy runs on the definitions. Fixes the language + missing-actions complaints on the first real ingest. -->
<!-- 0.40.0 (30 Aug 2026): AN INGEST LANDS ONLY delivered OR proposed. A pipeline status — building, queued, approved, accepted, shaping — must never come out of an ingest: an as-is node is either in the running app (delivered) or a gap the reading noticed (proposed). `building` in particular left ingested asks reading as mid-build forever with no job behind them. The standby ingest instruction now says two statuses only, and the app's landReading clamps it (proposed stays proposed, everything else → delivered) so a stray status can never land. -->
<!-- 0.39.0 (30 Aug 2026): A READING CARRIES COMPONENTS — ingestion lands them, not just the tree. The ingest job now gives each ask its components: every part and behaviour a person sees or does on it (a button, a field, a behaviour like drag-to-resize), each a name + a plain one-block definition built from the map's actions. It leans toward capturing a part AS a component rather than folding it into the shape (granular, easy to edit), never duplicates something that became its own ask, and language-checks the definitions. The reading's asks gain a `components: [{name, definition}]` list; on landing each becomes an ask_components row, already built (definition = built, state live). No migration — ask_components already holds it. App: reading.ts ReadingComponent, ingesting.ts parses it, ingestActions.ts landReading creates them, the import preview shows a per-ask part count. See references/standby.md § the ingest job. -->
<!-- 0.38.0 (30 Aug 2026): COPY IS NOT SHAPED (unless it's long), and the DELIVERY LISTS IT. Shaping stops reviewing short controls — the builder writes them to the copy standard, checker-gated — and shapes copy only when it is more than a few words (a paragraph, an empty state, help text). In return the build hands back every user-facing string it wrote or changed in report_delivery's new `copy`, one per line with the state each shows in, shown as "Words on screen" on the Delivered view — because copy hides across states and the owner can only see it all by triggering each one. App side: asks.delivered_copy (migration 20260916120000), report_delivery gains `copy`, WhatCameBack renders it. See references/delivery-on-asks.md step 8 and the decompose skill § Copy is the builder's, not the shaper's. -->
<!-- 0.37.0 (30 Aug 2026): USE THE WORD EVERYONE KNOWS — UI copy is checked, not invented. New: references/ui-copy-standard.md (the voice — headline rule: the common word, not a description of the action; "Save", never "Place it where it can be retrieved later"; "more words than meaning" is the failure; 1–3 word standard imperatives; follow Shadcn/Tailwind conventions) and scripts/check_copy.mjs (flags the mechanical tells). § 6 gains a guardrail: user-facing words come from the Ask's approved copy, the builder invents none of its own, and every string a build introduces must pass check_copy before it delivers; a needed word with no source is a gap → a question, never an invented phrase. The review judges copy against the standard as a send-back (references/review.md § 5). Shape-first drafting of copy into components is the tracked follow-up. -->
<!-- 0.36.0 (30 Aug 2026): BRING AN EXISTING APP IN — the standby loop handles a new `ingest` job kind. A fresh sub-agent resolves the repo, surveys it with the vibeassist-map skill, hands that to the decompose skill's BREAKDOWN (existing codebase) entry to reproduce the as-is tree — structure, not a shaping walk, with built work marked delivered — and reports the reading as the job's result via complete_job. It does NOT import it: preview_import/import_reading clamp already-built work down to approved, and this is the owner's own app. The owner lands the reading themselves in VibeAssist, at delivered, so no assistant tool ever asserts work is built — accepting stays theirs. Build lane, but reads only: no worktree, branch or merge. See references/standby.md § The job kinds that exist now. -->
<!-- 0.35.0 (26 Aug 2026): BUILD ONLY WHAT THE ASK SAYS — SILENCE IS NOT LICENCE. § 6 gains a binding guardrail: an empty must-not is not permission; the default is the plainest competent version of the want and nothing more; a worthwhile addition goes back to shaping as its own question BEFORE it is built, never slipped into the build to be found and pulled out later. § 4.1a nudges it at the point the Ask is read. The rule's home is the decompose skill § The cake rule — this is the build-time half that was missing, and its absence let unshaped and direct builds invent unrequested features. -->
<!-- 0.34.0 (26 Aug 2026): A REVIEW IS INDEPENDENT BECAUSE IT RUNS IN A FRESH SUB-AGENT, not because it runs in somebody else’s session. A reviewer that has never seen the work built cannot inherit the builder’s assumptions, so ONE listener builds, checks, reviews and merges its own work and NEVER waits for a second listener to exist. The sub-agent is briefed with POINTERS ONLY — job, ask, repo, branch, worktree, contract file — never a summary of what the builder did; it reads get_ask, the real diff and the running thing. The listener holds the claim while the sub-agent works, so a stop mid-review loses nothing. It says “reviewing — a fresh agent is reading it”, never “waiting for another worker”. Retired: “never the builder”, “two listeners is the working arrangement”, and complete_job({ error: “I built this” }). See references/standby.md § INDEPENDENCE COMES FROM THE FRESH SUB-AGENT. -->
<!-- 0.33.0 (26 Aug 2026): THE SKILL IS THE AUTHORITY FOR HOW VA BUILDS. The whole loop is stated once in § 4 — the stages and who ends each, the status ladder, and the database rule — and a project’s CLAUDE.md never overrides it (it owns what the repo IS: stack, branch names, folders, real commands). THE LADDER IS CORRECTED: `building` spans the WHOLE run; `report_delivery` moves NOTHING, it fires the code pass; a PASSING REVIEW writes `delivered` and must carry `mergedCommit` or it is refused; `accepted` is the OWNER’s alone. So a stranded board sits on `building`, not `delivered`. DATABASE CHANGES ARE THE CODE PASS’S: safe ones applied silently, destructive ones gated behind `ask_user` — replacing the old “the owner applies every migration by hand”. -->
<!-- 0.32.0 (26 Aug 2026): the plan records prerequisites as ROWS as well as prose. `needs_first({ askId, needs, forget })` writes what the board acts on — the run order and the one-press “cue those first” — and the prose line is what the owner reads; both name the same asks and never drift. The pass writes the CURRENT set: read first, add each, forget every row it did not name, and do it all BEFORE `report_build_notes`, which ends the job. An unshaped prerequisite still gets a row (the cue-check shows “still needs shaping”); a prerequisite with no ask id gets the prose line only — never an invented row. “Nothing needed” is recorded on both channels. See the decompose skill § Record it TWICE. -->
<!-- 0.31.0 (26 Aug 2026): the PLAN works out the BUILD ORDER. Every plan ends with a line or two saying what has to be built first — whether the parent is a real prerequisite or only a grouping, and any prerequisite that is NOT the parent (a sibling, a cousin, a foundation elsewhere). “No order needed” is written down too: a stated no is information, silence is not. The tree says what groups under what, never what comes first. This pass reasons and RECORDS — it never moves, re-parents or reorders anything. See the decompose skill § Build order. -->
<!-- 0.30.3 (26 Aug 2026): a listener knows its own job and comes back after a stop. Its own-build wait line is SUPERSEDED by 0.34.0 — a listener now reviews its own work in a fresh sub-agent and never waits. Still standing: the `workerId` is PINNED at kickoff, named in the kickoff line and unchanged across a compact; a restart after Ctrl+C is an ordinary kickoff that ENDS ARMED — no recap, no “shall I carry on?”, nothing for the owner to type; and every stop names its reason and the one command back. See references/standby.md. -->
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

**One Ask is THREE jobs, and each runs in its own FRESH sub-agent.** A `build`
makes the branch and reports what it now does. A `code_check` runs the project's
checks on the combined result. A `review` reads it against the Ask and, on a
pass, **merges it**. That merge is the only merge there is. **The reviewer is
independent because it has never seen the work built**, not because it is in
somebody else's session — so **one listener can do all three**.

**There are no pull requests.** Nothing is pushed for review, nothing waits on
CI, and nothing merges itself when checks go green. If you find yourself
reaching for a PR, for `next_approved_ask`, for `report_ask_delivery` or for
`bun run verify`, they are gone and following any of them strands the Ask.

This core is the whole cold happy path. Detail loads on demand from
`references/` in this skill's directory — each pointer below says when.

## THIS SKILL IS THE AUTHORITY FOR HOW VA BUILDS

**Everything about how work moves — the stages and their order, who applies
database changes, and what each status means — is stated here, once, and this
is where it is decided.** A worker following this skill has everything it needs
to run the loop correctly. **You should never have to go looking for the loop in
a project's own notes.**

**A project's `CLAUDE.md` does not override this.** Where one describes the
loop, the statuses, who merges or who applies a migration, **it is out of date
and this skill wins.** Do not follow it, do not average the two, and do not ask
which is right — build to what is written here and say once, plainly, that the
project's file disagrees.

**What a project's own notes ARE for**, and where they still win: what that
repo IS. Its stack, its branch names, its folder layout, the exact commands its
tests and build run under, its house style. **This skill never states those**,
because they are different in every repo — you read them from the project.

**The line, in one sentence.** How VA builds is this skill's. What this
particular code is, is the project's.

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
   Never switch it onto a build branch to get past something — make the Ask's
   own worktree beside it (§ 4.1) or yield.
4. **Settings sync (offer-first, and only a nicety).** If a worker profile sync
   is available to this session, missing allow-rules or an unconfigured profile
   → load `references/kickoff-sync.md` and follow it. **It is never a gate**:
   unavailable, or the user says no, → skip it and carry on. Applying ANY
   settings change is offer-first in EVERY mode — the consent to build an Ask
   never covers the user's settings file.
5. **Listening roles:** invoked as `standby` → load `references/standby.md`
   BEFORE arming the loop. Invoked as `worker` → load
   `references/listening-roles.md`, which sends you to the same place.
6. **ARM THE LOOP — kickoff always ends armed.** Call `wait_for_work` before
   the turn ends. **A restart after a stop is an ordinary kickoff**: do not
   recap the session that stopped, and **do not ask whether to carry on** —
   being started is the go-ahead. A kickoff that says its lines and then sits
   there is a listener that is not listening, and from the outside it looks
   exactly like one that is.

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
- **Finish the whole chain, not just the build.** An Ask is done when it is
  MERGED, and `building` spans the whole run until then. A run that leaves a
  pile of reported-but-unmerged Asks with no code pass and no review behind them
  has not cleared the queue — it has moved the queue. **Keep listening: the check and the review
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
build ──report_delivery──▶ code_check ──all clean──▶ review ──merges──▶ delivered ──▶ accepted
(worker A)                 (worker B)                (worker C)                       (THE OWNER)
```

Each arrow is the app firing the next job. You never call the next step
yourself, and you never do two of the three on the same Ask. **The last arrow is
not yours at all** — see the ladder below.

### The stages, end to end — and what actually ends each one

| Stage          | Who                       | What ends it                                                                                                  |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **build**      | worker A                  | `report_delivery` — what it NOW DOES. **It does not move the status**; it fires the code pass.                  |
| **code_check** | worker B                  | `report_code_check` — what the real commands said, on the combined result, **database changes applied**.        |
| **review**     | worker C, never A         | The reviewer MERGES by hand, then `report_review` with `merged: true` **and `mergedCommit`**. That writes `delivered`. |
| **accept**     | **the OWNER, and no one else** | They open the merged thing, try it, and accept it. Nothing you call can do this.                            |

### The status ladder — three words, and only one of them moves on its own

- **`building` spans the WHOLE run.** It is set when the build starts and it
  stays through the code pass and the review. **An Ask mid-check or mid-review
  still reads `building`** — that is correct, not a stuck board. A review
  passing is the only thing that ends it.
- **`delivered` means the work REACHED THE PLACE THE OWNER CAN POKE IT** — the
  main line, after the merge. It is **not** "the builder said it was done".
  **A passing review is what writes it**, and the pass must carry
  `mergedCommit` — the commit the merge landed as — because `delivered` with
  nothing behind it sends the owner off to look at nothing.
- **`accepted` is the OWNER's, and only the owner's.** It means they looked. No
  worker writes it, no pass writes it, and a review that has just merged has
  certainly not looked — the work arrived a second ago.

> **If you remember one thing:** a build reporting a delivery does **not** make
> the Ask `delivered`, and a review passing does **not** make it `accepted`.
> Both used to be true and neither is now.

### Database changes — the code pass applies them, and destruction is gated

**The code pass applies the database changes the build needs, and names them in
`ranMigrations`.** An unapplied change is a failure exactly like a red test, and
code and database that disagree is another. **A build is not done while either
is true.**

- **Safe and reversible → just apply it.** Adding a table, a column, an index, a
  policy. This is ordinary work: no question, no flag, no waiting on the owner
  (§ 0).
- **Destructive → GATED, every time.** Dropping or renaming a table or a column,
  anything that loses data the owner cannot get back, anything with no way back.
  **Stop and ask through `ask_user` on the job**, which parks it (§ 5) — never
  only in the terminal, and never "I'll do it and mention it after".
- **Anything the owner must run themselves** — because only they can — goes in
  the delivery's `flags` as one plain instruction, and nothing is said when
  there is none (§ 0).

**Where a project's own notes say the owner applies every migration by hand,
that is the old road and this rule replaces it.** What stays the project's is
HOW its migrations are written and run — the folder, the naming, the command.

### 4.0 · GET NAMED. Everything else depends on it.

**Every `wait_for_work` and `next_job` call passes a steady `workerId`** — one
name for this session, the same one every time. **Pin it at kickoff and never
change it**, not even after an auto-compact: a name that changes mid-session is
two workers as far as the app is concerned.

**The `workerId` is who HOLDS a job** — the claim, the lease and the beat all
hang off it. An unnamed listener cannot hold work properly, and the app may
decline to hand it the passes that judge a build at all. A review is the only
thing that merges anything.

**It is not what makes a review independent.** That is the fresh sub-agent: a
reviewer that has never seen the work built has to go and read the code and the
Ask to have any opinion (§ 4.3).

So the failure is silent, and it looks like nothing is wrong: builds run,
deliveries land… and every Ask sits on `building` forever, because `building`
spans the whole run and only a passing review ends it. From the outside it reads
as "the workers aren't finishing". **It is one missing argument.**

**ONE listener is enough.** It builds, checks, reviews and merges its own work,
because the check and the review each run in **a fresh sub-agent that starts from
nothing** and reads the code and the Ask for itself. **Never wait for a second
listener to exist**, and never tell the owner to start one so something can
merge — that is the old road.

**Never run a check or a review in the listener's own context.** That is the
builder marking its own homework. Always hand it out.

If the app declines to offer you the check or the review of your own build, say
so plainly once and keep listening — and **never work around it by changing your
`workerId`**, which is a lie about who you are. Full rule:
`references/standby.md` § INDEPENDENCE COMES FROM THE FRESH SUB-AGENT.

### 4.1 · `build` — make it, report it, leave it

Full playbook: **`references/delivery-on-asks.md`** — read it once per build and
follow it. In short:

a. **Read the Ask** — `get_ask({ askId })`. The `want`, the **must-do** (that IS
the definition of done), the **must-not** (a hard boundary), the `plan` the
owner approved (**build to it** — the three shape lines alone are not your
brief), and `changeAsked` when the owner wants what they already have to be
different. A gap in the Shape is a question, never a guess. An empty line is
empty on purpose — and an empty must-not is not room to add (§ 6: build only
what the Ask says). **Never `list_asks`, never the running app's page, and never
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
`complete_job` after it. **It does NOT move the Ask to `delivered`**: the Ask
stays `building` until a review passes and lands the work (§ 4 · the ladder).

h. **STOP.** **No push. No merge. No cleanup.** Leave the worktree and the
branch exactly where they are — they are the handoff, and removing them strands
the two jobs that come next.

Could not build it → `complete_job({ jobId, error })`, one honest sentence, and
no delivery report. Needing a decision is not a failure: that is `ask_user`.

### 4.2 · `code_check` — a FRESH sub-agent, and nothing here is a judgment

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
the code and the database still agree. **Safe changes you just apply;
destructive ones are asked first** (§ 4 · Database changes).

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

### 4.3 · `review` — a FRESH sub-agent, and THE ONLY THING THAT MERGES

Full contract: **`references/review.md`**. In short.

**A review has exactly TWO outcomes: it MERGES, or it SENDS BACK.** "Held",
"stopped", "left unmerged" are not outcomes — an Ask left on `building` with an
unmerged branch is a review that did not finish, and nobody is watching that
branch.

**It runs in a FRESH sub-agent that has never seen the work built**, briefed
with pointers only — the job, the Ask, the repo, the branch, the worktree, and
`references/review.md`. **Never a summary of what the builder did**; that is the
builder’s assumptions in a new coat. The sub-agent reads `get_ask`, the real
diff and the running thing, and judges from those. **The same listener may have
built it** — the fresh context is the independence, so hand it out and it is a
real review. **Never review from the listener’s own context.**

**The listener holds the job while its sub-agent works**, and beats on a long
one. Stop mid-review and nothing is lost: the claim lapses, the job returns to
the queue, and it is reviewed from scratch. Say **"reviewing — a fresh agent is
reading it"**, never "waiting for another worker".

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

then `report_review({ jobId, passed: true, merged: true, mergedCommit })` —
**`mergedCommit` is the commit the merge landed as, and a pass without it is
refused.** A pass is refused until the merge has landed, because **reporting the
pass is what writes `delivered`** — the work reaching the first place the owner
can open it. **It does not accept anything**; accepting is the owner looking,
and they have not looked yet (§ 4 · the ladder).

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

- **This skill is the authority for how VA builds.** A project's `CLAUDE.md`
  never overrides the stages, the statuses, who merges or who applies a database
  change. It owns what that repo IS — stack, branch names, folders, the real
  commands — and nothing else (§ THIS SKILL IS THE AUTHORITY).
- **The ladder, and only one rung is the owner's.** `building` spans the whole
  run; a passing review writes `delivered` and must carry `mergedCommit`;
  `accepted` is the owner's alone. A delivery report moves nothing (§ 4).
- **The code pass applies database changes.** Safe ones silently, destructive
  ones only after `ask_user`. An unapplied change is a failure like a red test.
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
- **Build only what the Ask says — silence is not licence.** The default is the
  plainest competent version of the want, and nothing more. An empty must-not is
  not permission; anything the Shape does not name is UNDECIDED, not allowed —
  ordinary competence within the want is expected, a new capability, screen,
  option or flourish is not. A worthwhile addition that occurs to you goes back
  to shaping as its own question — "this also wants X you didn't ask for; want
  it?" — for the owner to take or leave BEFORE it is built, never slipped into
  the build for them to find and pull out later. This is the cake rule; its home
  is the decompose skill § The cake rule.
- **Words a user reads come from the Ask, not from you.** Buttons, headings,
  empty states, errors, placeholders — the visible copy uses the Ask's own
  approved words, and you invent none of your own. Where the shape does not pin a
  word you need, use the plain standard term everyone already knows — Save,
  Delete, Cancel, Import, Add — never a description of the action ("Place it
  where it can be retrieved later" is not a Save button). No common word fits and
  none is obvious? That is a gap: ask, don't invent a phrase. **Before you
  deliver, run `scripts/check_copy.mjs` on every user-facing string the build
  introduced and clear every flag.** The standard is
  `references/ui-copy-standard.md`; its first rule is use the common word, and
  "more words than meaning" is the failure. **And list every string you wrote or
  changed in the delivery's `copy`** — one per line, each with the state it shows
  in — because copy hides across states and this is how the owner reads every
  word without triggering each one (`references/delivery-on-asks.md` step 8).
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
