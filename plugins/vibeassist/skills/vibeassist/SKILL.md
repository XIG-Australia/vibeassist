---
name: vibeassist
description: Pull the next queued sprint from VibeAssist, work through its tasks (sequencing them by dependency), and report completion back so tasks update themselves. Use when the user runs /vibeassist, or says "work my VibeAssist sprint", "pull my VibeAssist tasks", "drain my VibeAssist backlog", or similar. Modes — "review" (default: one task at a time, confirm before next), "sprint" (drain the sprint, pause at the boundary), "drain" (keep going across sprints). Listening roles (smart kickoff, run once per working session): "worker" (drain queued sprints, then keep listening — new sprints start automatically when the user presses Start in VA), "standby" (long-poll responder: watch for updates and act/surface them).
---

<!-- vibeassist-skill-version: 0.7.0 (single-sourced from plugins/vibeassist/.claude-plugin/plugin.json — keep them in step) -->

# VibeAssist task runner

You pull work a user approved in VibeAssist, do it, and report results back.
The user drives WHICH work; you drive HOW.

> ## Delivery runs on asks now — check this FIRST
>
> If `next_approved_ask` is among your tools, that is the delivery loop: take
> the next **approved ask**, build it, report what it now does. Load
> `references/delivery-on-asks.md` and follow that instead of the sprint loop
> below.
>
> The sprint/task loop in this file is the OLD road. It still works, and sprints
> already queued on it are still worked to completion — but nothing new is
> dispatched that way. Sprints, batches, packets and the `VibeAssist-Task`
> trailer do not come across: an ask already contains asks, so the tree is the
> grouping and there is nothing to compose. Decided by Simon, 3 Aug 2026
> (`docs/rebuild/24-delivery-runs-on-asks.md` in the app repo).
>
> § 5 (the question channel) and § 6 (guardrails) bind on BOTH roads, unchanged.

This core is the whole cold happy path. Detail loads on demand from
`references/` in this skill's directory — each pointer below says when. Helper
scripts ship in `scripts/` — install them by COPYING the packaged file, never by
transcribing.

## 1 · Connect & verify (every run, first)

**MCP-first.** If the `mcp__vibeassist__*` tools are present (one-click OAuth
connect), use them for the whole loop — they authenticate automatically and
mirror the REST endpoints 1:1 (`next_sprint`, `start_task`, `complete_task`,
`ask`/`get_answer`, `get_updates`, `open_pr`), and each tool's description
carries its own playbook. No env vars or token check needed on this path.

**Curl fallback (paste-a-key).** Needs two env vars visible to Bash:
`VIBEASSIST_URL` (default `https://vibeassist.app`, no trailing slash) and
`VIBEASSIST_TOKEN`. Verify with the allow-listed checker script — never an
inline compound (it prompts every session):

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
   first task you claim. `bun` MISSING → use the npm/npx equivalents. `git` or
   `node` MISSING → genuinely blocking: raise an `ask` (`kind:decision`).
2. **Repo-safety preflight** (before touching any clone):
   `node scripts/preflight.cjs` in the project repo. Verdict SAFE → proceed.
   NOT SAFE (you're on `main`, or another worker holds this checkout) → stop;
   switch to a branch/worktree or yield.
3. **Preferences sync:** fetch once —
   `curl -s -H "Authorization: Bearer $VIBEASSIST_TOKEN" "$VIBEASSIST_URL/api/public/claude/preferences"`.
   - **Skill freshness:** if the response's `currentSkillVersion` is newer than
     this file's version marker, tell the user in ONE line to update the plugin
     and post a `kind:notice` on the first task you claim; otherwise say nothing.
   - Missing allow-rules, an unconfigured worker profile, or a role-model
     mismatch → load `references/kickoff-sync.md` and follow it. Applying ANY
     settings change is offer-first in EVERY mode — the sprint consent envelope
     never covers the user's settings file.
4. **Listening roles:** invoked as `worker` or `standby` → load
   `references/listening-roles.md` BEFORE arming the listening loop.

## 3 · Mode

The `next-sprint` response carries a `config` block
(`{ mode, onFailure, onQuestion, contextHygiene }`) set per-project — use
`config.mode` as the default and apply `config.onFailure` on failures, unless
the user gave an explicit mode at invocation (that overrides). No config yet →
default **review**.

- **review** — ONE task, then ask (via the question channel) before the next.
- **sprint** — the whole sprint; at the boundary, ask via a `kind:"decision"` /ask.
- **drain** — keep pulling sprints until nothing is queued.
- **worker** / **standby** — listening roles: `references/listening-roles.md`.

### Overnight drain — the build-overnight doctrine

The VibeAssist rhythm is **plan during the day, build overnight, review in the
morning** — the worker owns the overnight half, and the promise is to clear as
much as possible and ENSURE it happens.

- **Build everything buildable.** In drain (and any overnight run) the default
  is to finish every task the sprint can support — never defer buildable work
  for tidiness.
- **Skip for exactly two reasons,** each logged with its why (a `kind:"notice"`
  breadcrumb on the task AND a line in the completion report): (a) it needs more
  information — raise the `/ask`; or (b) it is clearly superseded. Anything else
  gets built.
- **End every run with ONE complete report:** what was built, what wasn't, and
  why for each skip. A run that leaves the owner guessing has failed its promise.
- **Batch delivery to protect the Actions budget:** collect the run onto as few
  branches as possible → ideally ONE push → one PR → one CI run. This is the
  overnight extension of the per-task/per-sprint PR rule (Section 6) — batch
  across the run wherever coupling allows, still keeping each change scoped.
- **The queueing gate is the user's.** Normally the user decides what enters a
  sprint. A force-drain — clearing the backlog on the user's say-so — currently
  OVERRIDES the standing "stabilization" working agreement that features wait in
  the pool. That override is temporary: the delivery mechanism is still
  settling, so never hard-code the force-drain as the final shape — the
  reconciliation with stabilization is pending until it does.

## 4 · The loop

**Pull:**

```bash
curl -s -H "Authorization: Bearer $VIBEASSIST_TOKEN" "$VIBEASSIST_URL/api/public/claude/next-sprint"
```

`{"ok":true,"sprint":null}` → nothing queued: say so and stop (or offer to wait,
in drain). 401 → token problem (re-run the checker). Otherwise you get `sprint`
(id, title, projectId, repo.fullName, tasks[]) plus `nextSprint`, `config`, and
`designLanguage`. Each task has `id`, `position`, `title`, `description`,
`priorityLevel`, `assistantState` (formerly `claudeState`, still sent as an
alias for one release), and `contextBrief` (markdown + constraints,
patternsToReuse, outOfScope, wiringReminders, relatedTaskIds).

**Right repo, before touching any file:** `git remote get-url origin` must match
`sprint.repo.fullName` — never assume the current directory is correct (stale
clones in OneDrive/Documents are a known trap). Mismatch → find the right clone
(`VIBEASSIST_REPO_DIR` if set, else ask via the question channel); multiple
matching clones → ask which is canonical, never guess. Then `git fetch origin`
and `git status` — far behind or unexpectedly dirty → surface it rather than
building on a stale base.

**Sequence by dependency — `position` is a hint, not the truth.** Order the
tasks so producers (types, enums, migrations, shared components, utilities)
come before consumers. Present the order as a short numbered list; in review
mode confirm it via a `decision` ask on the first task, in sprint/drain proceed
but state it.

**Ready-check (before writing any code):** read EVERY task in the sprint and
raise all foreseeable questions as ONE batch of recommendation-first asks up
front. Dedupe against already-answered questions first (`get_updates` →
`answeredQuestions`). Zero foreseeable questions → start building immediately;
express-lane sprints skip ready-check.

Per task, in your chosen order:

a. **Claim it** (locks it so nothing else grabs it):

```bash
curl -s -X POST "$VIBEASSIST_URL/api/public/claude/start" \
  -H "Authorization: Bearer $VIBEASSIST_TOKEN" -H "content-type: application/json" \
  -d '{"taskId":"<TASK_ID>"}'
```

`{"ok":true,...}` → you own it. HTTP 409 → someone else took it; skip to the
next task.

b. **Build** in a per-sprint worktree off latest main
(`git worktree add -b <branch> <clone>-<sprintShortId> origin/main`) — NEVER on
a branch in the canonical clone. **Build to satisfy the task's
`acceptanceCriteria` — that checklist IS the definition of "done".** Read it
before writing any code; every criterion must be met, and anything NOT in the
criteria is out-of-scope (a tray proposal via a draft task, never a silent diff
change). A task with empty `acceptanceCriteria` on the standard lane is
under-shaped — `/ask` a recommendation-first question rather than guessing what
"done" means. If `priorLearnings` is present, it names mistakes an earlier build
made on this footprint — do not repeat them. Honour the `contextBrief`
(constraints, patterns, out-of-scope, wiring reminders). `designLanguage` is
binding on UI work — ratified AND proposed sections. **Anchor the build to a
durable goal:** at the start of each task, hold its `acceptanceCriteria` as your
working objective for the whole task (a `/goal`-style anchor if your harness
supports it) so a long, compaction-heavy build never drifts from what "done"
means — re-read the criteria before you call the task finished. A task
introducing the app's FIRST
instance of an element type: build a sensible default from the existing
tokens/sections and say in the PR description which type this is the first of
and what you chose — never `/ask` for a design call, which would stall a build
at 3am on a decision you can make and show. Confirm before anything
destructive.

c. **Git:** branch → push → pull request; NEVER commit to, fast-forward, or push
`main` — a human merges the PR (for Lovable-managed projects the merge is also
what syncs the platform). No GitHub token or `gh` needed: pass `branch` +
`commits` to `/complete` and VA opens (or reuses) the branch→main PR from its
own stored credentials, returning `prUrl` (failures come back in `warnings` —
surface them). For explicit control (early PR, draft, non-main base) use
`open_pr` — see its tool description. End EVERY commit message with a blank
line then `VibeAssist-Task: <TASK_ID>`.

d. **Pre-PR gate:** `bun run verify` — the SAME checks CI runs (typecheck, lint,
any-ratchet, format:check incl. docs/markdown, launcher-ascii, migrations,
types-drift, test, build) — must be fully green before ANY PR is opened; never
ship on a subset. Re-run it after merging a base branch in. Touched a
migration → also run `bun run db:types` and commit the regenerated types file
(types-drift only runs in CI; a stale types file is the most common
release-blocker).

d2. **Self-review before reporting (opt-in — only when `config.selfReview` is
true; a per-project POC, off by default).** Before `complete_task`, spawn ONE
independent reviewer subagent (the Task/Agent tool) with NO authorship context:
_"You did NOT write this code. Read the diff for this task. For EACH acceptance
criterion output pass/fail plus the file:line that satisfies it. Default to fail
if uncertain."_ If any criterion comes back fail, FIX it in-loop and re-review —
do not report the task done. **One level of nesting only: the reviewer must not
spawn its own subagents.** This catches a criterion miss here, in-loop, instead
of at the post-merge verification gate. When `config.selfReview` is false, skip
this step entirely (the server-side gate remains the backstop).

e. **Report completion — once per task, right after THAT task, never batched:**

```bash
curl -s -X POST "$VIBEASSIST_URL/api/public/claude/complete" \
  -H "Authorization: Bearer $VIBEASSIST_TOKEN" -H "content-type: application/json" \
  -d '{"taskId":"<TASK_ID>","status":"done",
       "notes":"<what THIS task did, plain English, for the task owner>",
       "techDetails":"<files touched, approach, decisions, follow-ups>",
       "commits":["<sha>"],"branch":"<branch>","prUrl":"<only if you opened it yourself>"}'
```

`notes` and `techDetails` are SEPARATE plain-markdown fields — never compose one
tagged blob (see `references/incidents.md`). Always send meaningful content in
both; an empty report leaves the owner nothing to approve. **Map every
acceptance criterion to its evidence** in the report: for each criterion, the
named test CI ran that proves it (preferred) or a one-line prose note of where
it's satisfied — a criterion with no evidence is an incomplete task, not a done
one. If the task genuinely
could not be completed, send `"status":"failed"` with honest notes — never
fabricate success.

f. **Advance per mode.** review → ask via the inbox before the next task.
sprint → at the sprint's end the go/no-go for `nextSprint` goes through a
`kind:"decision"` /ask, never a bare terminal question (VA also posts this
decision server-side — after the final `/complete`, check `get_updates` →
`answeredQuestions` and act on it). drain → pull the next sprint until
`sprint:null`.

**Boundary hygiene — an optimisation, never a gate.** Never pause for
`/compact`: self-compact if you can, otherwise SKIP and keep working
(auto-compact carries it). `config.contextHygiene: fresh_session` → call
`rotate_session` (its description covers the flow); not rotated → skip and
continue. After ANY compact or rotation, re-fetch state via `next-sprint` —
durable truth lives in VibeAssist, not conversational memory.

### Shaping gate — chat is intake, not a delivery chute

A request that arrives in chat mid-run is INTAKE, never a cue to build inline.
Capture it as an ask and shape it first: a clarifying-questions walk on the ask
→ propose the shape → the user AGREES → only THEN is it deliverable work. (The
walk's full mechanics live in the `vibeassist-decompose` skill — its single-ask
shaping entry is built for exactly this handoff.) You
may shape it on the user's behalf (quicker) rather than making them do it — but
work out which ask it belongs to, apply the change there (or create a new ask),
and NAME where it landed. This is the FRONT gate; the completion report +
deliverable review (Section 4e) is the matching BACK gate. Sprints pulled from
the queue are already through this gate — build them.

## 5 · Questions — the VA inbox is the ONLY visible channel

Anything you need the user for — decisions, ambiguity, risk, plan confirmation,
or a capability/environment blocker (missing credential, tool, permission) —
goes through `/ask`, in EVERY mode including review. A terminal-only prompt is
an invisible stall: the queue looks healthy while nothing moves.

```bash
curl -s -X POST "$VIBEASSIST_URL/api/public/claude/ask" \
  -H "Authorization: Bearer $VIBEASSIST_TOKEN" -H "content-type: application/json" \
  -d '{"taskId":"<TASK_ID>","question":"<one clear sentence>","kind":"decision",
       "options":[{"id":"a","label":"…"},{"id":"b","label":"…"}],
       "recommendedOptionId":"a","reasoning":"<one sentence>"}'
```

Returns `{"ok":true,"questionId":"<id>"}`; the task is now `blocked`.
**Recommendation-first:** whenever you pass `options` (2–4, crisp,
mobile-friendly) you MUST pass `recommendedOptionId` + one-sentence `reasoning`
so the user can OK your call in one tap. A question you could answer yourself
from the brief is a defect — answer it, don't ask it. For a blocker, carry the
blocker's real options. Fall back to a terminal question ONLY if `/ask` is
genuinely unavailable, and say so.

Then park cleanly: commit WIP as `[parked] WIP: <task title>` (a real commit
ending with the task trailer, never a stash) and follow `config.onQuestion` —
**wait** → poll `GET /api/public/claude/ask?questionId=<id>` every ~15–30s;
**continue** (default) → next SAFE task only (nothing that builds on parked
work); answered blockers outrank fresh work. `dismissed` → proceed on best
judgment, note it in `techDetails`. Sprint ending with unanswered questions, or
the full resume protocol → load `references/question-channel.md`. Never hang
forever: out of safe work with no answers → say the questions are waiting in
the VA inbox, and stop.

## 6 · Guardrails (always binding — history in `references/incidents.md`)

- Never push to, commit to, or fast-forward `main`. Branch → PR → a human
  merges. Stop at "PR opened" and report the URL.
- The canonical clone stays pinned to `main` — build ONLY in per-sprint
  worktrees; machine-command guidance you emit is pull-first.
- Open early sprint PRs as DRAFTS while still pushing; mark "Ready for review"
  exactly once, as your final act — no finished sprint leaves a draft PR.
- `bun run verify` fully green before ANY PR (step 4d) — docs and markdown
  included; on Windows, re-check lint/format CRLF noise with
  `prettier --check --end-of-line auto`. A `build`-only failure usually means a
  Node builtin imported at the top of a client-bundled file — keep server-only
  code in a `.server.ts` helper.
- One `/complete` per task, right after it, with that task's own notes.
- Chat is intake, not a delivery chute: a request arriving in chat is captured
  as an ask and SHAPED (walk → propose → agree) before any build — never built
  inline. Name which ask it landed on.
- Overnight/drain runs build everything buildable; skip ONLY for needs-info or
  superseded, each logged with its why, and end with one complete report.
- Every done completion's `notes` carry a "Manual steps:" section (operator
  grade: full command, stated folder, plain language, a "you'll know it worked
  when…" signal — or exactly "Manual steps: none") AND an "Outside the ask:"
  section (anything touched beyond the stated scope, or exactly "none").
- One branch/PR per task by default (or one PR per tightly-coupled sprint);
  keep changes scoped. New work you SPOT becomes a proposal, never a silent
  diff change.
- Confirm before destructive actions, regardless of mode.
- Stop after 2 consecutive failures and report — don't burn through a sprint.
- Defer discipline: a claimed task you won't finish never stays `in_progress` —
  release it to `backlog` with a one-line why and revert partial commits.
- A started sprint overrides review-mode's per-task pause — review governs how
  you PULL work, not silent mid-sprint stops.
- NO INVISIBLE PAUSES: every deliberate stop goes through the VA inbox
  (`/ask`), never ONLY the terminal — in all modes. This covers review
  checkpoints, failure stops, ambiguity, and capability/environment blockers.
  A terminal prompt may MIRROR the inbox decision, never replace it.
- Error telemetry: a notable error you work AROUND still gets a one-line
  `kind:"notice"` breadcrumb on the current task (error + what you did), plus a
  "Notable errors" line in `techDetails` ("none" when clean). Signal, not
  noise — skip trivial fully-recovered blips.
- Never print or log `VIBEASSIST_TOKEN`.
