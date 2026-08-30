# The build job — from the ask to the delivery

**Load this when:** you were handed a `build` job, or you want the build in more
depth than `SKILL.md` § 4 gives it. That section is the loop; this is the
reasoning behind it and the detail that did not fit.

**A build is the FIRST of three jobs on one ask.** You build it and report what
it now does. A **fresh sub-agent** then runs the code pass
(`references/code-check.md`), and another reads it and merges it
(`references/review.md`) — each starting from nothing and reading the code and
the ask for itself. **You do none of those.** Do not push, do not open
anything, do not merge, and do not tidy the worktree away — the merge owns the
cleanup, and the two workers after you need what you leave behind.

## Get named first

**Every `wait_for_work` and `next_job` call passes a steady `workerId`** — one
name for this session. Without it the app cannot tell you apart from the worker
who built the thing, so it never hands out a review, so nothing on the board
ever merges. It is one argument, and it is the difference between a board that
finishes work and a board that fills up with delivered asks nobody can accept.

## Nesting replaces sprints

There is no sprint to pull, no task to claim, and no batch to compose. An ask
already contains asks, so the tree is the grouping — **do not build or ask for a
grouping mechanism.** A big ask is delivered by delivering its children, and
that grouping is one the person authored, not one a machine proposed.

## The loop

1. **The job names the ask. That is the whole scope** — build that one ask,
   nothing beside it.

   **You are served leaves, not parents.** The deepest approved ask comes first,
   and a parent is never handed out while a needed child of it is unfinished. A
   parent is delivered by delivering its children, so serving one directly would
   hand you something you cannot finish. Two things follow:

   - **Do not go looking for the parent.** If a big ask the person is expecting
     does not arrive, its children are arriving instead. That is the system
     working.
   - **Build only the ask you were handed.** Its children are someone else's
     turn — possibly another worker's, right now. Reaching up to the parent, or
     down into a child, is the scope creep this ordering exists to prevent.

2. **Read what you were handed — `get_ask({ askId })`.** That call is where the
   ask comes from and it is the ONLY place you read it. It gives you:

   - **The three shape lines** — the `want`, the **must-do** and the
     **must-not**. The must-do IS the definition of done, and the must-not is a
     hard boundary. Everything outside the shape is out of scope. **A line that
     comes back empty is empty on purpose** — that is a real answer, not a gap
     for you to fill.
   - **`plan`** — **the plan the owner approved**, and you build to it. It is
     not a hint and it is not background: it is "here's what I'll build",
     written before the shaping conversation closed, and your build is what
     makes it true. **The three shape lines alone are not your brief.** Where
     the plan says how the ask will be met, that is the way to meet it.
   - **`changeAsked`** — there when the owner has asked for the thing they
     already have to be **different**. Build the ask to its shape WITH that
     change, and **leave what is already built working until yours lands.**

   Three things about the plan:

   - **An empty plan is a real answer**, not a missing one. It means nothing had
     to be interpreted. Build to the shape and carry on.
   - **A plan that says it could not plan** — it names what the shape leaves
     unclear — is the owner's signal, not yours to solve. Do not guess past it:
     ask, the same as any other gap.
   - **The plan never outranks a must-not**, on this ask or above it. If the two
     genuinely fight, that is a question, not a choice you make quietly.

   **The ask is already in hand — do NOT go looking for it.** It came from a
   tool, and that response IS the ask. **The board lives in the app, behind
   those tools. It is not a folder in the repository.** So do not read a `plan/`
   folder, a `board.md`, or any checked-in file to find out what to build, and
   do not list or grep for one. If a repository you are building in holds files
   like that, they are somebody's notes — the tool is the record, and hunting
   them costs a lot and tells you nothing new.

   **Do not call `list_asks`.** It returns the whole board, it does not carry
   the words on any shape line, and hauling a whole board into a build context
   is bloat for nothing. **Never read the shape off the running app's page** —
   not the screen, not the browser, not scraping. What is on a page is a
   rendering; the tool is the record.

   Reading code, of course, is a different thing entirely: once you know WHAT to
   build, read whatever code you need to build it. The ban is on file-hunting to
   discover the ask, not on reading the codebase.

   No shape, no build. If the want is empty or the shape has a hole in it, that
   is a question, not a guess.

   **A question goes on the job.** `ask_user({ jobId, question, … })` — the
   question shows on the ask that is stopped, and **asking PARKS the job and
   ends your turn on it.** Do not poll for the answer and do not hold the claim.
   The answer re-queues the job and a fresh helper picks it up. Full protocol →
   `references/question-channel.md`.

   **The plan is not a technical brief, and that is deliberate.** It is
   plan-level — what will be built, in words the owner could approve — never a
   list of the steps to take. Below that line, working out HOW is your job.
   Simon: _"I care how it was built only as far as what goes into an ask, but the
   developer task-level work, I don't want recorded."_ So do not file tasks, do
   not create sub-asks to track your own steps, and do not report your working.
   Track your own work however you like; none of it belongs on his board.

3. **Find the repository from the JOB, never from where you are standing.**
   Call `list_projects`, find the entry whose `id` is the job's `projectId`, and
   read `repo.where`. Every git command runs against it — `git -C <where> …`. A
   `repo` of `null` is one plain question and then you stop
   (`references/standby.md` § One listener, every repo). **Never guess**, and
   never fall back to the folder you happen to be running in.

4. **Build in the ask's own worktree, beside the served checkout.** Before you
   touch a file, make a git worktree as a **sibling of the served checkout,
   inside the project folder** — the same parent as the folder the app runs from
   — named `<checkout>-<shortId>`. Resolve the repo's main line first —
   `git -C <where> rev-parse --abbrev-ref HEAD`, call it `<mainline>`
   (`references/standby.md` § The repo's main line) — and never write the
   literal `main` into a git command:

   ```bash
   git -C <where> fetch origin <mainline>
   git -C <where> worktree add -b <branch> ../<checkout>-<shortId> origin/<mainline>
   ```

   No remote on that checkout → cut from the local `<mainline>` instead and
   skip the fetch. App served from `<project>/app` → build in `<project>/app-<shortId>`.
   Plugin from `<project>/plugin` → `<project>/plugin-<shortId>`. Edit, test,
   typecheck, build and commit there and nowhere else.

   **Never run a build in the served folder, never leave the served folder
   sitting on a build branch, and never put the worktree in a global scratch
   location outside the project**: the person's running app would show them
   half-built work and lose whatever they were looking at, and a worktree parked
   outside the project drifts away from the checkout it belongs to. The served
   folder stays on its main line.

   **The name is a handshake, not a convenience.** `<checkout>-<shortId>` is how
   the code-check worker and the reviewer find this ask's work after you are
   gone. Do not name it anything else.

   **LEAVE THE WORKTREE AND THE BRANCH WHERE THEY ARE when you finish.** They
   are the handoff. Removing them strands the two jobs that come after you.
   Cleanup happens once, at the merge, and it is the reviewer's.

5. **Say what you are doing while you do it.**
   `report_progress({ jobId, note })` — one short line in the product's words
   ("wiring the sign-in form to the account it creates"), never files or
   approach. Call it when you move to a different part of the work, and every
   few minutes on a long build.

   This is not decoration and it is not optional on a long build. Two things
   depend on it: the person can see the work happening instead of staring at a
   card that has said "building" for an hour, and your build is known to be
   alive — the lease that decides whether a job gets handed to someone else is
   measured from the last thing you said, not from when you started. Go quiet
   for the full lease and your job is reclaimed, correctly, because from the
   outside silence and death are the same thing.

   **It is refused on a parked job.** A job that asked a question has been put
   down and there is no claim left to keep alive.

6. **Stamp every commit** with `VibeAssist-Ask: <askId>` as the last line after
   a blank line. **That trailer is load-bearing twice over:** it is how commits
   find their way back to the ask, and it is what the code-check worker reads to
   answer `broughtIn` honestly. Without it the link is guesswork and the next
   worker's report is a guess too.

7. **Get it right yourself before you hand it on.** Run the project's own checks
   as you work — its tests, its type-check, its linter, its build — and apply
   any database change your work needs. The code pass after you runs all of them
   again on the combined result and reports what they actually said, so a build
   handed on red simply comes back to you to be built again.

   **Verify inward — green from the tool is not "the running thing is right."**
   After any generator, scaffold, route-gen, rename or move, open **each touched
   surface** and confirm its real content survived. A generator can quietly stub
   a file back to boilerplate and still pass a typecheck. Check the thing, not
   just the exit code. (A route generator once stubbed a real page to
   `Hello "/route"!` and the build reported done.) This is the one thing green
   checks cannot catch, which is why it is yours and not the code pass's.

8. **Report the delivery — and that is the END of the job.**
   `report_delivery({ jobId, does, check, flags, copy })` — the first two are
   owed:

   - **does** — what it NOW DOES, in the words the person would use about their
     own product. Never files, never how it was built. If a sentence would only
     mean something to a developer, it belongs nowhere.
   - **check** — how to look at it: the branch, and what to open once they are
     on it.
   - **flags** — anything now left to them, a database change still to run being
     the usual one. Usually empty, and **empty is a real answer.**
   - **copy** — **every user-facing string this build wrote or changed, one per
     line, each with the state it shows in.** UI copy hides across states — an
     empty state, an error, a loading line — and the owner can only see it all by
     triggering every one. This is how they read every word in one place instead.
     Write the string and where it appears: `"Save" — the button on the form`,
     `"Nothing needs you right now" — the empty needs-you list`. Every word must
     already pass `scripts/check_copy.mjs` and the standard (§ the copy
     guardrail); this list is so the owner SEES them, not a second gate. Empty is
     a real answer when the build touched no words.

   **This call reports AND finishes in one.** It fires the code pass,
   closes the job, and fires the code pass. **Do NOT call `complete_job` after
   it** — the job is already finished and a second finish comes back an error.
   On a build that worked, `report_delivery` is the last call you make.

   Say nothing in the first two parts and it is **refused**, with nothing
   written on the ask. An ask marked delivered with nothing to show is worse
   than one still building. A refusal never throws the build away: the job stays
   yours, so send it again with both parts on it.

   **What you write here is a signpost, not evidence.** The reviewer is told to
   use it to find the work and never to believe it about the work. Write it for
   the person, honestly, and let the two passes after you establish the rest.

9. **Stop there.** The delivery fires a `code_check` job, run by a fresh
   sub-agent; a clean code pass fires a `review`, run by another; the reviewer
   merges it and THAT is what marks the ask `delivered`; accepting is the
   owner's alone. **You do not push. You do not merge. You do not tidy up.** If you find yourself reaching for any of those,
   stop — they belong to the workers after you.

**A build you genuinely cannot do → `complete_job({ jobId, error })`** with one
honest sentence saying what stopped you, written for the person, not for a
developer ("the sign-in page needs a decision about what happens after Google
login", not "blocked on OAuth callback config"). **No delivery report on this
path** — never report a delivery you did not make. Needing a DECISION is not a
failure: that is `ask_user`, which parks the job and brings it back when they
answer.

**One finish per build, never two.** It worked → `report_delivery`, and stop. It
could not be done → `complete_job` with an error, and stop. Never both.

## When work comes back

A build that failed its code pass or its review returns as a `build` job with
what was found written on it. Read that first, fix exactly what it names, and
run the loop again from step 2 in the same worktree. The findings are the brief.

**Fix your side, and never edit the ask's shape to make a send-back go away.**
Where the work overstepped the shape, or simply does not work, that is yours.
Where the shape itself asked for the wrong thing, that is the shaping side and
it goes back to the owner as a question — not a quiet rewrite of the want.

**After a few rounds of the same build failing, the app stops it on its own** and
waits for the person rather than going round again. That is the loop protecting
them, not a fault to work around.

## The run — one ordered list, and it is theirs

The run is the approved asks waiting for the next time they press go. It is an
ordering, not a container: an approved ask left OUT of it is still built, after
the queued ones. Nothing becomes invisible by not being queued — that was the
mistake sprints made.

You may **propose** what goes in it and in what order — "six asks are approved
and aren't in the run; add them?" — and their tap is the consent. Read the
current run from `list_asks` (`runPosition` on each row; null means not in it).

## What does NOT come across

Named individually, because the whole point is that none of it creeps back:

- **Pull requests.** There are none. Nothing is pushed for review, nothing waits
  on CI, and **nothing merges itself when checks go green.** A worker reads the
  work and merges it by hand, and that is the whole gate.
- Sprints, batches, packets, and any tool that composed them.
- A pending-review tray for tasks — an ask's own `proposed` state is the gate.
- A `tasks` table as a board of record. **Curating one does not come across.**
  Do not file tasks to track work.

If you find yourself reaching for one of these, the question to ask is not "how
do I get the new thing into the old machinery" — it is whether the old machinery
should be there at all. That confusion is what this replaced.

## Everything else still binds

The guardrails in `SKILL.md` § 6 are unchanged and apply here exactly: never
commit to or fast-forward the main line; build in the ask's own worktree beside the
served checkout, inside the project folder — never the folder the dev app
serves, never a global scratch location outside the project; every deliberate
stop goes through `ask_user` on the job, never only your terminal;
recommendation-first questions; confirm before anything destructive.
