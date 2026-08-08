# Question channel — parking, resuming, and ending a run with questions open

**Load this when:** a run is ending with parked Asks / unanswered questions, or
you need the full park-and-resume protocol beyond the core's summary.

## Parking detail

Park work-in-progress on the Ask's own branch as `[parked] WIP: <ask name>` — a
real commit ending with the `VibeAssist-Ask:` trailer you were handed
(recoverable, visible in git), never a stash — so the tree is clean and parked
work can never leak into another Ask's commits. Record where you stopped (what's
done, what the answer unblocks) so ANY session can resume it.

**Scope the question to the Ask** (`askId`, not `projectId`). The question then
shows on the Ask that is stopped and your build stays open, which is what lets
you carry on the moment it is answered. A project-level question about an Ask you
are building blocks nothing and the answer has no way back to you.

**The question IS the record of why you stopped.** Do not also report the
delivery failed — that would return the Ask to approved and hand the next worker
the same wall to hit.

## `config.onQuestion` (from `next_approved_ask`; default `continue`)

> It used to arrive on the `next-sprint` response. That endpoint went with the
> sprint road on 8 August 2026; the per-project run config rides with the
> approved Ask instead.

- **wait** (or you have no other safe work) — poll for the answer:

  ```bash
  curl -s -H "Authorization: Bearer $VIBEASSIST_TOKEN" \
    "$VIBEASSIST_URL/api/public/claude/ask?questionId=<id>"
  ```

  Returns
  `{"ok":true,"status":"pending|answered|dismissed","answer":...,"answeredOptionId":...}`.
  Poll every ~15–30s.

- **continue** (park-on-block) — take the next SAFE Ask: nothing that builds on
  the parked one. Because you are served leaves and never a parent while a
  needed child is unfinished, the tree mostly keeps you out of this — but an
  Ask that plainly depends on the parked one is itself blocked, so park it too
  or ask; never build on missing foundations. **Answered blockers outrank fresh
  work:** between Asks, re-check the blocked question(s) — when an answer has
  arrived, resume that parked Ask (continue from its `[parked]` commit) BEFORE
  starting anything new.

## On the answer

`answered` → use `answer` / `answeredOptionId` to proceed (continue from the
`[parked]` commit, finish, report as normal). `dismissed` → the user declined to
answer; proceed on your best judgment and say so in `built`.

## Ending a run with questions still unanswered

A parked Ask stays parked with its question open — it is neither reported
`failed` nor silently dropped, because the question already says why it stopped
and reporting failure on top of it would return the Ask to the pool for someone
else to re-discover the same blocker.

`git revert` its `[parked]` commits before opening any pull request for other
work, so a PR only ever ships completed work (note the reverted SHAs in the run
summary, so the parked work is recoverable on resume). The run summary MUST lead
with them: "N Ask(s) awaiting your answers".

## Never hang forever

If nothing is answered after a reasonable wait and you've run out of safe work,
stop and tell the user their question(s) are waiting in the VibeAssist inbox —
they'll be picked up on the next `/vibeassist` run.
