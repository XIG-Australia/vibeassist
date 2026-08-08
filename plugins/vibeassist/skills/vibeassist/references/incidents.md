# Incident archive — why the rules exist

**Load this when:** a core rule needs justifying or seems worth re-litigating,
or you're explaining to the user why the skill behaves the way it does. Never
needed on the happy path. Each entry: what happened → the rule it produced →
where that rule now lives.

## 2026-07-08 — standby busy-loop (wrong script variant)

A standby responder ran the worker variant of the long-poll (with
`&sprints=1`), so the server woke it for queued sprints it could never
consume, degrading the long-poll into a busy loop. → Rule: the standby variant
must NOT send `&sprints=1`; a standby that wakes with only work counts set is
running the wrong variant and self-heals by rewriting the script.
(`references/listening-roles.md`.)

## 2026-07-09 — the 70-minute invisible pause + the `gh` 127 gap

A worker "paused per review mode" with a question printed only in its
terminal; VA showed a healthy queue while nothing moved for 70 minutes. The
same day established the preflight gap: a worker died mid-task on
`gh: command not found` (exit 127) with the truth visible only in the
terminal. → Rules: NO INVISIBLE PAUSES (every deliberate stop goes through
`/ask`); a claimed Ask is built through to its report, not paused mid-way; run the tool
preflight at kickoff and surface missing tools as a `kind:notice`. (Core
Guardrails + Kickoff.)

## 2026-07-11 — the db:push outage (canonical clone off `main`)

The canonical clone had been flipped onto a sprint branch, so a `db:push` ran
from a checkout holding NONE of the day's migration files — it reported
"nothing to push" while prod was missing schema. → Rule: the canonical clone is
pinned to `main` at all times; build ONLY in worktrees
(`git worktree add -b <ask.branch> <clone>-<askShortId> origin/main`); machine
command guidance is pull-first. (Core Guardrails.)

## 2026-07-14 — the stale-env trap (valid token misread as revoked)

Claude Code freezes env at session start, so a long-running session (or the
wake daemon and every worker it spawned) kept an old token after a regenerate
and read REVOKED for a perfectly valid current token — hours lost regenerating
a token that was never broken. → Rule: the checker validates the token in
`~/.claude/settings.json` (the file, not the frozen env) and prints `STALE` →
RESTART, never regenerate. (`scripts/va-check.sh` + the core verdict table.)

## 2026-07-16 — the false REVOKED (task a159bc99) + the stale-checker lesson

The pre-fix checker did `CHECK_TOKEN="${FILE_TOKEN:-$VIBEASSIST_TOKEN}"`: when
it could not read settings.json it silently fell back to the frozen env token,
and that old token's 401 was announced as REVOKED — "I could not read your
token" and "your token is rejected" must never share a verdict. The same day
proved a second point: the fix had landed on 2026-07-14, but the machine kept
its pre-fix copy because the old instruction only wrote the file when MISSING —
a stale checker is worse than no checker; it lies with authority. → Rules:
`CHECK_FAILED:<why>` is a distinct not-a-token-verdict; the script self-reports
`va-check-version` on every run; overwrite the on-disk copy whenever it is
missing, unversioned, or below the current version. (`scripts/va-check.sh` +
core §1; contract pinned by `src/lib/va-check-script.test.ts`.)

## 2026-07-18 — the early exit with 6 sprints queued (task f6c3618b)

A listening worker delivered one packet, drained its ai_jobs, then cleanly
exited with 6 sprints still queued — two confirmed cycles. → Rule: DRAIN MEANS
DRAIN — `ask: null` from `next_approved_ask` is the only "queue empty" signal
(it was `sprint:null` when this happened); the worker role
overrides `config.mode` boundary pauses; every exit notice states its reason.
(`references/listening-roles.md`.)

## The pseudo-XML completion notes

A completion stored a dangling `</invoke>` (a fragment of the tool-call
envelope) mid-sentence in its notes; the non-technical owner reading them to
approve the work reasonably concluded something was broken. The server now
strips known scaffolding and warns, but only recognises tags it knows. → Rule:
`notes` and `techDetails` are separate plain markdown strings — never compose
one tagged blob. (Core loop, complete step.)

## Task-ID index for the guardrails

- 75a89899 — repo-safety preflight replaces the weak `git branch` glance.
- 8f0ab37f / 3e849762 — draft PRs while pushing / no finished Ask left as a
  draft (draft PRs skip preview deploys; a draft can't merge).
- 1bcede1e / 99867b7b — "Manual steps" section mandatory, operator-grade
  (stated folder, plain language, success signal).
- db8e0f93 — "Outside the ask" declaration on every done completion, rendered
  next to the reviewer's independent scope check.
- 6529e2ac — defer discipline: release a claimed task you won't finish back to
  `backlog`; revert partial commits.
- 54d1faea — worker error telemetry: notable worked-around errors get a
  `kind:notice` breadcrumb + a "Notable errors" line in techDetails.
- 0dfa1705 / 328bcd9e — version single-sourcing from plugin.json (the marker,
  CURRENT_SKILL_VERSION, and the packaged zip move together).
