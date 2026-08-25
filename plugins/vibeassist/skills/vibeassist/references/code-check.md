# The code pass — `code_check`

**Load this when:** you were handed a `code_check` job.

**This is the SECOND of three jobs on one ask.** A build finished and reported
what it delivered; that delivery fired this job. You run the checks on it. If
everything comes out clean the app starts a review
(`references/review.md`) and a third worker merges it. **You merge nothing.**

**Every delivery goes through this, and it runs before any review.** Nothing
gets read by a reviewer until this pass is clean, so a wrong answer here either
wastes a reviewer's time or waves broken work through.

## You did not build this, and that is the point

**Pass a steady `workerId` on every `wait_for_work` / `next_job` call.** It is
how the app keeps the worker who built a thing away from the passes that judge
it. If you are somehow handed the code pass for a build you made in this
session, do not run it: finish it with `complete_job({ jobId, error: "I built
this — it needs a different worker" })` and keep listening.

## Nothing here is a judgment

**Every answer you send is what a command reported** — not what you expected it
to report, and not what the build said about itself. You are not deciding
whether the work is good; that is the review's job. You are establishing what is
true about the code so the review has something solid to stand on.

So: run the command, read the output, report the output. A test you believe is
flaky still reports as a test that failed.

## The pass, step by step

### 1 · Find the work

The job names the ask and the branch the build left behind. Resolve the
repository from the job's `projectId` — `list_projects`, then `repo.where`
(`references/standby.md` § One listener, every repo). Never use the folder you
happen to be standing in.

The build's worktree is still there, beside the served checkout, named
`<checkout>-<shortId>` — the builder is told to leave it exactly so you can pick
it up. Work in it. If it is genuinely gone, make it again on the same branch:

```bash
git -C <where> worktree add ../<checkout>-<shortId> <branch>
```

### 2 · Bring the build up to date FIRST

**Before you check anything**, put the build on top of everything already
merged, and fix what clashes:

```bash
git -C <where> fetch origin main          # skip where there is no remote
git -C <checkout>-<shortId> merge main
```

**Resolve the conflicts — do not abort and report them.** Bringing it up to date
is part of this pass, not a failure to hand back. Only a clash you genuinely
cannot resolve is a finding, and then it goes in `found` with what fights what.

### 3 · Check the COMBINED result, never the branch alone

Everything you run from here runs on the build **on top of what is already
there**. The branch on its own is not the thing that would be merged, so a green
run against it proves nothing about the merge. This is the single most common
way a check passes and the merge still breaks the app.

### 4 · Run the project's own checks

Four of them, and they are the project's, not a script this skill names:

| Field   | What to run                                    |
| ------- | ---------------------------------------------- |
| `tests` | the project's test suite                       |
| `types` | its type-check                                 |
| `lint`  | its linter                                     |
| `build` | its build                                      |

Read the real commands off the project — its `package.json` scripts, its
`Makefile`, whatever it actually uses. **Do not invent a command and do not
substitute a subset.** A check you could not run is not a check that passed: say
so in `found` and report that field false.

### 5 · Then the database

Two separate things, and both block:

- **Apply the database changes this build needs.** A migration that was never
  run is a failure exactly like a red test — it is never a note to carry on
  with.
- **Confirm the code and the database still agree** — no drift. That is
  `dbAgrees`.

A project with no database has nothing to run and nothing to disagree: empty
`ranMigrations` and `dbAgrees` true.

### 6 · The honesty contract — `broughtIn` and `ranMigrations`

**Two things are not yours to answer, and you are asked what you DID instead.**

- **`broughtIn`** — every ask whose merged work you brought in on top of this
  build, **by ask id, read off the `VibeAssist-Ask:` trailers on the commits you
  merged in.** Empty only if nothing had been merged.
- **`ranMigrations`** — every database change you ran for this build, by
  version. Empty when it needed none.

**The app checks both against the real state itself** and works out from that
whether the build is up to date and whether those changes have been applied.

> **IF WHAT YOU SAY YOU DID AND WHAT THE APP FINDS DISAGREE, THE BUILD GOES
> BACK.** Name them accurately rather than generously. A guessed id is not a
> harmless guess — it is the build failing for a reason nobody wrote down.

This is why the commit trailer matters. Read the ids; do not remember them.

### 7 · Report — `report_code_check`

```
report_code_check({ jobId, broughtIn, ranMigrations,
                    tests, types, lint, build, dbAgrees, found })
```

**`found` is owed on any failure**, in enough detail to fix. It is what the
build is handed when it comes back, and a build told to try again without being
told what to change is the loop this whole shape exists to prevent. Name the
check, the failure, and where.

**ANY ONE OF THE FIVE FALSE BLOCKS THE BUILD RIGHT THERE.** No review is
started, nothing merges, and the ask goes back to be built again with `found` on
it. **All of them clean is the only thing that starts a review.**

**After a few rounds of the same build failing, the app stops it on its own** and
waits for the person instead of going round again.

## When you are done

`report_code_check` reports and finishes the job in one call. **Do not call
`complete_job` after it** — a second finish comes back an error.

**Leave the worktree and the branch alone.** Clean or red, they stay: a clean
pass hands them to the reviewer, and a red one hands them back to the builder.
**Cleanup happens once, at the merge, and it is the reviewer's.**

**And merge nothing.** Bringing `main` INTO the branch is this job. Putting the
branch into `main` is not, in any circumstance, however green the checks came
out.

## The failure path is narrow

`complete_job({ jobId, error })` is for when you could not **run** the pass at
all — no repository set, the branch is gone, the checkout is unusable. One
honest sentence.

**A red check is not that.** A failing test, a type error, a broken build,
drift — those are a successful code pass reporting `false` with `found` filled
in. Reporting a genuine red as a job error hides it from the board and strands
the ask.
