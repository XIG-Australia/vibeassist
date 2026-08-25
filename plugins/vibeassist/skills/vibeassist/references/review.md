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

## Never the builder

**Pass a steady `workerId` on every `wait_for_work` / `next_job` call.** A
review may not go to whoever built the thing, and a worker with no name cannot
be told apart from one — so an unnamed worker is **never handed a review at
all**, and the board quietly fills up with delivered asks that nobody merges.
The `workerId` is what makes this job exist.

If you are somehow handed the review of a build you made in this session, do not
run it: `complete_job({ jobId, error: "I built this — it needs a different
reviewer" })` and keep listening.

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

### 4 · Read the COMBINED result, and RUN IT

The build on top of what is already there — never the build on its own.

- **Read the real diff and the real code.** Not a summary of it.
- **Run the thing and see the result for yourself.** Open the page, click the
  button, call the endpoint. Verify from reality.

Green checks tell you the code compiles and the tests that exist pass. They tell
you nothing about whether the person got what they asked for.

### 5 · Answer three questions

1. **Does it do what the ask wanted?** The `want`, met in the running thing.
2. **Is every must-do there, and every must-not respected?** Line by line. An
   empty must-line is empty on purpose and asks nothing of you.
3. **Was anything built that the ask never asked for?** Scope creep is a fail
   here, even when the extra thing is good. It belongs on the board as its own
   ask, where the owner can see it and choose.

**Judge against the ask, not against your preferences.** Code you would have
written differently, but which does what was asked and breaks no must-not, is a
pass. This is not a style review.

### 6a · It passes → MERGE IT YOURSELF, THEN REPORT

**In this order, and the order matters.**

```bash
git -C <where> merge --ff-only <branch>
```

You just brought the main line into the branch and nothing else can land while
you hold
the only review, so this fast-forwards. **If `--ff-only` refuses, something
landed anyway** — go back to step 3, bring it up to date again, and re-read what
changed before you try once more. Never force it.

Then report:

```
report_review({ jobId, passed: true, merged: true })
```

**`merged: true` is a statement of fact and the app treats it as one.** A pass
is refused until the merge has actually landed, because **reporting a pass is
what marks the ask accepted** — a pass on an unmerged branch tells the owner
something happened that did not.

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

`complete_job({ jobId, error })` is the failure path only: you could not run the
review at all (no repository set, the branch is gone, the checkout is unusable).
One honest sentence. **A build that fails review is not that** — that is
`report_review` with `passed: false`, which is this job working exactly as
intended.
