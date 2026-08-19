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
- When the sub-agent returns, take its outcome, complete the job, and free the
  lane. Its material is discarded with it.

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
  puts a shape up, the person accepts it.
- **`build`** — **later.** It is not a kind yet. The build lane exists now so
  that landing it is a dispatch line, not a re-plumb.
- **Anything else** — do not guess what it means. Finish it with
  `complete_job`'s `error` saying this skill version does not handle that kind,
  tell the user once, and keep listening. A job left claimed and silent is
  worse than one honestly refused.

If the loop needs something the tools do not give, that is a change to the app
— a new or updated MCP tool — never a workaround here.

## Say what you are doing

On any job you expect to run longer than about thirty seconds, call
`report_progress` with one short line in the person's own words, and again
every few minutes. It is not decoration:

- it is the difference between a person watching work happen and a person
  watching an ask sit still, and
- **it is what keeps the claim.** A claim nobody renews is offered to the next
  caller. From outside, silence and death look the same.

## Questions — one at a time PER JOB, not per session

Anything you need the person for goes through `ask_user` on the job, then
`get_answer`. Never a terminal prompt: a terminal question in a listening
session is an invisible stall.

**The one-open-question rule is scoped to the job.** Each job may have one
question open at a time; a second question on the SAME job is refused until
that one is answered. Jobs in different lanes are independent — they are
different asks, and each question shows on its own ask, so two jobs asking at
once is normal and correct.

So a lane never waits on another lane's question. Ask when your job needs it,
poll `get_answer`, and keep `report_progress` going while you wait so the claim
stays yours. `{ answered: false }` means the person has not got to it, not that
anything failed.

## Finishing a job

`complete_job` with a result that actually says something. **An empty result is
not success** — the job finishes as failed, and an empty answer written down as
done reads on the board as though it were an answer. Could not do it → complete
it with `error`, one plain sentence saying what stopped you.

**Never end a turn with a job in flight or in hand.** A claimed job that goes
quiet is the listener's version of a stall.

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
