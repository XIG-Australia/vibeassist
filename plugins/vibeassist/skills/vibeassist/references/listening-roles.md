# Listening roles — the worker

**Load this when:** the skill was invoked as `/vibeassist worker` (or the run
config resolves to that role).

## The worker IS the standby listener

**There is one listening loop, and it lives in `references/standby.md`.** Load
that file and run it. This one exists to send you there and to keep the doctrine
that is true of any listening role.

The terminal session is a LISTENER the user starts ONCE per working session;
everything after is pushed from VA (Start, questions, jobs). **Never make the
user type further instructions into the terminal** — anything you need from them
goes through `ask_user` on the job.

**A restart is an ordinary kickoff, and it ends ARMED.** After a Ctrl+C the next
`/vibeassist worker` loads this file, loads `references/standby.md` and calls
`wait_for_work` — no recap of the stopped session, and no "shall I carry on?".
Being started is the go-ahead. See `references/standby.md` § Starting again
after a stop.

**The worker's own wake road is gone.** A worker used to poll for an approved
Ask over HTTP and pull it with `next_approved_ask`. That whole road — the
`/updates` endpoint, the `~/.claude/va-standby.sh` bash loop, the stored token,
the launcher, the print-mode session and the reaper — is retired, not adapted.
The app hands the assistant a held-open `wait_for_work` tool instead, and the
loop is the assistant calling it and re-arming.

**Do not port any of it.** If you find yourself writing a poller, or composing a
`curl` to move an Ask along, stop.

## Pass a `workerId` — the whole thing hangs off it

Every `wait_for_work` / `next_job` call carries one steady name for the session.
A review may never go to whoever built the thing, so an unnamed worker is never
handed one, so nothing merges and every Ask stops at `delivered`. **Pin the name
at kickoff and keep it, including across a compact** — a name that changes
mid-session is two workers as far as the app is concerned. The full reasoning is
at the top of `references/standby.md`; the rule is one argument, every call.

**And when the wait is your own build's review, say so.** You delivered it, so
you cannot be handed its review — say that once, in plain words, and carry on
listening:

> I built that one, so I can't review my own work. I'm waiting for a second
> assistant to pick the review up. That's normal, not stuck — start another
> listener and it will land.

Full rule: `references/standby.md` § Waiting on the review of your OWN build.

## What a worker is now responsible for

**An Ask is not done when it is delivered. It is done when it is merged.**

The old worker's job ended at "delivery reported". The current one does not:
building an Ask is three jobs — `build`, then `code_check`, then `review` — each
handed to a different worker, and the merge happens in the third. A listener
takes whichever of them it is handed.

So **a listener that stops after the builds are done has not finished the
queue.** The checks and the reviews arrive as their own jobs, after, and they
are what actually land the work. Keep listening.

## Drain means drain

**A worker never exits with work still waiting** (regression guard, task
f6c3618b). The queue-empty signal is `wait_for_work` coming back with
`{ job: null }` — and even that is the ordinary quiet answer, not a finish line.
**Nothing else counts as empty.**

A clean early exit while work remains is a DEFECT, not a boundary stop (the same
failure seen live on 2026-07-18 — see `references/incidents.md`). An approved
Ask is the consent envelope: never ask "continue?" between Asks. Stop only for
the reasons in `references/standby.md` § Stop reasons, and **always say which
one** — an unexplained stop is indistinguishable from a crash.

## Sleep policy — an idle run ENDS deliberately, it never idles forever

Where the user set one:

- **Grace window** — after `idleMinutes` with nothing actionable (0 = sleep
  immediately on an empty queue), SLEEP instead of re-arming; new work arriving
  resets the window.
- **Quiet hours** — inside the user's window (local time, e.g. 00:00–07:00),
  skip the grace window and sleep at the first idle moment. Nobody queues work
  at 4am.
- **Always-on** — the user opted into the standing listener and accepts the
  cost; stay.

**To sleep:** say the final run summary LEADING with the exit reason ("Queue
empty", "Idle limit (N min)", "Quiet hours"), followed by what was merged, what
is still moving through its check or review, any owner-only steps, and any Asks
parked on unanswered questions — so the user's morning starts with the summary
AND the reason the run ended, not a silent terminal. Then END; do not re-arm.
Any wake path restarts the run with the SAME kickoff command; design nothing
that needs the old session to still exist.

**Note honestly:** nothing the app hands the loop carries a sleep policy, so a
listening session cannot read the user's setting — honour what they said when
they started it, and surfacing it properly is a change to the app, never
something to invent here.

Why sleep beats idling: an idle listener wakes ~8×/hour and every wake is a full
context cache miss; an unattended auto-approve session is a standing capability;
and a fresh session per run is free hygiene.

## Old-road judgement worth keeping

The job kinds below are **not dispatched today** and their tools are not part of
the app's tool set. They are kept because the reasoning in them is worth
reusing if an equivalent job kind returns — never as a road to go looking for.

- **The review send-back assessment.** The user sent an Ask's deliverable back
  with comments. The job is an **ASSESSMENT, not a blanket rejection**:
  re-assess against the comments and act ONLY on what they actually implicate.
  The number needing rework may be **0** — the comments were a
  misunderstanding, or the work already satisfies them. Re-mint work the
  comments describe that nothing on the board covers, carrying the user's words
  **VERBATIM**; it arrives proposed and the user accepts it. **Fix the shape
  when the shape is what was wrong** — rebuilding to a broken shape fails twice.
  Leave alone everything the comments don't implicate. And **say what you
  concluded ALWAYS, including when nothing changed**: the user has to read "I
  checked, and nothing needed changing because X" — never the Ask going quiet.
  Stay on that Ask and its children, never delete anything, and quote the
  comments rather than paraphrasing them.

## What listening looks like (tell the user once at kickoff)

The session sits quietly between checks — that's normal, not hung. Stop it any
time with Ctrl+C; work queued meanwhile is picked up by the next kickoff.

**Every stop is named out loud, Ctrl+C included** — an unexplained stop is
indistinguishable from a crash — and the way back is one command,
`/vibeassist worker`, which arms straight away.
