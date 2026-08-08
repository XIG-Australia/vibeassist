# Question channel — parking, resuming, and partial sprint completion

**Load this when:** a sprint is ending with parked tasks / unanswered
questions, or you need the full park-and-resume protocol beyond the core's
summary.

## Parking detail

Park work-in-progress on the sprint branch as `[parked] WIP: <task title>` — a
real commit ending with the task's `VibeAssist-Task:` trailer (recoverable,
visible in git), never a stash — so the tree is clean and parked work can never
leak into another task's commits. Record where you stopped (what's done, what
the answer unblocks) so ANY session can resume it.

## `config.onQuestion` (from `next_approved_ask`; default `continue`)

> It used to arrive on the `next-sprint` response. That endpoint went with the
> sprint road on 8 August 2026; the per-project run config rides with the
> approved ask instead.

- **wait** (or you have no other safe task) — poll for the answer:

  ```bash
  curl -s -H "Authorization: Bearer $VIBEASSIST_TOKEN" \
    "$VIBEASSIST_URL/api/public/claude/ask?questionId=<id>"
  ```

  Returns
  `{"ok":true,"status":"pending|answered|dismissed","answer":...,"answeredOptionId":...}`.
  Poll every ~15–30s.

- **continue** (park-on-block) — move to the next SAFE task: prerequisites all
  done/unblocked AND no dependency on any parked task. A task that builds on a
  parked one is itself blocked — park it too or ask; never build on missing
  foundations. **Answered blockers outrank fresh work:** between tasks (and at
  the sprint boundary), re-check the blocked question(s) — when an answer has
  arrived, resume that parked task (continue from its `[parked]` commit) BEFORE
  starting any new task.

## On the answer

`answered` → use `answer` / `answeredOptionId` to proceed (continue from the
`[parked]` commit, finish, report as normal). `dismissed` → the user declined
to answer; proceed on your best judgment and note it in the task's
`techDetails`.

## Sprint end with questions still unanswered → the sprint completes PARTIALLY

Parked tasks stay blocked-awaiting-answer — never reported `failed`, never
silently dropped. `git revert` their `[parked]` commits before opening the
sprint PR (the PR ships only completed work; note the reverted SHAs in the
run summary so the work is recoverable on resume), and the run summary MUST
lead with them: "N task(s) awaiting your answers".

## Never hang forever

If nothing is answered after a reasonable wait and you've run out of safe
work, stop and tell the user their question(s) are waiting in the VibeAssist
inbox — they'll be picked up on the next `/vibeassist` run.
