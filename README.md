# VibeAssist for Claude Code

Keep control of what you're building.

AI coding tools build fast and lose the plot. You end up unable to say what was
actually built, whether it matches what you asked for, or what broke on the way.
These four skills are for the person who owns the product, not the person
writing the code.

## Install

```
/plugin marketplace add XIG-Australia/vibeassist
/plugin install vibeassist@vibeassist
```

Type both at Claude Code's own prompt — they are Claude commands, not terminal
commands. Update later with `/plugin marketplace update`.

## What you get

| Skill | What it does | Say |
| --- | --- | --- |
| **vibeassist** | Pulls your queued sprints, works the tasks in dependency order, and reports each one back so the board updates itself. | _"work my VibeAssist sprint"_ |
| **vibeassist-decompose** | Turns an idea — or an existing codebase — into a tree of asks, through a Q&A walk. Also shapes a single ask on its own. | _"break this down into asks"_, _"shape the export ask"_ |
| **user-lens-map** | Maps a codebase the way its **users** meet it: every page, what you can do on each, and which tables each action reads or writes — with a `file:line` citation behind every claim, verified before it finishes. | _"map this codebase"_ |
| **vibeassist-review** | The morning review. Walks what got built overnight and judges each delivery against what was actually asked for. | _"review what got built"_ |

## The mapper works on its own

`user-lens-map` needs no account and no connection. Point it at a repository and
it produces a map a non-technical person can read. It supports file-based routers
(TanStack Start, Expo Router, Next-style trees), react-router, and apps with no
router at all; and it detects the data layer rather than assuming one.

It refuses to guess. Routes are enumerated from the filesystem, never recalled;
every claim carries a citation; and the citations are checked before the map is
written. If it cannot read your data layer it says so instead of reporting that
nothing touches any data.

## The rest needs an account

The worker, the decomposer and the review talk to your VibeAssist board over an
authenticated connection. Sign up at [vibeassist.app](https://vibeassist.app).

## Versions

All four skills carry the same version marker, stamped at build time from the
plugin manifest — so a stale install is detectable rather than silent.
