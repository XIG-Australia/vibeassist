# The review — `review`

**Load this when:** you were handed a `review` job.

**This is the LAST of three jobs on one ask, and it is the one that lands the
work.**

> **THIS IS THE ONLY THING THAT MERGES ANYTHING.**
>
> Nothing else in VibeAssist merges. Not the build, not the code pass, not a
> check going green somewhere. If you pass this review, **you** merge the
> branch, with your own hands, before you report. If you were told anywhere that
> a reviewer does not merge, that instruction is from a road that no longer
> exists.

## One at a time, board-wide

**Only one review is ever handed out at once.** While you hold this one, nothing
else on the board is landing. That is not a queue problem — it is what makes the
merge at the end safe, because nothing can slip into the main line between you
bringing
the build up to date and you merging it.

So take your time and do it properly. Nothing is waiting behind you that a
rushed review would help.

## You are a FRESH agent, and that is what makes this honest

**You have never seen this work built.** Not the decisions, not the dead ends,
not the reasons somebody had for thinking it was fine. You were handed pointers
and nothing else: the job, the ask, the repo, the branch, the worktree.

**That is the independence, and it is enough.** It does not matter whose
terminal you are running in or who built the thing an hour ago — you cannot
inherit an assumption you were never told. **So go and read.** `get_ask` for
what was wanted, the real diff and the real code for what was done, and the
thing running for whether it works.

**If anyone hands you a summary of what the build did, it is a signpost and
never evidence** (§ The build's own account). Use it to find the work. Judge from
what you read yourself.

## What is already settled, and what is left

The code pass has already run. The tests, the type-check, the linter, the build
and the two database checks all came out clean **on the combined result**, or
this review would not exist.

**That half is settled. It is not yours to reopen, and it is not yours to wave
through.** Do not re-run the suite hoping for a different answer, and do not
pass something because "the checks were green" — green checks were the entry fee
for this conversation, not the verdict.

What is left is the reading only judgment can do: **does this actually do what
the person asked for.**

## The build's own account is a signpost, never evidence

The job carries what the build said it delivered — where the work is, and
anything it said was left to do. **Use it to find the work. Never believe it
about the work.** A build reporting that it did something is exactly the claim
you are here to test.

## Two outcomes, and only two

**A review ends in a MERGE or a SEND-BACK.** There is no third door.

| Outcome       | How                                                             |
| ------------- | --------------------------------------------------------------- |
| It merges     | `report_review({ jobId, passed: true, merged: true, mergedCommit })` — § 6a |
| It goes back  | `report_review({ jobId, passed: false, found })` — § 6c          |

**"Held", "stopped", "left unmerged", "flagged for the owner" are not
outcomes.** An ask left sitting at `delivered` with an unmerged branch is a
review that did not finish. Nobody is watching that branch; the owner finds it
days later, and the work is stale by then.

**A merge you cannot do cleanly is a SEND-BACK, not a stop.** Hard is not a
reason to hold — it is a reason to say what moved and let a fresh build do it
again on the current main line. That path is automatic: reporting `passed:
false` re-queues the ask, and the next builder starts from where the code is
now.

## The review, step by step

### 1 · Read the ask

`get_ask({ askId })` — the `want`, the **must-do**, the **must-not**, the `plan`
the owner approved, and `changeAsked` where the owner asked for something they
already had to be different. This is what you are judging against. Not your
taste, not how you would have built it.

### 2 · Find the work

Resolve the repository from the job's `projectId` — `list_projects`, then
`repo.where` (`references/standby.md` § One listener, every repo). The ask's
worktree is beside the served checkout, named `<checkout>-<shortId>`.

**Resolve that repo's main line too** —
`git -C <where> rev-parse --abbrev-ref HEAD`, call it `<mainline>`
(`references/standby.md` § The repo's main line). Every git command below uses
that name; the literal `main` is wrong in any project whose main line is called
something else.

### 3 · Bring it up to date, again

```bash
git -C <where> fetch origin <mainline>          # skip where there is no remote
git -C <checkout>-<shortId> merge <mainline>
```

**Do this even though the code pass did.** Something may have landed since, and
**a build made on an older starting point and merged as it stands puts back what
other asks have changed, quietly undoing finished work.** Fix what clashes.

**Two kinds of clash, and they end differently.**

- **Transient — the branch and the main line touched the same lines.** Ordinary
  git conflict. **Resolve it and carry on.** This is part of the review, not a
  reason to stop.
- **Structural — the ground the build stood on has moved.** The main line has
  changed the thing this branch was built against, so bringing it up to date
  would mean writing the work again, not merging it. The button attaches to
  counts that no longer exist; the table it reads was replaced; the page it
  added is gone. **You cannot resolve this by editing conflict markers, and you
  must not try.**

  **A structural clash is a FAIL. Send it back, now:**

  ```
  report_review({ jobId, passed: false, found:
    "<what moved on the main line, and why this branch no longer fits it>; build it again on the current main line" })
  ```

  That re-queues the ask and a fresh build rebuilds it against the code as it is
  today. **It is not `complete_job`** — you ran the review fine, and the answer
  it produced is "no". And it is not a hold: the ask must never be left
  delivered-and-unmerged because the merge was hard.

  **That call finishes the job — stop there.** Do not go on to step 4; there is
  nothing sound left to read. Leave the worktree and the branch where they are,
  the same as any other fail (§ 6c): the next build takes them over and does the
  work again on the current main line, rather than patching the old one.

**Never force a merge past a clash.** No `-X ours`, no `-X theirs`, no
`--strategy` that throws one side away, no commit with markers still in the
file. A merge you had to force is work quietly destroyed.

### 4 · Read the COMBINED result, and RUN IT

The build on top of what is already there — never the build on its own.

- **Read the real diff and the real code.** Not a summary of it.
- **Run the thing and see the result for yourself.** Open the page, click the
  button, call the endpoint. Verify from reality.
- **Run it in YOUR OWN worktree, on YOUR OWN port — never the owner's served
  checkout on port 3000.** They are using that one, and many checks sharing it is
  what bottlenecks and crashes it. Start the project's serve command (CLAUDE.md
  § Serving it for a review) against the branch you are verifying, on a free port
  of your own, and **kill it the moment you are done** — a review never leaves a
  server running.

Green checks tell you the code compiles and the tests that exist pass. They tell
you nothing about whether the person got what they asked for.

### 5 · Answer three questions

1. **Does it do what the ask wanted?** The `want`, met in the running thing.
2. **Is every must-do there, and every must-not respected?** Line by line. An
   empty must-line is empty on purpose and asks nothing of you.
3. **Was anything built that the ask never asked for?** Scope creep is a fail
   here, even when the extra thing is good. It belongs on the board as its own
   ask, where the owner can see it and choose.
4. **Does every word a user reads obey the copy standard?** Read the visible
   strings — buttons, headings, empty states, errors. A button written as a
   description instead of the common word ("Place it where it can be retrieved
   later" for Save; "See what came back"), a verbose or conversational label,
   chatbot filler, exclamation marks — each is a send-back. Judge against
   `references/ui-copy-standard.md`, and run `scripts/check_copy.mjs` on the
   strings as the mechanical floor.

**Judge against the ask, not against your preferences.** Code you would have
written differently, but which does what was asked and breaks no must-not, is a
pass. This is not a style review — with one exception, and it is not taste: copy
is judged against the WRITTEN standard, the same way a must-not is. "I'd have
worded it differently" is not a finding; "this breaks the copy standard" is.

### 6a · It passes → MERGE IT YOURSELF, THEN REPORT

**In this order, and the order matters.**

```bash
git -C <where> merge --ff-only <branch>
```

You just brought the main line into the branch and nothing else can land while
you hold the only review, so this fast-forwards. **If `--ff-only` refuses, something
landed anyway** — go back to step 3, bring it up to date again, and re-read what
changed before you try once more. Never force it.

**If it refuses again after that re-sync**, treat it as the structural case in
§ 3: send it back with `passed: false` and say what moved. **Do not hold the
job open, and do not try a third time.**

Then report:

```
report_review({ jobId, passed: true, merged: true, mergedCommit: "<sha>" })
```

**`merged: true` and `mergedCommit` are statements of fact and the app treats
them as such.** A pass is refused until the merge has actually landed and you
can say what it landed as. **You merged it, so you know the commit** — read it
off the main line, never guess it.

**A pass writes `delivered`, not `accepted`.** `delivered` means the work
reached the first place the owner can open it and try it, which is exactly what
your merge just did. **Accepting is the owner looking at it**, and they have not
looked — it arrived a second ago. Nothing you call accepts anything.

### 6b · The cleanup is yours

Once the merge has landed and the pass is reported, tidy up:

```bash
git -C <where> worktree remove ../<checkout>-<shortId>
git -C <where> branch -d <branch>
```

**This belongs to the merge, not to the builder.** The builder was finished long
before this point and had to leave the worktree behind for you and the code
pass. If nobody does it here, every ask leaks a worktree and a branch forever.

**Do it silently.** Cleanup is part of the work — never a question, never a
status update, never a line in the report.

### 6c · It fails → MERGE NOTHING

```
report_review({ jobId, passed: false, found: "<what was wrong>" })
```

**`found` is owed on a fail.** In enough detail to fix: what you looked at, what
you expected from the ask, and what you actually got. **A build told to try
again and not told what to change is the loop this exists to prevent.**

**Leave the worktree and the branch exactly where they are.** The ask goes back
to be built again, and the next build picks up in that worktree with your
findings as its brief.

**Fail the whole thing, not part of it.** There is no partial pass, no
merge-with-notes, and no "passing this but here's a list". Either it does what
was asked and lands, or it goes back with a reason.

**After a few rounds of the same work failing, the app stops it on its own** and
waits for the person rather than going round again.

## When you are done

`report_review` reports and finishes the job in one call. **Do not call
`complete_job` after it** — a second finish comes back an error.

`complete_job({ jobId, error })` is for ONE thing: **you could not run the
review at all** — no repository set, the branch is gone, the checkout is
unusable. One honest sentence.

**Nothing about the work itself goes down that road.** A build that fails the
review is not that. Neither is a merge that clashes, however badly — a clash is
an answer about the code, and answers go through `report_review` with
`passed: false`, which is this job working exactly as intended.
