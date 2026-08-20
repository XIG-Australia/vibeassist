# Question channel — parking on a question, and coming back to it

**Load this when:** you need the person before you can go on, or a run is
ending with asks parked on unanswered questions.

## The one rule

**Asking parks the job. Parking ends your turn.**

`ask_user` puts the job down: the app parks it, your claim is released, and you
stop. You do not wait. There is no loop, no timer, no "check back in thirty
seconds".

When the person answers, the app puts the job back in the queue. Whoever is
listening then — `wait_for_work` — is handed it and carries on. It may be a
different session on a different day. Nothing is lost by leaving.

**So waiting on a person costs nothing.** No claim held open, no context idling,
no lane blocked. Ask the moment you need to. Never guess to dodge a wait.

## What NOT to do

- **Do not poll `get_answer`.** `{ answered: false }` means the question is
  still on their screen. It is not a failure and it is not something to sit on.
  Read `get_answer` when you are HANDED a job that already has an answer, and
  only then.
- **Do not send `report_progress` while waiting.** A parked job has no claim to
  keep alive, so the call is refused. `report_progress` is for work that is
  genuinely running.
- **Do not report the job failed.** The question already says why you stopped.
  Reporting failure on top of it hands the next helper the same wall.
- **Do not ask in the terminal.** In a listening session nobody is watching the
  terminal, so a terminal question is an invisible stall.

## Ask well, because you only get one

One question at a time per job. A second question on the SAME job is refused
until the first is answered. Different jobs are independent — each question
shows on its own ask — so two jobs asking at once is normal.

- **Scope it to the job you hold.** The question shows on the ask that stopped,
  which is what lets the answer bring that job back.
- **Ask the one thing that unblocks you**, not a list, and not a thing you can
  decide yourself.
- **Their words, not a program's.** They read it on their ask.
- **Options have to carry enough to choose.** What each one does and what it
  costs — never just a name.

## Coming back to a parked job

You are handed a job with a question already answered on it. That is a resume,
not a fresh start.

1. Read the ask, so you know what was wanted.
2. Read what they said — `get_answer` for the answer, `get_conversation` where
   the job carries a whole thread.
3. Carry on from there. Do not redo what the ask already records as done.

If the person declined to answer, use your best judgment and say plainly, in
what you write back, that you chose it yourself.

## The BUILD case — parking code, not just a question

Everything above is the **shaping** case: nothing is on disk, the app parks the
job server-side, and there is no commit to make.

A **build** is different, because there is half-finished work in a tree. Note
first: **`build` is not a live job kind yet.** This is the shape it lands in,
recorded now so it is not re-invented later.

When a build has to stop on a question:

- **Commit the work-in-progress on the ask's own branch** as
  `[parked] WIP: <ask name>` — a real commit ending with the
  `VibeAssist-Ask:` trailer you were handed, never a stash. It is recoverable,
  it is visible in git, the tree is clean, and parked work can never leak into
  another ask's commits.
- **Write down where you stopped**: what is done, and what the answer unblocks.
  Any session may be the one that resumes it.
- **Then ask, and stop.** Same rule — the ask parks the job and ends the turn.
- **On resume**, continue from the `[parked]` commit.
- **Before opening a pull request for other work**, `git revert` the `[parked]`
  commits, so a PR only ever ships finished work. Note the reverted SHAs where
  you record the parked state, so the work is recoverable.

## Ending a run with questions open

A parked ask stays parked. It is not reported failed and it is not dropped —
the question is already the record of why it stopped.

Lead the run summary with them: "N ask(s) waiting on your answers". Then stop.
There is nothing to watch.
