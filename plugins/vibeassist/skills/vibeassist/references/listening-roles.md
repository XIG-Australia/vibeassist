# Listening roles — worker & standby (the smart kickoff)

**Load this when:** the skill was invoked as `/vibeassist worker` or
`/vibeassist standby` (or the run config resolves to one of those roles) —
read it BEFORE arming the listening loop.

The terminal session is a LISTENER the user starts ONCE per working session;
everything after is pushed from VA (Start sprint, questions, jobs). Never make
the user type further instructions into the terminal — if you need
information, use the `/ask` question channel, not the chat.

## Bootstrap — the loop script is ROLE-VARIANT

The listening loop lives at `~/.claude/va-standby.sh` (same filename and
invocation for BOTH roles — the user's allow rule matches the exact string
`bash ~/.claude/va-standby.sh`, so never rename it or add arguments). The
packaged source is this skill's `scripts/va-standby.sh` (the STANDBY variant).
The CONTENT differs by role in exactly one place:

- **worker** variant polls with `&sprints=1`, so the server also wakes it when
  a queued sprint is waiting for a worker (`wakeEligibleSprints` — the fix for
  "Start pressed, worker listening, nothing happened").
- **standby** variant must NOT send it — a responder can't consume a sprint,
  and waking on one degrades the long-poll into a busy loop (the 2026-07-08
  live bug; see `references/incidents.md`).

At kickoff, write `~/.claude/va-standby.sh` if it's missing or doesn't match
YOUR role's variant: copy the packaged `scripts/va-standby.sh` for standby;
for worker, apply the one-line change (curl URL ends
`updates?wait=25&sprints=1`).

## Run it and act on the output

Run it (backgrounded) with exactly `bash ~/.claude/va-standby.sh` — the allow
rule matches that exact string. On output:

- `{"round_complete":true}` (inside the JSON) → idle heartbeat; re-arm
  immediately, say nothing.

> **KEEP GOING. ENDING YOUR TURN IS THE EXPENSIVE THING.**
>
> A headless session runs in print mode: **one turn, then the process exits.**
> Nothing resumes it — the daemon notices it went and starts a whole new
> session, which pays the boot and the MCP connect again before it can hear
> anything.
>
> Measured on the owner's machine, 5 August: standby sessions ended after 220s,
> 174s and 691s, each followed by ~15s of nothing and then 17–122s of connecting.
> So every few minutes there was a window of half a minute to two and a half
> minutes where **nobody was listening**, and a brand-new session booted and
> re-read all of this — a few hundred cold starts a day whether or not anything
> needed answering.
>
> So an idle round is NOT a reason to wrap up. Re-arm and keep re-arming: dozens
> of quiet rounds in one turn is the CORRECT shape, and it costs almost nothing
> because the server holds each poll open and idle waiting burns no tokens. Do
> not summarise, do not narrate the quiet rounds, do not offer to stop.
>
> The ONLY reasons to end a turn are the ones already written down: the sleep
> policy fires (idle grace or quiet hours), the recovery bound is spent, or the
> user says stop. "Nothing happened for a while" is not one of them — it is the
> normal state of a listener and the whole thing you are here to do.
- `STANDBY ERROR …` → a CONFIG problem (missing env) — stop and tell the user
  exactly what it printed.
- `STANDBY TRANSIENT …` or the command was KILLED externally (stopped with no
  output at all) → do NOT stop permanently on the first incident: transient
  network blips and externally-killed rounds are recoverable, and a listener
  that gives up on them is a worker that silently never wakes again. Re-arm
  and count the incident. **Bounded:** after 3 CONSECUTIVE incidents (any
  output or a clean round resets the count), post ONE honest `ask`
  `kind:"notice"` saying the listening loop keeps failing (include the last
  error text), then stop re-arming. Exception: if the failure text shows an
  auth problem (401/unauthorized/revoked), don't retry — run
  `bash ~/.claude/va-check.sh` and follow its verdict instead.
- Updates JSON (`"actionable":true`) → act by role, then re-arm (below).

## Worker role

`wakeEligibleAsks > 0` → **approved work is waiting, and this is the road
delivery runs on.** Call `next_approved_ask` and run the loop in
`references/delivery-on-asks.md`, then poll again and keep going while any
remains. `ask: null` despite the wake means another worker took it — re-arm
quietly, don't spin.

(This wake did not exist until 4 Aug 2026. Nothing anywhere woke a worker for
an approved ask, so approving one and leaving a worker listening did nothing at
all — and there was no way to tell that from a broken machine.)

`wakeEligibleSprints > 0` (or `queuedSprints > 0` with nothing else
actionable) → a sprint is waiting on the OLD road: PULL IT via `next-sprint`
and run the sprint loop from the core skill, then IMMEDIATELY re-poll and keep
pulling while any remains. If `next-sprint` returns `sprint:null` despite the
wake, another session claimed it first — re-arm quietly. Other fields →
surface once to the user, keep listening.

**Flow:** run **drain** first (work everything already queued), then enter the
listening loop. A started sprint is the consent envelope — never ask
"continue?" between tasks or sprints; the stop conditions are the ones in the
core Guardrails only.

**DRAIN MEANS DRAIN — a worker never exits with work still waiting
(regression guard, task f6c3618b).** On the ask road the queue-empty signal is
`next_approved_ask` returning `ask: null`; on the sprint road it is
`sprint:null`. Nothing else counts as empty. After a sprint's last `/complete` and its
PR is opened, do NOT end the turn: immediately re-poll (`get_updates` →
`next-sprint`) and pull the NEXT queued sprint, and keep going while ANY
dispatchable sprint remains — `sprint:null` is the ONLY "queue empty" signal.
The worker ROLE overrides `config.mode` here: a project whose `config.mode` is
`sprint` or `review` is still fully DRAINED by a worker; those modes'
boundary-pauses govern interactive `/vibeassist sprint|review` invocations,
never the listening worker role. A clean early exit while `queuedSprints > 0`
is a DEFECT, not a boundary stop (seen live 2026-07-18 — see
`references/incidents.md`). A worker may stop ONLY when the queue is genuinely
empty OR the sleep policy fires (idle grace / quiet hours); and its exit
`kind:"notice"` MUST STATE THE REASON — "queue empty", "idle limit (N min)",
or "quiet hours" — so an early exit is diagnosable from the board rather than
looking like a silent stall.

## Standby role

If the VibeAssist MCP server is connected, drain jobs (`next_ai_job` → do the
work → `complete_ai_job`) and resume answered questions (`get_answer`) — the
tool descriptions carry each tool's playbook (attachments handling, result
shapes). Over plain HTTP (no MCP), surface what's waiting ("2 AI jobs queued —
connect the MCP server to fulfil them") and keep listening.

- **Self-heal a wrong-variant script:** if a STANDBY loop wakes with
  `actionable:true` but `queuedAiJobs` is 0 and `answeredQuestions` is empty
  (only sprint counts are set), you are running the WORKER variant — rewrite
  `~/.claude/va-standby.sh` to the standby variant and re-arm.
- **Post progress breadcrumbs on longer jobs.** On any claimed job you expect
  to take more than ~30s, call `update_ai_job_progress` with a short human
  phrase as you go (see its tool description) — it's the single biggest trust
  signal that the assistant is working, not hung.
- **Job playbook — `interpret_review_sendback` (the review send-back
  assessment).** The user sent an ask's DELIVERABLE back with comments (or
  accepted it with tweak/wrong points). Your job is an **ASSESSMENT, not a
  blanket rejection**: re-assess the deliverable against the user's comments and
  act ONLY on the tasks the comments actually implicate — the number needing
  rework may be **0** (the comments were a misunderstanding, or the work already
  satisfies them) or just one. Protocol:
  1. The job's `input` carries `{ featureId, reviewId }`. Read the ask with
     `list_asks(projectId)` — its row, its Shape, and what is inside it — and
     the user's comments from the job input.
  2. ASSESS what the comments actually implicate. Read the delivered code where
     the comments demand it. The honest answer is often "nothing" — the comment
     was a misunderstanding, or the work already satisfies it.
  3. **Re-mint** work the comments describe that nothing on the board covers:
     `create_ask` under THIS ask (`parentAskId`), carrying the user's words
     **VERBATIM** in `want`. It arrives proposed; the user accepts it.
  4. **Fix the Shape when the Shape is what was wrong.** If the comments show
     the ask asked for the wrong thing, `update_ask` it — rebuilding to a broken
     Shape fails twice.
  5. **Leave alone** everything the comments don't implicate.
  6. **Say what you concluded — ALWAYS, including when nothing changed.**
     `complete_ai_job(jobId, result: { changed: N, summary: "<plain sentence>" })`,
     and when N is 0 the summary must say WHY. The user has to read "I checked,
     and nothing needed changing because X" — never the ask going quiet.
  - **Guardrails**: stay on THIS ask and its children — never touch another
    ask's work; never delete anything; quote the user's comments rather than
    paraphrasing them; a count of 0 is a valid, reportable outcome.
  - **Known gap (2026-08-04):** the tool that wrote a permanent reconciliation
    record onto the review — `record_review_reconciliation` — was retired with
    the old board and has no ask-native replacement yet. Until it does, the
    summary in your result is the only record, so write it as though it is the
    only thing anyone will read. It is.

## Sleep policy — an idle run ENDS deliberately, it never idles forever

Both roles read the same `sleepPolicy`
(`{ idleMinutes, quietHours, keepListening }`) from every `/updates` response,
the user's setting:

- **Grace window** — after `idleMinutes` with nothing actionable (0 = sleep
  immediately on empty queue), SLEEP instead of re-arming; new work arriving
  resets the window.
- **Quiet hours** — inside the user's `quietHours` window (local time, e.g.
  00:00–07:00), skip the grace window and sleep at the first idle moment —
  nobody queues work at 4am. Applies to responders too.
- **`keepListening: true`** — the user opted into the always-on listener and
  accepts the cost; stay.
- **To sleep:** post the final run summary as an `/ask` with `"kind":"notice"`
  on the last task you completed, LEADING with the exit reason ("Queue empty",
  "Idle limit (N min)", or "Quiet hours") — followed by sprints completed, PRs
  opened, manual/operator steps, and any parked tasks still awaiting answers
  ("Queue empty — run complete: N sprints, M PRs, K awaiting your answers") —
  so the user's morning starts with the summary AND the reason the run ended,
  not a silent terminal. Then do the boundary compact (context-hygiene
  policy), say the session is going offline, and END — do not re-arm. Any wake
  path (the user, a launcher, a schedule) restarts the run with the SAME
  kickoff command; design nothing that needs the old session to still exist.

Why sleep beats idling (the default): an idle listener wakes ~8×/hour and
every wake is a full-context cache miss (≈70–500× the cost of sleeping); an
unattended auto-approve session is a standing capability; and a fresh session
per run is free hygiene.

## What listening looks like (tell the user once at kickoff)

The session sits quietly between checks — that's normal, not hung. Stop it any
time with Ctrl+C (or closing the session); work queued meanwhile is picked up
by the next kickoff.
