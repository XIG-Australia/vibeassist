# Setup — first run / MISSING verdict

**Load this when:** `va-check.sh` prints `MISSING`, the user asks how to connect
Claude Code to VibeAssist, or the user complains about repeated permission
prompts stalling runs.

## Where the config lives

Put both values in **Claude Code's user settings file** — the full path is
`C:\Users\<you>\.claude\settings.json` on Windows or `~/.claude/settings.json`
on Mac/Linux. Be precise with the user about WHICH file this is: it is
**Claude Code's own config** (not a VibeAssist file, not VS Code's
settings.json, and not a project's `.claude/settings.json`) — the generic name
collides with several others and editing the wrong one is the most common setup
failure. The `env` block injects the values into **every** Bash call — always
present, no shell tricks, and it sidesteps the OS-environment timing problem
(env vars set in a terminal or via `setx` are often invisible to an
already-running session; a value in this file is not). Works the same in the
desktop app and the CLI. Restart the session once after editing.

**Prefer the server-composed baseline.** `GET /api/public/claude/preferences`
returns `recommendedBaseline` — the complete, prompt-minimal-but-safe worker
profile, always current (see `references/kickoff-sync.md`). The static block
below is the same shape for offline reference:

```json
{
  "env": {
    "VIBEASSIST_URL": "https://vibeassist.app",
    "VIBEASSIST_TOKEN": "<paste the token from VibeAssist → Claude connection → Generate>"
  },
  "permissions": {
    "defaultMode": "acceptEdits",
    "additionalDirectories": [
      "<the folder that CONTAINS your clones / sprint worktrees, e.g. C:/dev>"
    ],
    "allow": [
      "Bash(curl:*)",
      "Bash(git:*)",
      "Bash(bun run typecheck)",
      "Bash(bun run lint)",
      "Bash(bun run test)",
      "Bash(bun run format:check)",
      "Bash(npx tsc --noEmit)",
      "Bash(npx tsc --noEmit *)",
      "Bash(node_modules/.bin/tsc --noEmit)",
      "Bash(node_modules/.bin/tsc --noEmit *)",
      "Bash(npx vitest run)",
      "Bash(npx vitest run *)",
      "Bash(bunx prettier --check *)",
      "Bash(npx prettier --check *)",
      "Bash(bash ~/.claude/va-check.sh)",
      "Bash(bash ~/.claude/va-preflight.sh)",
      "Bash(bash ~/.claude/va-standby.sh)",
      "mcp__vibeassist__*",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(grep:*)",
      "Bash(sed:*)",
      "Bash(find:*)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force*)",
      "Bash(git reset --hard *)",
      "Read(.env*)",
      "Edit(.env*)"
    ]
  },
  "sandbox": {
    "network": { "allowedDomains": ["<your VibeAssist host>", "*.<your VibeAssist host>"] }
  }
}
```

## Why this exact shape avoids repeated permission prompts

- The `env` block means the API calls are plain `curl` commands (no `$(...)`
  substitution). Claude Code will not auto-approve a command containing command
  substitution — so keeping the token in `env` (not read inline from a file) is
  what lets the `Bash(curl:*)` allow rule actually match and stop the prompts.
- Every sub-command in a compound line must be covered by an allow rule for the
  whole line to auto-approve — keep VibeAssist commands to a single tool per
  line, and rely on the `allow` list above.
- The build/test/format rules are the VETTED set, seeded from a usage scan of
  real worker sessions: read-only checks only. Broad interpreter grants
  (`Bash(npm:*)`, `Bash(node:*)`, `Bash(bun:*)`) are deliberately absent — they
  cover arbitrary code execution and mutating commands (`prettier --write`,
  `bun run build`), which should keep prompting. `git:*` and `curl:*` stay
  because the loop can't work without them (`deny` blocks the force-ops; the
  sandbox pins curl to the VibeAssist host). Git READ subcommands
  (status/log/diff) are auto-allowed by Claude Code and need no rule. Users can
  also manage these grants as categories in VA → Claude connection →
  **Command approvals**.
- `defaultMode: "acceptEdits"` auto-approves file edits, but ONLY inside the
  session's working directory + `additionalDirectories`. A worker builds in a
  per-sprint **worktree** whose path isn't the launch cwd, so without
  `additionalDirectories` every file create/edit there prompts. Point it at the
  folder that CONTAINS the clones/worktrees (e.g. `C:/dev`) so edits in any
  worktree auto-approve — the `deny` list still blocks `.env`, and Bash stays
  gated by the `allow`/`deny` rules, not by edit scope. NB the VA **Command
  approvals** toggles grant allow-RULES only; they do NOT set `defaultMode` or
  `additionalDirectories`, so a toggle-only setup still prompts on edits until
  this block is applied.

## Keep commands auto-approvable (Claude Code's hard gates)

Some prompts cannot be removed by ANY allow rule — Claude Code hard-gates them
and asks every time:

- **Compound `cd … && …` with output redirection** ("path resolution bypass").
- **Shell expansion inside a file path** (a `$VAR` used as/in a path argument).
- **Command substitution `$(...)`** — never auto-approved.

The fix is not a bigger allow-list; it's writing commands that don't trip the
gates:

- **Prefer the native tools over shelling out.** Use **Read / Grep / Glob** to
  read files, search content and list paths — they have no Bash approval gate,
  so they never prompt. Reach for `bash find/grep/cat/ls` only when a native
  tool genuinely can't do the job.
- **One tool per Bash line; don't wrap it in `cd … && … >`.** Point the command
  at an absolute path, or `cd` on its own line.
- **No `$VAR` in a path argument** — use the literal path. (A
  `$VIBEASSIST_TOKEN` in a curl _header_ is fine; expansion inside a _path_ is
  what's gated.)
- **Never `$(...)`.**

## URL gotchas (both fail half-silently)

- **No trailing slash** on `VIBEASSIST_URL` — `https://vibeassist.app/`
  produces `//api/...` paths and 308 redirects.
- **Production URL, not a preview** — a `*.workers.dev` preview address may
  lack the latest routes and won't see the user's real queue.

## Do NOT recommend bypassPermissions

Never suggest full `bypassPermissions` / `--dangerously-skip-permissions`. The
`acceptEdits` + vetted-allow + deny profile above is the safe default and all a
sprint run needs. Full bypass lets the worker run ANY command unsupervised (a
real security footgun for non-technical users) AND doesn't fix the stalls that
actually bite — those come from context compaction, an interactive prompt, or a
model usage limit, not permission prompts. The "won't stall overnight" property
comes from this safe profile PLUS surfacing every real pause to the VA inbox
and auto-skipping compaction — never from removing guardrails. If a user says
they run "accept-all" to stop stalls, steer them back to this profile.

If a call to `$VIBEASSIST_URL` is still blocked (sandbox / "external write"),
the `sandbox.network.allowedDomains` entry is what allows it in unattended
runs. In interactive `review` sessions the user can instead approve the prompt
once.

## One token, one place

The bearer token lives in EXACTLY one file: `~/.claude/settings.json` →
`env.VIBEASSIST_TOKEN`. The MCP/OAuth connection manages its own credential
automatically (`~/.claude/.credentials.json`) — never hand-edit that. An old
build used a second file, `~/.claude/vibeassist.json`; nothing reads it
anymore — if you see it, tell the user they can delete it. Regenerating in VA
revokes prior **paste-key** tokens (the one-click OAuth credential is separate,
unaffected), so the flow is always: regenerate once in VA → paste into the
`settings.json` line → restart the session.
