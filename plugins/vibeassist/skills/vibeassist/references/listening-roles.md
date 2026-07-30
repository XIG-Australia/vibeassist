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

`wakeEligibleSprints > 0` (or `queuedSprints > 0` with nothing else
actionable) → a sprint is waiting: PULL IT via `next-sprint` and run the
sprint loop from the core skill, then IMMEDIATELY re-poll for the next queued
sprint and keep pulling while any remains. If `next-sprint` returns
`sprint:null` despite the wake, another session claimed it first — re-arm
quietly, don't spin or complain. Other fields → surface once to the user, keep
listening.

**Flow:** run **drain** first (work everything already queued), then enter the
listening loop. A started sprint is the consent envelope — never ask
"continue?" between tasks or sprints; the stop conditions are the ones in the
core Guardrails only.

**DRAIN MEANS DRAIN — a worker never exits with sprints still queued
(regression guard, task f6c3618b).** After a sprint's last `/complete` and its
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
  1. The job's `input` carries `{ featureId, reviewId }`. Call
     `get_card_context` with the job's projectId + featureId — the packet's
     `reviews` section holds the review record: the user's comments (their
     words, verbatim) and the frozen `snapshot` (`docIds` / `taskIds` /
     `batchIds`) of what the verdict covered.
  2. Read the snapshot's tasks (`get_task`) and, where the comments demand it,
     the delivered docs/code, and ASSESS which task(s) were not delivered as
     requested.
  3. **Send back** an implicated task: `update_task` → `status: "backlog"`,
     appending the relevant comment excerpt to its notes (status revert + note —
     the user's words travel with the task).
  4. **Re-mint** work the comments describe that no existing task covers:
     `create_task` with `draft: false` (the user already spoke — these are real
     backlog tasks, never draft-gated), anchored to THIS ask (`featureId`), the
     description carrying the user's comment **VERBATIM** plus the review id, and
     note `review_sendback` in the description for audit.
  5. **Leave alone** every task the comments don't implicate — it keeps its
     delivered status.
  6. **Write the reconciliation back — ALWAYS, 0-task outcomes included**:
     `record_review_reconciliation { projectId, featureId, reviewId,
sentBackTaskIds, mintedTaskIds, summary, jobId }`. On a 0-task outcome pass
     empty arrays and a summary explaining WHY nothing changed — never silently
     clear; the user must see "assessed — nothing needed changing because X", not
     the ask going quiet. Then `complete_ai_job` (result may carry
     `{ changed: N }`).
  - **Guardrails**: scope is the snapshot's `taskIds` plus new mints on THIS ask
    only — never touch another ask's tasks; never delete anything; quote the
    user's comments, never paraphrase them into task descriptions without the
    original attached; the count changed may be 0 and that is a valid,
    reportable outcome.

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
