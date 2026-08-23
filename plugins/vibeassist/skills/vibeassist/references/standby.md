# Standby — the listening loop

**Load this when:** the skill was invoked as `/vibeassist standby` — read it
BEFORE arming the loop.

Standby is a connected session that listens. One command puts it into
listening; from then it calls `wait_for_work`, does what comes, and calls
again, until the user stops it. The user starts it once and never types into
the terminal again — anything you need from them goes through `ask_user` on
the job, never a terminal prompt.

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

## The loop, exactly

1. Call `wait_for_work`.
2. `{ job: null }` → the ordinary quiet answer. **Re-arm immediately. Say
   nothing** — no narration, no "still nothing", no offer to stop.
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

| Lane      | Takes                             | At once |
| --------- | --------------------------------- | ------- |
| **quick** | shaping, questions, anything short | up to 3 |
| **build** | anything that writes code          | up to 2 |

- The lanes run **concurrently**: a build that takes an hour must never make a
  shaping request wait.
- **Every build gets its own branch and its own worktree.** Two builds in the
  same checkout, or on the same branch, is the one parallel mistake that
  corrupts real work — never do it.
- **Bounded on purpose.** Full lanes are a queue, not a reason to widen: keep
  calling `wait_for_work` (that is what holds presence), and a job you cannot
  start yet waits in hand with an honest breadcrumb — `report_progress`
  "queued behind another job" — which also keeps the claim yours. Never open a
  third build lane because work is waiting.

## The job kinds that exist now

- **`shape_ask`** — the shaping flow. Hand it to the `vibeassist-decompose`
  skill's single-ask shaping entry, in a fresh sub-agent, with the job's input
  (which names the ask) and nothing else. Proposals stay draft-first: shaping
  puts a shape up, the person accepts it. **The language check runs before the
  shape lands** — `node scripts/check_language.mjs` in that skill, every flag
  fixed, every notice read. A listening session writes onto the board with
  nobody watching, so the check is the only thing standing between a sloppy
  line and the person's ask.
- **`write_build_notes`** — write the build notes for the ask the job names.
  Same dispatch shape as `shape_ask`: hand it to the `vibeassist-decompose`
  skill's **build-notes** entry, in a fresh sub-agent, carrying the `askId` and
  nothing else. It goes in the **quick** lane. The notes are LIGHT — only the
  ask-specific technical direction a worker could not get from the standing
  Rules or from reading the code — and **writing none is a real answer.** Do not
  let a sub-agent invent direction to fill the field. The doctrine is in that
  skill; do not restate it here.

  It reports back with **`report_build_notes({ askId, notes })`**, which writes
  the notes and **finishes the job in one call** — the same split as `build` and
  `report_delivery`: the job kind and the tool it reports through are named
  differently on purpose. So **do not call `complete_job` after it**; that is a
  second finish and comes back an error. Two things differ from
  `report_delivery`: **empty `notes` is a valid SUCCESS here**, not a failure —
  nothing ask-specific to say, call it empty and the job finishes clean — and it
  **does not move the ask's status.** The ask stays `approved`.
- **`check_shape`** — the shaping review: the read that decides whether a shape
  can go ahead. **Nothing is approved, queued or built until it reports.** Same
  dispatch shape as `shape_ask`: hand it to the `vibeassist-decompose` skill's
  **shape-review** entry, in a fresh sub-agent, carrying **the job's input** —
  which names the ask, carries the `trigger` (`approve` or `change`), and
  carries the **ask above plus the asks beside it** — and nothing else. That
  parent-and-siblings material only arrives on the job; `get_ask` cannot give
  it, so passing anything less makes the review blind to the one thing it is
  there to catch. It goes in the **quick** lane.

  It reports through **`report_shape_review({ jobId, passed, findings, atParent,
  relabel })`** — `jobId` and `passed` are owed, the rest ride when they apply —
  and that call **reports and finishes the job in one**, the same split as
  `build`/`report_delivery` and `write_build_notes`/`report_build_notes`. So
  **do not call `complete_job` after it.** Three things to hold on to. **A fail
  is a real, clean outcome**, not an error — the ask stays at `shaping` with the
  findings on it, waiting on the owner. **Every finding owes a question AND a
  recommended change**, because the app drops any that carries only one. And
  **the bar is good enough to build** — only a blocker holds the ask back, and
  a finding marked `blocking: false` rides along with a pass. The doctrine is in
  that skill; do not restate it here.

  **The language check does not run on this job.** A review writes nothing onto
  a shape, and `check_language.mjs` guards lines that land on one. It still runs
  on every `shape_ask`, exactly as before.
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
- **Anything else** — do not guess what it means. Finish it with
  `complete_job`'s `error` saying this skill version does not handle that kind,
  tell the user once, and keep listening. A job left claimed and silent is
  worse than one honestly refused.

If the loop needs something the tools do not give, that is a change to the app
— a new or updated MCP tool — never a workaround here.

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

3. **Run the playbook that exists.** `references/delivery-on-asks.md` is the
   build flow — **read it ONCE, here, and follow it.** It is one file and it does
   not change during a build; reading it a second time buys nothing and costs a
   whole file. Four of its steps arrive differently on this road:

   | In the playbook              | On a `build` job                                 |
   | ---------------------------- | ------------------------------------------------ |
   | Step 1 `next_approved_ask`   | **Skip it.** The job already handed you the ask. |
   | Step 2 "read what you were handed" | `get_ask({ askId })` — that call, nothing else |
   | Step 3 `report_ask_progress` | `report_progress({ jobId, note })`               |
   | Step 6 `report_ask_delivery` | `report_delivery(...)` — it also FINISHES the job |

   Everything else in that file binds exactly as written: build only the ask you
   were handed, one ask one branch, the `VibeAssist-Ask:` trailer on every
   commit, verify green before anything is pushed, and a gap in the Shape is a
   question, never a guess.

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

The work itself is not lost — the branch is pushed and the commits are there.
What is missing is the report, and this makes that visible rather than silent.

### Where it builds — its own worktree, beside the served checkout

**The sub-agent builds in a git worktree it makes for the ask, as a sibling of
the served checkout inside the project folder, off the latest main line.** The
listener's own folder is where it finds the repository, not where it builds:

```bash
git fetch origin main
git worktree add -b <branch> ../<checkout>-<shortId> origin/main
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
on `main`. Remove the worktree once merged (`git worktree remove <path>`).

Still no routing and no lookup: the repository is the one the listener is
running against. The build job carries a **`folder` field from the app. Do not
read it yet.** It is the hook for the next increment — routing a build to a root
repository plus a subfolder — and that increment is **deferred, not part of this
one.** When it lands, this step is where it goes. Until then: ignore the field,
and never invent routing from it.

### Out of scope in this slice — do NOT wire these in

- **The Truth Pass.** A build does not judge its own work. That verdict is the
  person's, in the morning review.
- **The merge.** Nothing here merges anything, anywhere.

**In this slice a build lands its branch and reports delivered. That is the whole
end of it.** If you find yourself reaching for a merge, stop — it is not missing,
it is deliberately not here.

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

**Four job kinds finish through their own reporting call, not `complete_job`:**
`build` → `report_delivery`, `write_build_notes` → `report_build_notes`,
`check_shape` → `report_shape_review`, `rewrite_finding` →
`report_line_rewrite`. Each reports and finishes in one, so a `complete_job`
after any of them is a second finish and comes back an error. `complete_job`
still owns the failure path on all four.

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

Say the reason in the terminal, plainly, leading with it. Never stop silently:
an unexplained stop is indistinguishable from a crash, and the whole point of
this role is that the person can trust it is there.

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

## What listening looks like (say this once, at kickoff)

Two lines, then go quiet:

> Listening. It will sit still between checks — that is normal, not hung; you
> should see it listening in VibeAssist. Press what you want in the app and it
> gets picked up. Ctrl+C stops it, and anything queued meanwhile waits for the
> next time you start it.
