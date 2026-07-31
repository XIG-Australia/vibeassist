# VibeAssist plugin for Claude Code

Keep control of what you're building.

AI coding tools build fast and lose the plot. You end up unable to say what was
actually built, whether it matches what you asked for, or what broke on the way.
These skills are for the person who owns the product, not the person writing the
code.

> **Keep the table below in step with `skills/`.** `plugin-readme.test.ts`
> asserts every skill directory is named here, so adding or renaming one without
> touching this file fails the tests rather than drifting quietly. It has
> drifted before.

## Install

```
/plugin marketplace add XIG-Australia/vibeassist
/plugin install vibeassist@vibeassist
```

Both are typed at **Claude Code's own prompt** — they are Claude commands, not
terminal commands. Updates then arrive on their own;
`/plugin marketplace update` forces one immediately.

For development, load it straight from a checkout instead:

```bash
claude --plugin-dir ./claude-plugin
```

`SKILL.md` edits are picked up live.

## The skills

| Skill | What it does | Say |
| --- | --- | --- |
| **vibeassist** | Pulls your queued sprints, works the tasks in dependency order, and reports each one back so the board updates itself. | _"work my VibeAssist sprint"_ |
| **vibeassist-decompose** | Turns an idea — or an existing codebase — into a tree of asks through a Q&A walk. Also shapes a single ask on its own. | _"break this down into asks"_, _"shape the export ask"_ |
| **vibeassist-map** | Maps a codebase the way its **users** meet it: every page, what you can do on each, and which tables each action reads or writes — with a `file:line` citation behind every claim, checked before it finishes. | _"map this codebase"_ |
| **vibeassist-review** | The morning review. Walks what got built overnight and judges each delivery against what was actually asked for. | _"review what got built"_ |

## The mapper works on its own

`vibeassist-map` needs no account and no connection. Point it at a repository
and it produces a map a non-technical person can read. It handles file-based
routers (TanStack Start, Expo Router, Next-style trees), react-router, and apps
with no router at all; and it detects the data layer rather than assuming one.

It refuses to guess. Routes are enumerated from the filesystem, never recalled;
every claim carries a citation; and the citations are checked before the map is
written. If it cannot read your data layer it says so, instead of reporting that
nothing touches any data.

## The rest needs an account

The worker, the decomposer and the review talk to your board over an
authenticated connection. Sign up at [vibeassist.app](https://vibeassist.app),
then connect from **Configuration → Claude connection** — it generates a token
and gives you the exact block to paste into `~/.claude/settings.json`.

Config lives in that file rather than in shell environment variables, so every
Claude Code session reads it — desktop app and terminal alike — with none of the
"I set the variable but the running session can't see it" traps.

### Running unattended

In review mode Claude asks before each action. For `sprint`/`drain` or any
headless run there is nobody to approve, so pre-authorise the routine work once
in `~/.claude/settings.json`. The connection page generates this for you with
the categories you choose; it is not something to hand-assemble from a README.

## Safety

- One branch and PR per task by default; destructive actions still confirm.
- Stops after repeated failures rather than churning through a sprint.
- Only ever sees the work you queued — the token scopes everything to your
  account.

## Versions

All four skills carry the same version marker, stamped at build time from
`.claude-plugin/plugin.json`, and mirrored into the app as
`CURRENT_SKILL_VERSION` — so a stale install is detectable rather than silent.
