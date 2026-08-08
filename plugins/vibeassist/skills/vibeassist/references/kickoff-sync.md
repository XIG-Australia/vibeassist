# Kickoff sync — applying the user's VA worker preferences

**Load this when:** the `GET /api/public/claude/preferences` response shows
missing allow-rules, an essentially unconfigured worker profile, or a role-model
mismatch — i.e. there is something to OFFER the user.

VA has a "Command approvals" surface (Claude connection page) where the user
opts into CATEGORIES of routine commands to auto-approve (Build & test, Git —
safe, Package install, Formatting). **VA stores the preference; the user's
machine enforces it** — this sync is how the preference reaches the machine,
and it is ALWAYS the user's call. Every write below is offer-first in EVERY
mode, worker and drain included: editing the user's settings file is a config
change on their machine, not build work, so the consent to build an Ask does
NOT cover it.

## Incremental allow-rules sync (`commandApprovals`)

`commandApprovals` carries `enabledCategories`, the composed `allowRules` (the
exact `permissions.allow` entries those categories grant), and the full
`categories` catalogue. Then:

- **No categories enabled** (`enabledCategories` empty) → apply nothing and
  move on. If the user later complains about permission prompts stalling runs,
  point them at VA → Claude connection → **Command approvals** (that page, not
  a hand-edited allowlist, is the supported way to opt in).
- **Compare, don't clobber:** read `~/.claude/settings.json` and work out which
  of `allowRules` are missing from `permissions.allow`. All present already →
  say nothing; you're in sync.
- **Missing rules → OFFER, never write silently:** "Your VA command approvals
  grant N auto-approve rules not yet in your local settings (categories: …).
  Apply them to `~/.claude/settings.json` so runs don't stall on prompts?"
- **On yes, merge idempotently:** append ONLY the missing rules to
  `permissions.allow`. Never remove, rewrite or reorder the user's existing
  entries; never touch `deny` (deny always outranks allow — leave that boundary
  exactly where the user put it); never write outside `permissions.allow`;
  never add a rule that isn't in the fetched `allowRules`. Destructive commands
  can never arrive here (the server composes them out by construction) — if a
  rule ever looks destructive anyway (`rm -rf`, `--force`, `reset --hard`),
  refuse it and say so.
- **Report what changed** ("added 5 rules from 2 categories") and remind the
  user they can change categories anytime in VA — the next kickoff picks the
  change up. **On no**, proceed without applying and don't ask again this
  session.

## The complete Recommended baseline (`recommendedBaseline`)

The allow-rules sync above is INCREMENTAL — it never sets `defaultMode`,
`additionalDirectories`, `deny`, or the sandbox pin. A worker needs all of
those too, or it still prompts on file edits and git and reaches for bypass
mode. So the response also carries `recommendedBaseline`: the COMPLETE,
prompt-minimal-but-safe worker profile the "Recommended" preset represents
(`settings.permissions.defaultMode:acceptEdits`, the full `allow` = recommended
categories + git + safe reads + curl, the `deny` floor, and
`sandbox.network.allowedDomains` pinning curl to the VA host), plus
`additionalDirectoriesHint`.

- **When to offer the full baseline vs. just the rules:** if the local
  `settings.json` is essentially UNCONFIGURED for worker use — no
  `permissions.defaultMode`, or missing the base layer (`Bash(git:*)`, the deny
  floor, the curl sandbox pin) — offer the whole `recommendedBaseline` in one
  confirmation ("Set up the complete safe worker profile so runs don't stall —
  auto-approve in-scope edits, allow git + the VibeAssist API (pinned to VA),
  keep the deny floor on rm -rf / force-push / .env?"). If it's already
  configured and only some allow-rules are missing, do the incremental sync
  above. Either way it is ONE confirmation, in every mode.
- **On yes, merge the baseline idempotently:** set `permissions.defaultMode` to
  `acceptEdits` (only if unset — never downgrade a stricter user choice); union
  `settings.permissions.allow` into `permissions.allow` (missing only); union
  `settings.permissions.deny` into `permissions.deny` (NEVER remove the user's
  own deny entries); set `sandbox.network.allowedDomains` to include the
  baseline's domains; and add the parent of your verified clone dir to
  `permissions.additionalDirectories` per `additionalDirectoriesHint` (so edits
  in a worktree don't prompt). Preserve everything the user already
  has. This yields a worker that runs an Ask end-to-end with zero prompts —
  the goal is to make AUTO/BYPASS MODE UNNECESSARY, never to reach for it.
- **Never** widen `Bash(curl:*)` without also writing the sandbox pin — the
  baseline always ships them together; keep them together on merge.

## Per-role model (`roleModels`) — same fetch, same consent

The response carries `roleModels`
(`{ build: { model, fastMode }, design: { model, fastMode } }` — default
Opus 4.8 + fast mode for both; fast mode is the same Opus with faster output,
not a downgrade). Apply the model for the ROLE THIS SESSION IS: a
**worker/build** session uses `roleModels.build`; a **standby/responder**
session uses `roleModels.design` (design & planning rewards the strongest
reasoning model; build can favour coding throughput). A back-compat
`workerModel` alias (= `roleModels.build`) is served for one release, so if you
only see `workerModel`, treat it as the build model.

- If the user-scope `~/.claude/settings.json` already has that role's exact
  `"model"`, say nothing. Otherwise include it in the SAME single offer as the
  approval rules ("…and set your build model to `claude-opus-4-8`?" / "…and set
  your design model to `claude-opus-4-8`?"); on yes, set the top-level
  `"model"` key in that file. Never change it silently, and never touch it on
  no.
- `fastMode: true` → fast mode should be on for that role's sessions (`/fast`,
  Opus 4.8+). If you cannot toggle it yourself, say once at kickoff that fast
  mode is due per the user's preference so the user/launcher enacts it.
- Fallback when the settings file can't be written: tell the user to launch
  with `claude --model <that role's model> "/vibeassist <role>"` — the VA
  connect page templates exactly this command per role with their preference
  baked in.
