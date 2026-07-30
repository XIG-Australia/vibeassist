# VibeAssist plugin for Claude Code

Drive your VibeAssist backlog from inside Claude Code. Queue a sprint in
VibeAssist, then run `/vibeassist` — Claude pulls the sprint, sequences the
tasks by dependency, does the work, and reports completion back so each task
updates itself (status + notes/tech-details in the activity log).

See the full design in [`docs/claude-code-integration.md`](../docs/claude-code-integration.md).

## Prerequisites

- A VibeAssist account with at least one **sprint queued for Claude** (use the
  "Send to Claude" action in VibeAssist).
- A **Claude Code access token**: VibeAssist → Settings → Claude Code access →
  Generate. Copy it once (only its hash is stored server-side).

## Install

**Install from the VibeAssist app (recommended) — one command.** VibeAssist
serves this plugin as a zip, so you don't need Git at all. From the Claude
Connection dialog, copy the command:

```bash
claude --plugin-url https://vibeassist.app/claude/vibeassist-plugin.zip
```

Loads it for the session. To keep it every session, unzip that file into
`~/.claude/skills/vibeassist/`. (Needs a recent Claude Code — ~v2.1.128+.)

> The served zip is `public/claude/vibeassist-plugin.zip`, built from this
> directory. **Regenerate it whenever you change the plugin:**
> `npm run build:plugin-zip` (dependency-free `scripts/build-plugin-zip.cjs`).

**Try it locally from source — for development.** From the VibeAssist repo root:

```bash
claude --plugin-dir ./claude-plugin
```

`SKILL.md` edits are picked up live.

**Install from the marketplace — for everyone else.** The repo doubles as a
plugin marketplace (`.claude-plugin/marketplace.json` at the root points at this
`claude-plugin/` directory). In Claude Code:

```bash
/plugin marketplace add xigcomau/vibeassist-app
/plugin install vibeassist@vibeassist
```

> The repo must be reachable by the user. For **public** distribution to
> VibeAssist customers, host the plugin (this `claude-plugin/` dir + a
> `marketplace.json`) in a **public** repo rather than the private app repo.

## Configure

Set two environment variables (e.g. in your shell profile):

```bash
export VIBEASSIST_URL="https://vibeassist.app"     # no trailing slash
export VIBEASSIST_TOKEN="vak_..."                   # from VibeAssist settings
```

The token is sent as `Authorization: Bearer <token>`; it is never printed or
committed.

### Running unattended (auto mode)

In `review` mode Claude asks before each action — just approve it. For
`sprint`/`drain` or any headless/auto-accept run there's no one to approve:
Claude Code's sandbox blocks the outbound calls to VibeAssist, and it prompts for
every file edit and command. Pre-authorise the routine stuff **once** in
`~/.claude/settings.json` (user scope — applies to every project):

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(bun *)",
      "Bash(curl *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(grep *)",
      "Bash(find *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force*)",
      "Bash(git reset --hard *)",
      "Read(.env*)",
      "Edit(.env*)"
    ]
  },
  "sandbox": { "network": { "allowedDomains": ["vibeassist.app", "*.vibeassist.app"] } }
}
```

- `acceptEdits` auto-approves file edits (protected paths like `.git`/`.claude`
  are never auto-approved).
- `allow` covers git, npm/node/bun, curl (the sandbox pins it to your host), and
  read-only shell.
- `deny` keeps the dangerous things prompting — `rm -rf`, force-push,
  `git reset --hard`, `.env` access.

Merge these into any existing settings. (Plugins can't grant permissions on
install, so this step is unavoidably manual — but it's a one-time paste.)

## Use

```
/vibeassist            # review mode (default): one task at a time, confirm between
/vibeassist sprint     # drain the current sprint, pause at the sprint boundary
/vibeassist drain      # keep going across sprints until nothing is queued
```

## What it talks to

Three endpoints on your VibeAssist backend (all `Authorization: Bearer` auth):

| Call                                                 | Endpoint                             |
| ---------------------------------------------------- | ------------------------------------ |
| pull the queued sprint + tasks + context briefs      | `GET /api/public/claude/next-sprint` |
| lock a task as work starts                           | `POST /api/public/claude/start`      |
| report completion (notes, tech-details, commits, PR) | `POST /api/public/claude/complete`   |

## Safety

- One branch/PR per task by default; confirms before destructive actions.
- Stops after repeated failures rather than churning through a sprint.
- Only ever sees the tasks you queued; the token scopes everything to your account.
