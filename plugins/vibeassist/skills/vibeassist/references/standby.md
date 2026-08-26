# Standby — the listening loop

**Load this when:** the skill was invoked as `/vibeassist standby` — read it
BEFORE arming the loop.

Standby is a connected session that listens. One command puts it into
listening; from then it calls `wait_for_work`, does what comes, and calls
again, until the user stops it. The user starts it once and never types into
the terminal again — anything you need from them goes through `ask_user` on
the job, never a terminal prompt.

**The standing manners bind here too** — SKILL.md § 0 · Silent completion. A
listener is the quietest role there is: between a job arriving and its reporting
call, the owner hears nothing. Tidying up after a build is part of the build,
never an `ask_user`, and never a line of narration.

## The loop is a TOOL CALL, not a script

`wait_for_work` is one of the `mcp__vibeassist__*` tools this session already
holds. The app holds the call open for about twenty-five seconds and answers
the moment there is work. **That call, repeated, IS the loop.**

There is no poller. `scripts/va-standby.sh` — the `curl`-and-token loop the
old app needed — is retired, not adapted: no `VIBEASSIST_TOKEN`, no
`VIBEASSIST_URL`, no HTTP endpoint, no allow-rule for a bash loop. The
connection is the assistant's own.

**Tools missing → you are not connected.** Say exactly that and point the user
at VibeAssist's connect screen. Never ask for a token, never reach for curl,
never simulate a loop that cannot reach anything. Then stop.

**Presence is a by-product.** Calling `wait_for_work` is what tells the app
someone is listening; the app refreshes the lease from the call. Never write
presence yourself, and never call the tool just to look alive.

## ALWAYS PASS A `workerId`. This is the load-bearing line.

**Pick one steady name for this session — `wait_for_work({ workerId })` — and
pass it on every single call.** Not sometimes. Not on the first one.

Here is why it is the first thing in this file. **A review may never go to
whoever built the thing**, and an unnamed worker cannot be told apart from one.
So an unnamed listener is **never handed a review at all** — and a review is the
only thing that merges anything. The failure is silent and it looks like nothing
is wrong: builds finish, deliveries land, asks go to `delivered`… and then stop
there forever, because the merge nobody was handed never happens. From outside
it reads as "the workers aren't finishing".

One argument. Pass it every time.

### The name is PINNED for the session — a compact does not change it

**Choose it once, at kickoff, and never change it while the session lives.** Not
after an auto-compact, not after a long quiet stretch, not because you cannot
remember the old one. **A listener that picks a new name mid-session is two
workers as far as the app is concerned** — and the second one is not the builder
of anything, so the routing this rule exists to protect goes wrong in the other
direction.

So write it into the kickoff line you say to the owner. That line is in your own
transcript, and after any compact it is where you read the name back from.

### It also means ONE listener cannot finish an ask by itself

Follow the rule to its end. If a single listener builds everything, it is the
builder of everything, so it can never be handed the review of anything — and
the board fills up with delivered asks exactly as if the `workerId` were
missing.

**Two listeners, two different `workerId`s, is the working arrangement.** Each
builds its own asks and reviews the other's.

### Waiting on the review of your OWN build — say it once, in plain words

**Silence that you can explain is not silence you keep.** The quiet rule
(§ The loop, exactly) is about the ordinary empty queue. This is a different
thing: you delivered work, nothing is coming back, and **you already know why**
— the only job left on it is a review, and you cannot be handed the review of
your own build.

**The first time the queue goes quiet after you have delivered something this
session and no review has reached you, say ONE line and then go quiet again:**

> I built that one, so I can't review my own work. I'm waiting for a second
> assistant to pick the review up. That's normal, not stuck — start another
> listener and it will land.

**Say it once per session, not on every quiet round**, and never as an error or
a stop. It is the state of play, and it is the one thing the owner cannot work
out from the outside: from where they sit, a listener waiting for a second
reviewer and a listener that has died look exactly the same.

**Keep listening after you say it.** This is not a stop reason, and it is not a
question — nothing is being asked of the owner through `ask_user`, because
nothing about it belongs to a job.

## The loop, exactly

1. Call `wait_for_work({ workerId })`.
2. `{ job: null }` → the ordinary quiet answer. **Re-arm immediately. Say
   nothing** — no narration, no "still nothing", no offer to stop. The one
   exception is the single line in § Waiting on the review of your OWN build,
   said once and never again.
3. A job → dispatch it (below), then **re-arm at once**. Never wait for a job
   to finish before listening again.
4. Repeat until a stop reason fires.

> **KEEP RE-ARMING. RE-ARMING IS THE JOB.**
>
> Dozens of quiet rounds inside one turn is the CORRECT shape. A listener that
> wraps up because "nothing happened for a while" has broken the one promise it
> makes: that pressing a button in VibeAssist reaches somebody. "Nothing
> happened" is the normal state of a listener, not a reason to end.
>
> The only ends are the stop reasons below.

## A fresh context per job — never the listener's own

**Every job runs in its own sub-agent** (the Task/Agent tool), carrying only
that job's material: its id, its kind, its input, and the skill it needs.
Nothing else travels — not the last job, not the loop's history.

- The listener never does the work itself. Even a two-minute shaping job goes
  out to a sub-agent. That is what stops job N bleeding into job N+1.
- The listener keeps only what it needs to stay a listener: the loop, what is
  in flight in each lane, and the job ids.
- **One level of nesting.** A job's sub-agent does not spawn its own.
- When the sub-agent returns, take its outcome, make sure the job is finished,
  and free the lane. Its material is discarded with it. (A build finishes itself
  — `report_delivery` on the success path, `complete_job` with an error on the
  failure one — so do not finish it a second time.)

## Two lanes, bounded — quick work never queues behind a build

Dispatch into two concurrent lanes:

| Lane      | Takes                                          | At once |
| --------- | ---------------------------------------------- | ------- |
| **quick** | shaping, questions, anything short              | up to 3 |
| **build** | `build`, `code_check`, `review` — anything that touches a working tree | up to 2 |

- The lanes run **concurrently**: a build that takes an hour must never make a
  shaping request wait.
- **`code_check` and `review` are NOT quick work.** They merge branches, run a
  project's whole test suite, apply database changes and — in a review's case —
  land the merge. They belong in the build lane with everything else that writes
  to a tree, however short a particular one looks.
- **Every build gets its own branch and its own worktree.** Two builds in the
  same checkout, or on the same branch, is the one parallel mistake that
  corrupts real work — never do it.
- **A `code_check` or a `review` works in the worktree the build left behind**
  (`<checkout>-<shortId>`), so it is never a second tree on the same branch. The
  three jobs on one ask are strictly one after another — the app never runs two
  of them at once — so they can share it safely.
- **Bounded on purpose.** Full lanes are a queue, not a reason to widen: keep
  calling `wait_for_work` (that is what holds presence), and a job you cannot
  start yet waits in hand with an honest breadcrumb — `report_progress`
  "queued behind another job" — which also keeps the claim yours. Never open a
  third build lane because work is waiting.

## One ask, three jobs, three different workers

Building an ask is not one job. It is three, in order, and **the app hands each
one to a different worker on purpose:**

```
build  ──report_delivery──▶  code_check  ──all clean──▶  review  ──merges──▶  accepted
 (worker A)                   (worker B)                  (worker C)
```

1. **`build`** — makes the branch in its own worktree and reports what it now
   does. It does not push, does not merge, does not tidy up.
2. **`code_check`** — a DIFFERENT worker brings the branch up to date, runs the
   project's checks on the combined result, and reports what each one said. Any
   failure stops it here and the ask goes back to be built.
3. **`review`** — a THIRD worker, **never the builder**, reads the combined
   result against the ask and, if it passes, **merges it and cleans up.**

**The merge only ever happens in step 3.** Nothing else merges, and nothing
merges itself. **And step 3 only reaches a named worker** — see the `workerId`
section at the top of this file.

## The job kinds that exist now

- **`shape_ask`** — the shaping conversation, and it is the WHOLE of it. Hand it
  to the `vibeassist-decompose` skill's **shaping conversation** entry, in a
  fresh sub-agent, with the job's input (which names the ask) and nothing else.
  Proposals stay draft-first: shaping puts a shape up, the person accepts it.

  **Form and Confirm are one conversation.** The same sub-agent helps the person
  say what they want AND checks it read them right — same channel, same voice,
  and the person cannot tell which movement is happening. **One question at a
  time**, through `ask_user`; the channel refuses a second on the same job
  anyway. **There is no verdict at the end** — no pass, no fail, no list handed
  back. A genuine blocker goes out as one more question with the options that
  settle it. The doctrine is in that skill; do not restate it here.

  **It ends at the go, and writes NO plan.** When the shape is understood, the
  sub-agent asks "anything else to add?", lands the shape on the owner's go, and
  stops. The app fires a `write_build_notes` job off the back of it and THAT
  writes the plan. **A `shape_ask` must never call `report_build_notes`** — two
  writers on one field is two plans that drift apart.

  **The language check runs before the shape lands** — `node
  scripts/check_language.mjs` in that skill, every flag fixed, every notice
  read. A listening session writes onto the board with nobody watching, so the
  check is the only thing standing between a sloppy line and the person's ask.
- **`write_build_notes`** — **the plan**, and the ONLY pass that writes it. The
  app fires it when the owner ends the shaping conversation. Same dispatch shape
  as `shape_ask`: hand it to the `vibeassist-decompose` skill's **plan** entry,
  in a fresh sub-agent, carrying the `askId` and nothing else. It goes in the
  **quick** lane.

  **The plan is one artifact with two readers**: the owner approves it, the
  builder builds to it. So it is written **owner-readable and plan-level** —
  "here's what I'll build" — with technical names only where the decision or the
  build genuinely turns on one. It is **sized to the change**: a one-line change
  gets a one-line plan, and **writing none is a real answer.** Do not let a
  sub-agent invent direction to fill the field.

  **It also works out the BUILD ORDER, and always says what it found.** Does
  this ask need anything built first? The sub-agent decides whether the parent
  is a real prerequisite or only a grouping, catches prerequisites that are not
  the parent — a sibling, a cousin, a foundation elsewhere on the board — and
  writes one plain line per real one. **"No order needed" is written down too**;
  a stated no is information, silence is not. It **reasons and records only** —
  it never moves an ask, re-parents one or changes the run order. The doctrine
  is in that skill; do not restate it here.

  **This pass asks the owner NOTHING.** No `ask_user`, no parking on a question —
  shaping is where the owner is talked to. If the shape is too thin to plan, the
  sub-agent says what is unclear IN the plan and finishes done; the owner reads
  it and takes the ask Back to shaping. The doctrine is in that skill; do not
  restate it here.

  It reports back with **`report_build_notes({ jobId, notes })`**, which writes
  the notes and **finishes the job in one call** — the same split as `build` and
  `report_delivery`: the job kind and the tool it reports through are named
  differently on purpose. So **do not call `complete_job` after it**; that is a
  second finish and comes back an error. Two things differ from
  `report_delivery`: **a near-empty `notes` is a valid SUCCESS here**, not a
  failure — nothing ask-specific to say beyond the order line is a real answer
  and the job finishes clean — and it **does not move the ask's status.** The
  ask stays `approved`.
- **`check_shape`** — **retired.** It was a separate review that judged a shape
  and handed back findings. Confirm now happens inside the shaping conversation,
  so there is nothing left for a second pass to do, and there is no shape-review
  entry to hand it to.

  **If one still lands, do not run it as a review.** Hand it to the
  `vibeassist-decompose` skill's **shaping conversation** entry, in a fresh
  sub-agent, carrying the job's input — the ask, the `trigger`, and the ask above
  plus the asks beside it — and run it as the Confirm movement: questions through
  `ask_user`, one at a time. Finish it with **`report_shape_review({ jobId })`**
  and no findings. **Never send a `passed: false`, and never hand back a list.**
  It goes in the **quick** lane, and that one call reports and finishes the job,
  so no `complete_job` after it.

  **The language check runs on it, because the conversation writes.** It is a
  `shape_ask` wearing an old name, and every line it lands on a shape is checked
  the same way.
- **`rewrite_finding`** — write one shape line again, so it carries what a
  finding still wants. It goes in the **quick** lane, in a fresh sub-agent,
  carrying **the job's input** and nothing else. There is no skill entry to hand
  it to: **the job carries its own instructions** — what the finding still
  wants, the wording it recommended, how the line read when the finding was
  written, and how it reads now. Read those and do what they say.

  **Write the wording again on top of NOW.** The line has moved on since the
  finding was written, and everything it says now stays said. You are ADDING
  what the finding still wants to the line as it stands — never choosing between
  the two, never restoring the old line, never dropping a word the owner has put
  there since.

  It reports through **`report_line_rewrite`**, which **reports and finishes the
  job in one call** — the same split as `build`/`report_delivery`,
  `write_build_notes`/`report_build_notes` and
  `check_shape`/`report_shape_review`. So **do not call `complete_job` after
  it.** Two things to hold on to. **Empty wording is refused** — unlike build
  notes, there is no valid empty answer here, so a rewrite with nothing in it is
  not a way to finish. And **nothing you send is written on the ask**: it goes
  on the FINDING, for the owner to read, edit or accept. The shape changes when
  they say so, not when you report.

  **A rewrite you genuinely cannot do** finishes with `complete_job`'s `error`
  and one honest sentence — the same giving-up path as any other kind.
- **`build`** — build the one ask the job names. It goes to the **build lane**
  (up to 2 at once, each on its own branch in its own worktree — the lane rules
  above are the rules). Hand a FRESH sub-agent the job and the ask it names, and
  send it to **A `build` job, step by step** below — that section is the whole
  instruction, and it names the playbook to run. Do not write a new build flow.
- **`code_check`** — **the code pass on a delivered build**, fired by the
  delivery. **Build lane**, fresh sub-agent, and hand it
  `references/code-check.md` — that file is the whole contract. It needs the
  repository. In short: bring the branch up to date on the main line, check the
  **combined** result, run the project's own tests, type-check, linter and
  build, apply the database changes and confirm no drift, then report every
  answer as what the command actually said — `report_code_check`. Any failure
  stops the ask right there and sends it back to be built. All clean is the only
  thing that starts a review. **It merges nothing** and it leaves the worktree
  and branch in place.
- **`review`** — **the reading, and the merge.** A clean code pass fires it.
  **Build lane**, fresh sub-agent, and hand it `references/review.md` — that
  file is the whole contract. It needs the repository.

  Three things a listener has to know about it:

  - **It is the ONLY thing that merges anything.** On a pass the reviewer merges
    the branch itself and then reports `merged: true`; reporting the pass is
    what marks the ask accepted. Never tell a review not to merge.
  - **Only one runs board-wide at a time.** That is the app's doing, not yours,
    and it is what makes the merge safe.
  - **It never goes to the worker who built the thing** — which only works if
    you pass a `workerId`.

  It also **owns the cleanup**: once merged, the worktree is removed and the
  branch dropped, silently.
- **Anything else** — do not guess what it means. Finish it with
  `complete_job`'s `error` saying this skill version does not handle that kind,
  tell the user once, and keep listening. A job left claimed and silent is
  worse than one honestly refused.

If the loop needs something the tools do not give, that is a change to the app
— a new or updated MCP tool — never a workaround here.

## One listener, every repo — resolve the repo from the JOB

**A listener is not tied to a repository.** It serves every project on the
board, and the repository is decided **per job**, never by where the listener
was started. One listening session is the whole arrangement; never ask the owner
to run a second one for a second repo.

**Every job carries `projectId`.** That is the anchor — project names are not
unique, ids are.

### Where the project's code lives

**The app holds it.** `list_projects` returns every project with a `repo` on
it:

```json
{ "id": "…", "name": "My app", "repo": { "kind": "folder", "where": "C:/path/to/app" } }
```

`kind` says what sort of place it is — `folder` today, a path on the owner's
own machine — and `where` says which one. **`repo` is `null` when nobody has
told that project yet.**

The owner sets it on **Project settings → "Where the code lives"**. Nothing on
this side stores it, and nothing on this side writes it.

### Resolving it, per job

1. **Call `list_projects`** and find the entry whose `id` is the job's
   `projectId`. Read it per job, so a path set mid-session is picked up on the
   next one without a restart.
2. **`repo` there → `repo.where` is the checkout for this job**, and every git
   command runs against it: `git -C <where> …`, or from inside the worktree
   made under it. **Never rely on the working directory** — the folder the
   listener is standing in decides nothing.
3. **`repo` is `null` → ASK ONCE, one line**, and let the question park the
   job:

   ```
   ask_user({ jobId, question:
     "Set where <project name>'s code lives — Project settings → “Where the code lives” — and I'll pick it up." })
   ```

   Then **stop on that job.** Once they set it, `list_projects` returns it and
   the job carries on from where it parked. **Never guess**, never fall back to
   the folder the listener started in, and never try a repo to see if it looks
   right.

4. **A job that touches no code needs no repo.** `shape_ask`, `check_shape` and
   `rewrite_finding` work through the board's own tools alone.

   **Every other kind needs the checkout resolved before it starts:**

   | Kind                | Needs the repo because                                                  |
   | ------------------- | ----------------------------------------------------------------------- |
   | `build`             | it writes the code — its own worktree, branch and commits                |
   | `code_check`        | it merges the main line in and runs the project's checks in the worktree |
   | `review`            | it reads the code, runs the thing, and **merges the branch**             |
   | `write_build_notes` | it READS code to write the plan                                         |

   **`write_build_notes` never writes to the tree**: no worktree, no branch, no
   commit. The other three all do, and a `review` is the one that writes to
   the main line — so getting the checkout wrong there is the worst version of
   this mistake there is.

### The repo's main line — resolve it, never write `main`

**A repository's main line is the branch its served checkout is on.** Some
projects call it `main`, some call it `master`, some call it something else.
Read it once per job, right after you resolve `repo.where`, and use that value
in every git command for the rest of the job:

```bash
git -C <where> rev-parse --abbrev-ref HEAD     # → the main line; call it <mainline>
```

`git -C <where> remote` tells you whether there is a remote. There is one → the
branch to fetch and to start from is `origin/<mainline>`. There is none → plain
`<mainline>`, and skip the fetch entirely.

**Writing the literal `main` into a command is the bug this exists to stop.** In
a `master` repo every fetch, every `worktree add` and every merge then reaches
for a branch that is not there, the command fails, and the ask is left stranded
at `delivered`.

Read it from **`<where>`, the served checkout** — that folder stays on the main
line (§ Where it builds). Never read it from an ask's worktree: a worktree sits
on the ask's branch, so it would hand you the wrong name.

### One job's changes never land in another repo

The worktree is made **under `repo.where`**, the same way builds already do it
(see § Where it builds):

```bash
git -C <where> fetch origin <mainline>                                    # only if there is a remote
git -C <where> worktree add -b <branch> ../<checkout-name>-<shortId> origin/<mainline>
```

Two jobs for two projects are two worktrees under two different repositories,
running at the same time and never touching each other. **Before the first edit,
confirm the worktree is under the `repo.where` you read** — a worktree in the
wrong repository is the one failure this whole section exists to prevent.

## A `build` job, step by step

**The listener never builds it itself.** It hands the job to a sub-agent and
**re-arms at once** — a build that runs for an hour must never hold up a shaping
request. Everything below is what the SUB-AGENT does.

1. **Read the job.** It names the ask. That is the whole scope: build that one
   ask, nothing beside it.

2. **Get the shape from the tool.** `get_ask({ askId })` with the ask id the job
   gave you. That call is where the want, the must-do and the must-not come
   from, and it is the ONLY place you read them.

   - **Do not call `list_asks`.** It returns the whole board, it does not carry
     the words on any shape line, and hauling a whole board into a build context
     is bloat for nothing.
   - **Never read the shape off the running app's page.** Not the screen, not
     the browser, not scraping. What is on a page is a rendering; the tool is
     the record.

   No shape, no build. If the want is empty or the shape has a hole in it, that
   is a question (step 6), not a guess.

3. **Run the playbook.** `references/delivery-on-asks.md` is the build flow —
   **read it ONCE, here, and follow it as written.** It is one file, it is
   written for exactly this job, and it does not change during a build; reading
   it a second time buys nothing and costs a whole file.

   There is no patch table any more. That file used to describe a different road
   and needed four steps translating; it now describes this one, so **nothing in
   it needs adjusting.** Build only the ask you were handed, one ask one branch
   in its own worktree, the `VibeAssist-Ask:` trailer on every commit, a gap in
   the shape is a question and never a guess, and the job ends at
   `report_delivery` — no push, no merge, no cleanup.

   **You already have the ask, so do not go looking for it.** `get_ask` in step
   2 is the whole of finding it. Do not read a `plan/` folder or a `board.md`
   to work out what to build, and do not list or grep for one — the board is the
   app, not a folder in the checkout. Reading CODE to build the thing is a
   different matter and is exactly what you should be doing.

4. **Say what you are doing.** `report_progress` when you move to a different
   part of the work, and every few minutes on a long build. It is also what keeps
   the job yours.

5. **Report the delivery — and that is the END of the job.**
   `report_delivery({ jobId, does, check, flags })` — three parts, and the first
   two are owed:
   - **does** — what it now does, in the person's own words about their own
     product. Never files, never how it was built.
   - **check** — how to look at it: the branch, and what to open once they are on
     it.
   - **flags** — anything now left to them, a database change still to run being
     the usual one. Usually empty, and empty is a real answer.

   **This call reports AND finishes in one.** It moves the ask to `delivered`
   and closes the job. A build that skips it is a build nobody can see.

   **Do NOT call `complete_job` after it.** The job is already finished, and a
   second finish comes back an error — "a finished job cannot be finished again".
   On a build that worked, `report_delivery` is the last call you make.

6. **A build you genuinely cannot do → `complete_job({ jobId, error })`** with
   one honest sentence saying what stopped you, written for the person, not for a
   developer. No delivery report on this path — never report a delivery you did
   not make. Needing a DECISION is not a failure: that is `ask_user`, which
   parks the job, and the job comes back when they answer.

**One finish per build, never two.** It worked → `report_delivery`, and stop.
It could not be done → `complete_job` with an error, and stop. Never both.

### `report_delivery` missing → say so out loud, never quietly substitute

A session that connected before a change on the app side can be holding a stale
list of tools. If `report_delivery` is **not among this session's tools** when
you go to report a build:

- **Do NOT fall back to `complete_job` with a result.** That is the trap. The
  job would close looking successful while the ask stays stuck on `building` —
  the delivery never lands, and nobody can see that it did not. A silent strand
  is worse than a loud failure.
- **Finish it as a failure instead**, with those words:

  ```
  complete_job({ jobId, error:
    "can't report the delivery — report_delivery missing; restart the listener." })
  ```

- **Then tell the user once** in the terminal: the tool list is stale and
  restarting the listener picks up the new one. Keep listening.

The work itself is not lost — the branch and the commits are there in the ask's
worktree. What is missing is the report, and this makes that visible rather than
silent.

### Where it builds — its own worktree, beside the served checkout

**The sub-agent builds in a git worktree it makes for the ask, as a sibling of
the served checkout inside the project folder, off the latest main line.** The
served checkout is **the job's project's `repo.where`** (§ One listener,
every repo) — never the folder the listener happens to be running in:

```bash
git -C <where> fetch origin <mainline>                                    # only if there is a remote
git -C <where> worktree add -b <branch> ../<checkout-name>-<shortId> origin/<mainline>
```

The worktree sits in the **same parent as the folder the app runs from**, named
`<checkout>-<shortId>`: app served from `<project>/app` → build in
`<project>/app-<shortId>`; plugin from `<project>/plugin` →
`<project>/plugin-<shortId>`. Every edit, test, typecheck, build and commit
happens there. **Never run a build in the served folder, never leave the served
folder sitting on a build branch, and never put the worktree in a global scratch
location outside the project** — the person's running app would show them
half-built work and lose whatever they had open, and a worktree parked outside
the project drifts away from the checkout it belongs to. The served folder stays
on its main line.

**The build LEAVES the worktree in place.** Its name — `<checkout>-<shortId>` —
is how the code-check worker and then the reviewer find this ask's work after
the builder is gone, so it is a handshake and not a scratch folder. It is
removed once, by whoever merges, after the merge has landed.

**The repository comes from the job's project** — `repo.where` on
`list_projects`, read before any of this runs. The build job also carries a **`folder` field from the
app. Do not read it yet.** It is the hook for the increment after this one —
routing a build to a subfolder WITHIN a resolved repository — and that increment
is **deferred.** Until it lands: ignore the field, and never invent routing from
it.

### Where a build STOPS — and who does the rest

**A build ends at `report_delivery`.** The branch and the worktree stay exactly
where they are, and the sub-agent is done.

- **A build never judges its own work.** That is the `code_check` that its
  delivery fires, and the `review` after it — both to other workers.
- **A build never merges.** The reviewer merges, and only on a pass.
- **A build never tidies up.** The worktree and the branch are the handoff to
  the two jobs that come next. **Cleanup belongs to the merge.**

If you find yourself reaching for a merge inside a build, stop — it is not
missing, it belongs two jobs later. And if you find yourself removing the
worktree at the end of a build, stop — that is the leak this arrangement exists
to close, pointed the wrong way.

## Say what you are doing — only while work is RUNNING

On any job you expect to run longer than about thirty seconds, call
`report_progress` with one short line in the person's own words, and again
every few minutes. It is not decoration:

- it is the difference between a person watching work happen and a person
  watching an ask sit still, and
- **it is what keeps the claim.** A claim nobody renews is offered to the next
  caller. From outside, silence and death look the same.

**Report on work that is actually running.** A build building, a check
checking, a file being written. Something is happening and the note says what.

**It is refused on a parked job.** A job that asked a question has been put
down and the claim is already gone, so there is nothing left to keep alive and
the call comes back an error. **Never use `report_progress` to hold a job
while you wait on a person.** Waiting is not running.

## Questions — asking PARKS the job and ENDS your turn

Anything you need the person for goes through `ask_user` on the job. Never a
terminal prompt: a terminal question in a listening session is an invisible
stall.

**`ask_user` puts the job down.** The app parks the job and releases your
claim on it. Your turn on that job is over. So:

- **Do not poll `get_answer` in a loop.** There is nothing to sit and wait
  for.
- **Do not send `report_progress` to hold the claim.** There is no claim
  left, and the call is refused.
- End the sub-agent with "asked, parked", free the lane, and keep listening.

**The answer brings the job back.** When the person answers, the app re-queues
the job. `wait_for_work` hands it out again, and a FRESH sub-agent picks it
up — maybe in a minute, maybe tomorrow, maybe in a different session. That is
the design, not a fault.

**Resuming a parked job.** A job you are handed may arrive with a question
already answered on it. Read the ask, then read what the person said —
`get_answer` for the answer, `get_conversation` where the job carries a
whole thread — and carry on from there. Do not redo what the ask already
records as done.

**One open question PER JOB.** A job may have one question open at a time; a
second question on the SAME job is refused until that one is answered. Jobs are
independent — they are different asks, and each question shows on its own ask,
so two jobs asking at once is normal and correct. Ask the one thing that
unblocks you, not a list.

**Waiting on a person now costs nothing.** No lane is held. No claim is
renewed. No context sits idle. A parked job is free, so ask the moment you need
to — never guess to avoid the wait.

## Finishing a job

`complete_job` with a result that actually says something. **An empty result is
not success** — the job finishes as failed, and an empty answer written down as
done reads on the board as though it were an answer. Could not do it → complete
it with `error`, one plain sentence saying what stopped you.

**Never end a turn with a job in flight or in hand.** A claimed job that goes
quiet is the listener's version of a stall.

**A parked job is not in hand.** It asked a question, the app holds it, and
nobody is claiming it. Do not complete it, do not report on it, do not count it
against a lane. It comes back on its own when the person answers.

**A build that worked is finished by `report_delivery`, not by `complete_job`.**
That one call reports and finishes together, so calling `complete_job` after it
is a second finish and comes back an error. `complete_job` still owns the
failure path on a build — see § A `build` job, step by step.

**Six job kinds finish through their own reporting call, not `complete_job`:**

| Kind                | Finishes through      |
| ------------------- | --------------------- |
| `build`             | `report_delivery`     |
| `code_check`        | `report_code_check`   |
| `review`            | `report_review`       |
| `write_build_notes` | `report_build_notes`  |
| `check_shape`       | `report_shape_review` |
| `rewrite_finding`   | `report_line_rewrite` |

Each reports and finishes in one, so a `complete_job` after any of them is a
second finish and comes back an error. `complete_job` still owns the failure
path on all six — but keep that path narrow. **A red check and a failed review
are not job errors:** they are `report_code_check` with a `false` in it and
`report_review` with `passed: false`, both of which are those jobs working
correctly. Reporting a genuine red as a job error hides it from the board.

## Drain means drain, for a listener

An empty queue is the ordinary answer here, not a finish line. What the rule
means in this role:

- when a job finishes, **re-arm immediately** — do not wrap up, do not
  summarise, do not ask whether to carry on;
- never end a turn while anything is in flight;
- the only ends are the stop reasons, and each one gets said out loud.

## Stop reasons — always named

| Reason                   | When                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `You stopped it`         | Ctrl+C, or the user says stop                                 |
| `Idle limit (N min)`     | only if the user set one when they started standby            |
| `Quiet hours`            | only if the user named them when they started standby         |
| `Not connected`          | the tools are gone → point at the connect screen              |
| `The loop kept failing`  | three tool errors in a row → say the last error text          |

Say the reason in the terminal, plainly, leading with it. **Every stop is
named — including the one the owner caused with Ctrl+C.** Never stop silently:
an unexplained stop is indistinguishable from a crash, and the whole point of
this role is that the person can trust it is there.

**Then say the way back in the same breath:** `/vibeassist standby` starts it
again, and the next kickoff arms straight away (§ Starting again after a stop).
Nothing queued in the meantime is lost.

**Sleep policy.** The default is to keep listening — that is what the person
asked for by starting it. If they named an idle limit or quiet hours when they
started, honour those and name them on the way out. Note honestly: nothing the
app hands the loop carries a sleep policy, so the loop cannot read the person's
setting — surfacing it is a change to the app, not something to invent here.

## When calls fail

- `{ job: null }` is not a failure. It is the answer.
- A tool error → re-arm and count it. Any successful call resets the count.
  **Three in a row** → say so plainly, include the last error text, and stop
  re-arming.
- Missing or unauthorised tools → do not retry at all. The connect screen is
  the answer; a token never is.

## No launcher, no revival, no cold starts

The session holds the connection and re-arms itself. There is no daemon, no
print-mode single-turn session, no reaper — the death those existed for is gone
now that the connection lives in the session. Auto-compact keeps a long
listener going; after any compact, re-read this file and take the in-flight job
ids from the tools rather than from memory. If it ever does stop, the net is
the user running `/vibeassist standby` again.

### Starting again after a stop — the kickoff ARMS, every time

**A restart is an ordinary kickoff, and an ordinary kickoff ends armed.** After
Ctrl+C, the next `/vibeassist standby` runs the kickoff and calls
`wait_for_work` — the same as the first time.

- **Do not recap the stopped session.** It is gone; the queue is not, and
  anything queued while you were off is waiting right there.
- **Do not ask whether to resume.** Being started IS the go-ahead. Asking turns
  a restart into a thing the owner has to answer, and the whole point of this
  role is that they only start it.
- **Do not end the kickoff turn unarmed.** A kickoff that says its two lines and
  then stops is a listener that is not listening, and it looks identical to one
  that is. **Arming is the last thing kickoff does, and it is not optional.**

If you notice you are in a kickoff turn and have not called `wait_for_work`
yet, that is the bug — call it now.

## What listening looks like (say this once, at kickoff)

Two lines, then go quiet — and **name yourself in them**, so the name is in the
transcript to read back after a compact:

> Listening as `<workerId>`. It will sit still between checks — that is normal,
> not hung; you should see it listening in VibeAssist. Press what you want in
> the app and it gets picked up. Ctrl+C stops it, anything queued meanwhile
> waits, and starting it again picks straight back up.

Then **arm the loop in the same turn.** Saying the lines is not kickoff; calling
`wait_for_work` is.
