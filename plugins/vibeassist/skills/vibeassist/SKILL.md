---
name: vibeassist
description: Take the next Ask the user approved in VibeAssist, build it, and report what it now does so the Ask updates itself. Use when the user runs /vibeassist, or says "build my VibeAssist Asks", "work my VibeAssist queue", "drain my VibeAssist backlog", or similar. Modes — "review" (default: one Ask at a time, confirm before the next), "run" (work through the run, then pause), "drain" (keep going until nothing is approved). Listening roles (smart kickoff, run once per working session): "worker" (build approved Asks, then keep listening — new work starts automatically when the user presses Start in VA), "standby" (long-poll responder: watch for updates and act/surface them).
---

<!-- vibeassist-skill-version: 0.12.0 (single-sourced from plugins/vibeassist/.claude-plugin/plugin.json — keep them in step) -->
<!-- 0.12.0 (18 Aug 2026): verify inward (green from the tool is not the running thing — open every touched surface after a generator/scaffold/rename/move); the build note is read from code, never transcribed; send-back routing reasons. -->

# VibeAssist Ask runner

You take an Ask the user approved in VibeAssist, build it, and report what it
now does. The user drives WHICH work; you drive HOW.

**One Ask, one branch, one pull request.** There is no sprint to pull, no task
to claim and no batch to compose — an Ask already contains Asks, so the tree is
the grouping. The sprint road was removed on 8 August 2026; if you find yourself
reaching for `next_sprint`, `start_task` or `complete_task`, they are gone and
nothing replaced them one-for-one.

This core is the whole cold happy path. Detail loads on demand from
`references/` in this skill's directory — each pointer below says when. Helper
scripts ship in `scripts/` — install them by COPYING the packaged file, never by
transcribing.

## 1 · Connect & verify (every run, first)

**MCP-first.** If the `mcp__vibeassist__*` tools are present (one-click OAuth
connect), use them for the whole loop — they authenticate automatically and
mirror the REST endpoints (`next_approved_ask`, `report_ask_progress`,
`report_ask_delivery`, `ask`/`get_answer`, `get_updates`, `open_pr`), and each
tool's description carries its own playbook. No env vars or token check needed
on this path.

**Curl fallback (paste-a-key).** Every one of those tools has an HTTP twin, so
this road is complete — you never need MCP to deliver. It needs two env vars
visible to Bash: `VIBEASSIST_URL` (default `https://vibeassist.app`, no trailing
slash) and `VIBEASSIST_TOKEN`. Verify with the allow-listed checker script —
never an inline compound (it prompts every session):

```bash
bash ~/.claude/va-check.sh
```

Overwrite `~/.claude/va-check.sh` with a copy of this skill's
`scripts/va-check.sh` whenever it is missing, OR its output has no
`va-check-version:` line, OR that version is lower than 3 — a stale checker lies
with authority (see `references/incidents.md`). Line 1 of output is the verdict:

| Verdict              | Meaning → action                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `configured`         | Proceed.                                                                                                                                            |
| `MISSING`            | Not set up → load `references/setup.md` and walk the user through it.                                                                               |
| `STALE`              | The settings.json token is VALID; this session froze an old env copy → RESTART the session (and the daemon, if it's the daemon). Do NOT regenerate. |
| `REVOKED`            | A token the check actually READ was rejected → regenerate in VA → paste into `~/.claude/settings.json` → restart.                                   |
| `UNREACHABLE:<code>` | Network/host problem, not a token problem — check the URL, network, or VA status.                                                                   |

**`CHECK_FAILED:<why>` → the CHECK broke, NOT the token.** Never tell the user
their token is bad on this verdict — report what actually failed and fix that:
`cannot-read-settings-json*` = settings.json unparseable or node missing;
`curl-not-installed` = the curl path is unavailable (the MCP path may still work).

Never print or log the token; never wrap it in `$(...)` (command substitution is
never auto-approved). Prefer Read/Grep/Glob over shelling out; one tool per Bash
line; no `$VAR` in a path argument.

## 2 · Kickoff (once per session)

1. **Tool preflight:** `bash ~/.claude/va-preflight.sh` (copy from this skill's
   `scripts/va-preflight.sh` if missing). All ok → say nothing. `gh` MISSING →
   not fatal (VA opens PRs server-side); post a one-line `kind:notice` on the
   first Ask you take. `bun` MISSING → use the npm/npx equivalents. `git` or
   `node` MISSING → genuinely blocking: raise an `ask` (`kind:decision`).
2. **Repo-safety preflight** (before touching any clone):
   `node scripts/preflight.cjs` in the project repo. Verdict SAFE → proceed.
   NOT SAFE (you're on `main`, or another worker holds this checkout) → stop;
   switch to a branch/worktree or yield.
3. **Preferences sync:** fetch once —
   `curl -s -H "Authorization: Bearer $VIBEASSIST_TOKEN" "$VIBEASSIST_URL/api/public/claude/preferences"`.
   - **Skill freshness:** if the response's `currentSkillVersion` is newer than
     this file's version marker, tell the user in ONE line to update the plugin
     and post a `kind:notice` on the first Ask you take; otherwise say nothing.
   - Missing allow-rules, an unconfigured worker profile, or a role-model
     mismatch → load `references/kickoff-sync.md` and follow it. Applying ANY
     settings change is offer-first in EVERY mode — the consent to build an Ask
     never covers the user's settings file.
4. **Listening roles:** invoked as `worker` or `standby` → load
   `references/listening-roles.md` BEFORE arming the listening loop.

## 3 · Mode

Every served Ask carries a `config` block
(`{ mode, onFailure, onQuestion, contextHygiene, selfReview }`) set per-project
— use `config.mode` as the default and apply `config.onFailure` on failures,
unless the user gave an explicit mode at invocation (that overrides). No config
yet → default **review**.

- **review** — ONE Ask, then ask (via the question channel) before the next.
- **run** — work the run in order; at its end, ask via a `kind:"decision"` /ask.
- **drain** — keep taking approved Asks until there are none.
- **worker** / **standby** — listening roles: `references/listening-roles.md`.

### Overnight drain — the build-overnight doctrine

The VibeAssist rhythm is **plan during the day, build overnight, review in the
morning** — the worker owns the overnight half, and the promise is to clear as
much as possible and ENSURE it happens.

- **Build everything buildable.** In drain (and any overnight run) the default
  is to deliver every approved Ask you are handed — never defer buildable work
  for tidiness.
- **Stop for exactly two reasons,** each recorded where the user will see it (a
  question on the Ask, or `outcome: "failed"` with the reason in `built`):
  (a) it needs a decision — raise the `/ask`; or (b) it is clearly superseded.
  Anything else gets built.
- **End every run with ONE complete report:** what was built, what wasn't, and
  why for each stop. A run that leaves the owner guessing has failed its promise.
- **The approval gate is the user's.** Approval is the only thing that makes
  work available, and nothing you can pass relaxes it. If the user expects work
  and nothing comes, the answer is almost always that the Ask is shaped but not
  approved — tell them that rather than looking for another way in.

## 4 · The loop

**Take the next approved Ask** (it serves AND claims in one call):

```bash
curl -s -X POST "$VIBEASSIST_URL/api/public/claude/next-approved-ask" \
  -H "Authorization: Bearer $VIBEASSIST_TOKEN" -H "content-type: application/json" \
  -d '{}'
```

`{"ok":true,"ask":null}` → nothing is approved: say so and stop (or offer to
wait, in drain). 401 → token problem (re-run the checker). Otherwise you get
`ask` with its **Shape** (`want`, `mustDo`, `mustNot`), its place in the tree
(`parentName`, `children`), what it `touches`, the `actions` it names, the
`branch` to use, the `commitTrailer` to stamp, plus `repo`, `config` and
`designLanguage`.

**You are served leaves, not parents.** The deepest approved Ask comes first,
and a parent is never handed out while a needed child of it is unfinished — a
parent is delivered by delivering its children. So: do not go looking for the
parent, and build only the Ask you were handed. Its children are someone else's
turn, possibly another worker's right now.

**Right repo, before touching any file:** `git remote get-url origin` must match
`ask.repo.fullName` — never assume the current directory is correct (stale
clones in OneDrive/Documents are a known trap). `repo.fullName` null → no repo
is connected; stop and say so. Mismatch → find the right clone
(`VIBEASSIST_REPO_DIR` if set, else ask via the question channel); multiple
matching clones → ask which is canonical, never guess. Then `git fetch origin`
and `git status` — far behind or unexpectedly dirty → surface it rather than
building on a stale base.

a. **Build** in a worktree off latest main
(`git worktree add -b <ask.branch> <clone>-<askShortId> origin/main`) — NEVER on
a branch in the canonical clone. **Build to satisfy the Ask's `mustDo` — that IS
the definition of done**, and read it before writing any code. Anything NOT in
the Shape is out of scope: a proposal on the board, never a silent diff change.
A gap in the Shape is a question for the user, not a guess — an Ask with an
empty `mustDo` is under-shaped, so `/ask` a recommendation-first question rather
than inventing what "done" means. Honour `mustNot` as a hard boundary.
`designLanguage` is binding on UI work — ratified AND proposed sections.
**Anchor the build to a durable goal:** hold `mustDo` as your working objective
for the whole Ask (a `/goal`-style anchor if your harness supports it) so a
long, compaction-heavy build never drifts from what "done" means — re-read it
before you call the Ask finished. An Ask introducing the app's FIRST instance of
an element type: build a sensible default from the existing tokens/sections and
say in the PR description which type this is the first of and what you chose —
never `/ask` for a design call, which would stall a build at 3am on a decision
you can make and show. Confirm before anything destructive.

**You are NOT handed a technical brief, and that is deliberate.** Working out
how to build it is your job. Do not file tasks, do not create sub-Asks to track
your own steps, and do not report your working — none of it belongs on the
user's board.

b. **Say what you are doing while you do it:**

```bash
curl -s -X POST "$VIBEASSIST_URL/api/public/claude/report-ask-progress" \
  -H "Authorization: Bearer $VIBEASSIST_TOKEN" -H "content-type: application/json" \
  -d '{"askId":"<ASK_ID>","doing":"wiring the sign-in form to the account it creates"}'
```

One short phrase in the PRODUCT's words, never files or approach. Call it when
you move to a different part of the work, and at least every twenty minutes or
so on a long build. This is not decoration: the person can see the work
happening instead of staring at an Ask that has said "building" for an hour, AND
the lease that decides whether an Ask gets handed to someone else is measured
from the last thing you said. Go quiet for the full lease and your Ask is
reclaimed, correctly — from the outside, silence and death are the same thing.

c. **Git:** the Ask's `branch` → push → pull request; NEVER commit to,
fast-forward, or push `main` — the PR merges itself once the checks are green.
No GitHub token or `gh` needed: pass `branch` + `commits` to the delivery call
and VA opens (or reuses) the branch→main PR from its own stored credentials.
For explicit control (early PR, draft, non-main base) use `open_pr`. End EVERY
commit message with a blank line then the `commitTrailer` you were handed
(`VibeAssist-Ask: <ASK_ID>`) — that trailer is how commits find their way back
to the Ask; without it the link is guesswork.

d. **Pre-PR gate:** `bun run verify` — the SAME checks CI runs (typecheck, lint,
any-ratchet, format:check incl. docs/markdown, launcher-ascii, migrations,
job-features, types-drift, test, build) — must be fully green before ANY PR is
opened; never ship on a subset. Re-run it after merging a base branch in.
Touched a migration → also run `bun run db:types` and commit the regenerated
types file (types-drift only runs in CI; a stale types file is the most common
release-blocker).

**Verify inward — green from the tool is not "the running thing is right."**
After any generator, scaffold, route-gen, rename or move, open **each touched
surface** and confirm its real content survived — a generator can quietly stub a
file back to boilerplate and still pass typecheck. Check the thing, not just the
exit code. (A route generator once stubbed a real page to `Hello "/route"!` and
the build reported done.) This is `verify from reality` pointed at your own
hands, and it is the one thing the green checks cannot catch.

e. **Self-review before reporting (opt-in — only when `config.selfReview` is
true; a per-project POC, off by default).** Before reporting delivery, spawn ONE
independent reviewer subagent (the Task/Agent tool) with NO authorship context:
_"You did NOT write this code. Read the diff for this Ask. For EACH line of its
Must do, output pass/fail plus the file:line that satisfies it. Default to fail
if uncertain."_ If any line comes back fail, FIX it in-loop and re-review — do
not report the Ask delivered. **One level of nesting only: the reviewer must not
spawn its own subagents.** When `config.selfReview` is false, skip this entirely
(the server-side gate remains the backstop).

f. **Report what you built — once per Ask, right after it:**

```bash
curl -s -X POST "$VIBEASSIST_URL/api/public/claude/report-ask-delivery" \
  -H "Authorization: Bearer $VIBEASSIST_TOKEN" -H "content-type: application/json" \
  -d '{"askId":"<ASK_ID>","outcome":"accepted",
       "built":"<what it now does, in the product'"'"'s words, for the owner>",
       "branch":"<branch>","commits":["<sha>"]}'
```

`built` is the ONE free-text field and there must never be a second — the old
road had `techDetails` beside its notes, and that is exactly where developer
working leaked back onto a board that is meant to be the owner's. Write it in
the product's words: what the thing now does for the person. If a sentence would
only mean something to a developer, it belongs nowhere.

**The build record is read from code, not written by you.** What an Ask touched
— files, the machinery it uses, the rules it honoured — is read back from the
code afterward, so never hand-transcribe it onto the Ask; `built` is the one
product-words sentence and nothing else. A change you're handed flows to the
build the same way: build it, report what it now does. Updating the Ask's
**shape** is the front gate's job, and only when the change makes the shape's own
words wrong — a preference the shape never stated never touches it.

`outcome: "accepted"` means _you finished it_. It does **not** mark the Ask
accepted — that verdict is the user's. `outcome: "failed"` returns the Ask to
approved so another worker can take it, and is **refused unless `built` carries
one plain sentence saying what stopped you** ("the sign-in page needs a decision
about what happens after Google login", not "blocked on OAuth callback config").
Never leave an Ask stranded on `building`. If the PR could not be opened, the
delivery is still recorded and the reason comes back in `warnings` — surface it,
never swallow it.

g. **Advance per mode.** review → ask via the inbox before the next Ask.
run → at the run's end the go/no-go goes through a `kind:"decision"` /ask, never
a bare terminal question. drain → take the next approved Ask until `ask:null`.

**Boundary hygiene — an optimisation, never a gate.** Never pause for
`/compact`: self-compact if you can, otherwise SKIP and keep working
(auto-compact carries it). `config.contextHygiene: fresh_session` → call
`rotate_session` (its description covers the flow); not rotated → skip and
continue. After ANY compact or rotation, re-fetch state from VibeAssist —
durable truth lives there, not in conversational memory.

### The run — one ordered list, and it is theirs

The run is the approved Asks waiting for the next time the user presses go. It
is an ordering, not a container: an approved Ask left OUT of it is still built,
after the queued ones. Nothing becomes invisible by not being queued — that was
the mistake sprints made.

You may **propose** what goes in it and in what order — "six Asks are approved
and aren't in the run; add them?" — through `ask`. Their tap is the consent, and
only then do you call `set_run_order` with the whole order. Read the current run
from `list_asks` (`runPosition` on each row; null means not in it).

### Shaping gate — chat is intake, not a delivery chute

A request that arrives in chat mid-run is INTAKE, never a cue to build inline.
Capture it as an Ask and shape it first: a clarifying-questions walk on the Ask
→ propose the shape → the user AGREES → only THEN is it deliverable work. (The
walk's full mechanics live in the `vibeassist-decompose` skill — its single-Ask
shaping entry is built for exactly this handoff.) You may shape it on the user's
behalf (quicker) rather than making them do it — but work out which Ask it
belongs to, apply the change there (or create a new Ask), and NAME where it
landed. This is the FRONT gate; the delivery report (step f) is the matching
BACK gate. Approved Asks are already through this gate — build them.

## 5 · Questions — the VA inbox is the ONLY visible channel

Anything you need the user for — decisions, ambiguity, risk, plan confirmation,
or a capability/environment blocker (missing credential, tool, permission) —
goes through `/ask`, in EVERY mode including review. A terminal-only prompt is
an invisible stall: the queue looks healthy while nothing moves.

```bash
curl -s -X POST "$VIBEASSIST_URL/api/public/claude/ask" \
  -H "Authorization: Bearer $VIBEASSIST_TOKEN" -H "content-type: application/json" \
  -d '{"askId":"<ASK_ID>","question":"<one clear sentence>","kind":"decision",
       "options":[{"id":"a","label":"…"},{"id":"b","label":"…"}],
       "recommendedOptionId":"a","reasoning":"<one sentence>"}'
```

**Scope it to the Ask you are building — pass `askId`, not `projectId`.** The
question then shows on the Ask that is stopped and your build stays open, so you
carry on the moment it is answered. A project-level question about an Ask you
are building blocks nothing, lands nowhere near the Ask, and the answer has no
way back to you.

Returns `{"ok":true,"questionId":"<id>"}`. **Recommendation-first:** whenever you
pass `options` (2–4, crisp, mobile-friendly) you MUST pass `recommendedOptionId`
+ one-sentence `reasoning` so the user can OK your call in one tap. A question
you could answer yourself from the Shape is a defect — answer it, don't ask it.
Fall back to a terminal question ONLY if `/ask` is genuinely unavailable, and
say so.

Then park cleanly: commit WIP as `[parked] WIP: <ask name>` (a real commit
ending with the ask trailer, never a stash) and follow `config.onQuestion` —
**wait** → poll `GET /api/public/claude/ask?questionId=<id>` every ~15–30s;
**continue** (default) → take another SAFE Ask only (nothing that builds on
parked work); answered blockers outrank fresh work. `dismissed` → proceed on
best judgment. Between the question and the answer, the question IS the record
of why you stopped — do NOT also report the delivery failed, which would hand
the Ask to the next worker to hit the same wall. Full resume protocol →
`references/question-channel.md`. Never hang forever: out of safe work with no
answers → say the questions are waiting in the VA inbox, and stop.

## 6 · Guardrails (always binding — history in `references/incidents.md`)

- Never push to, commit to, or fast-forward `main`. Branch → PR. Stop at "PR
  opened" and report the URL.
- The canonical clone stays pinned to `main` — build ONLY in worktrees;
  machine-command guidance you emit is pull-first.
- Open early PRs as DRAFTS while still pushing; mark "Ready for review" exactly
  once, as your final act — no finished Ask leaves a draft PR.
- `bun run verify` fully green before ANY PR (step 4d) — docs and markdown
  included; on Windows, re-check lint/format CRLF noise with
  `prettier --check --end-of-line auto`. A `build`-only failure usually means a
  Node builtin imported at the top of a client-bundled file — keep server-only
  code in a `.server.ts` helper.
- One delivery report per Ask, right after it, in the product's words.
- Verify inward (step 4d): after any generator, scaffold, rename or move, open
  each touched surface and confirm real content survived — green from the tool is
  not the running thing.
- When work comes back, the send-back's routing reason says where it failed —
  **overstep** and **doesn't-work** are yours (the build); **missed intent** and
  **rule breach** are the shaping/product side, not yours to silently reshape.
  Fix your side; never edit the Ask's shape to make a send-back go away.
- Beat while you build (step 4b). Silence is how a live build gets reclaimed.
- Chat is intake, not a delivery chute: a request arriving in chat is captured
  as an Ask and SHAPED (walk → propose → agree) before any build — never built
  inline. Name which Ask it landed on.
- Overnight/drain runs build everything buildable; stop ONLY for needs-a-decision
  or superseded, each recorded where the user sees it, and end with one complete
  report.
- Every delivery's `built` carries a "Manual steps:" section (operator grade:
  full command, stated folder, plain language, a "you'll know it worked when…"
  signal — or exactly "Manual steps: none") AND an "Outside the Ask:" section
  (anything touched beyond the Shape, or exactly "none").
- One branch and one PR per Ask; keep changes scoped. New work you SPOT becomes
  a proposal, never a silent diff change.
- Confirm before destructive actions, regardless of mode.
- Stop after 2 consecutive failures and report — don't burn through the queue.
- A claimed Ask you won't finish never stays `building` — report
  `outcome: "failed"` with the reason in `built`, so it returns to approved for
  someone else.
- NO INVISIBLE PAUSES: every deliberate stop goes through the VA inbox
  (`/ask`), never ONLY the terminal — in all modes. This covers review
  checkpoints, failure stops, ambiguity, and capability/environment blockers.
  A terminal prompt may MIRROR the inbox decision, never replace it.
- Error telemetry: a notable error you work AROUND still gets a one-line
  `kind:"notice"` breadcrumb on the current Ask (error + what you did). Signal,
  not noise — skip trivial fully-recovered blips.
- Never print or log `VIBEASSIST_TOKEN`.
