# Listening roles — the worker, and the road being replaced

**Load this when:** the skill was invoked as `/vibeassist worker` (or the run
config resolves to that role) — read it BEFORE arming the listening loop.

**Standby is not in this file any more.** `/vibeassist standby` loads
`references/standby.md`: that loop was rebuilt on the `wait_for_work` MCP
tool, and nothing about its transport survives here. The doctrine it kept —
drain means drain, honest exit reasons, the sleep policy, progress breadcrumbs
— went with it.

The terminal session is a LISTENER the user starts ONCE per working session;
everything after is pushed from VA (Start, questions, jobs). Never make the
user type further instructions into the terminal — if you need information, use
the question channel, not the chat.

## The loop script is retired

The listening loop used to be `~/.claude/va-standby.sh` — a bash loop that
`curl`ed `/api/public/claude/updates` with a stored `VIBEASSIST_TOKEN`, in two
role variants. **That script is gone from this plugin.** The rebuilt app hands
the assistant a held-open `wait_for_work` tool instead, so the loop is the
assistant calling that tool and re-arming. Retired with it: the token, the URL
env var, the `&sprints=1` variant, the allow rule for the bash loop, and the
launcher / print-mode / reaper machinery that existed only because a headless
session died after one turn.

Do not port any of it. If you find yourself writing a poller, stop — see
`references/standby.md` for the loop that exists.

**The worker's own wake road went with it.** Waking on an approved Ask was a
field on the old `/updates` response; on the rebuilt app a worker listens
through the same `wait_for_work` loop. **`build` is a live job kind now** —
standby's build lane dispatches it, and how it runs is written up in
`references/standby.md` (§ A `build` job, step by step). So the road below is
DOCTRINE — what to do once work reaches you — while the transport that actually
delivers a build today is standby's loop. Read them together; do not go looking
for a third way in.

## Worker role

`wakeEligibleAsks > 0` → **approved work is waiting, and this is the road
delivery runs on.** Call `next_approved_ask` and run the loop in
`references/delivery-on-asks.md`, then poll again and keep going while any
remains. `ask: null` despite the wake means another worker took it — re-arm
quietly, don't spin.

(This wake did not exist until 4 Aug 2026. Nothing anywhere woke a worker for
an approved ask, so approving one and leaving a worker listening did nothing at
all — and there was no way to tell that from a broken machine.)

**Sprint wakes are gone.** `wakeEligibleSprints` and `queuedSprints` used to
mean "a sprint is waiting on the OLD road — pull it via `next-sprint`". That road
was removed on 8 August 2026 (Simon: _"Finished and Asks only"_), the queue was
verified empty across every project first, and `next_sprint` no longer exists. If
those fields still arrive, **surface them once and keep listening** — do not go
looking for a way to work them.

**Flow:** run **drain** first (work everything already approved), then enter the
listening loop. An approved ask is the consent envelope — never ask "continue?"
between asks; the stop conditions are the ones in the core Guardrails only.

**DRAIN MEANS DRAIN — a worker never exits with work still waiting
(regression guard, task f6c3618b).** The queue-empty signal is
`next_approved_ask` returning `ask: null`. **Nothing else counts as empty.**
After an ask's delivery is reported and its PR is opened, do NOT end the turn:
immediately re-poll (`get_updates` → `next_approved_ask`) and pull the next
approved ask, and keep going while any remains.

A clean early exit while approved asks remain is a DEFECT, not a boundary stop
(the same failure seen live on 2026-07-18 — see `references/incidents.md`). A
worker may stop ONLY when the queue is genuinely empty OR the sleep policy fires
(idle grace / quiet hours); and its exit `kind:"notice"` MUST STATE THE REASON —
"queue empty", "idle limit (N min)", or "quiet hours" — so an early exit is
diagnosable from the board rather than looking like a silent stall.

## Old-road job playbooks — kept for reference, not current

These are the job kinds the OLD app dispatched over `next_ai_job` /
`complete_ai_job` / `update_ai_job_progress`. Those tools are not part of the
rebuilt app's tool set, and neither kind is dispatched today. They are kept
because the judgement in them is worth keeping — read them as reasoning to
reuse when an equivalent job kind returns, never as a road to go looking for.

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
- **Job playbook — `fix_pr` (a pull request that will not merge).** VibeAssist
  watches the PRs it opens, and until now it could only SAY when one went red:

  > "I notice I have to often call sessions back to fix conflicts or CI and
  >  other issues in PRs."

  This job is the answer to that. It is the one job that does real work on a
  branch, so read the whole entry before starting one.

  **`input.brief` is the instruction and it is authoritative.** It names the
  repository, the pull request, the branch, the head commit, the base branch
  and what VibeAssist saw. Follow it in the order it gives. It also carries the
  rules below, because they are the ones no guard can enforce from the app
  side — the app already refuses to dispatch for a protected branch, a fork, a
  deliberately-withheld destructive migration, or the same commit twice. What
  it cannot check is what you do once you have the checkout.

  1. **REPRODUCE IT FIRST.** Check the branch out at the named commit and run
     the failing check yourself. Do not change a line before you have seen the
     failure. If it will not reproduce, that IS the finding — report it and
     stop.
  2. **CHECK THE BASE BRANCH.** Run the same check there. If it fails there
     too, this PR did not cause it: report that and stop. "Fixing" it on this
     branch hides somebody else's breakage inside an unrelated pull request.
  3. **Only that branch.** Never commit to the base or to a second PR.
  4. **Never rewrite history.** No force-push, no rebase, no amending a pushed
     commit. Add commits — somebody may have this branch checked out.
  5. **Do not make the red go away.** Deleting a test, loosening a guard,
     raising a ratchet baseline or adding an ignore is not a fix; it is the
     failure plus a blindfold. If the check is genuinely wrong, say so instead
     of editing it.
  6. **Run the WHOLE suite before pushing**, not the one check that was red.

  **Report in this exact shape** — the app reads these fields and turns them
  into what the owner is told:

  ```
  complete_ai_job(jobId, result: {
    pushed: true|false,          // did you actually push a commit?
    reproduced: true|false,      // did the failure reproduce for you?
    baseAlsoFails: true|false,   // does the base branch fail the same way?
    summary: "<what was wrong, and what you did>"
  })
  ```

  `pushed: true` is the only value that produces silence, and rightly — the
  watcher sees your commit on its next pass and either merges it or reports the
  new red. Every other outcome becomes a sentence in the owner's tray, so a
  result that says nothing produces "VibeAssist tried to fix PR #N, pushed
  nothing, and did not say why." Do not let that be your report.

  **A report IS a complete answer here.** "The base branch is broken" and "it
  would not reproduce" are both successful outcomes of this job. Pushing
  nothing and saying nothing is the only failure.

## Sleep policy — an idle run ENDS deliberately, it never idles forever

The worker reads `sleepPolicy` (`{ idleMinutes, quietHours, keepListening }`)
from every `/updates` response, the user's setting. (Standby's version of this
policy — and the fact that nothing on the rebuilt app hands it one — lives in
`references/standby.md`.)

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
