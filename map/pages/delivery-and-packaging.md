# How the plugin reaches people, and how it keeps itself honest

**Purpose:** Not a skill — the machinery that gets the four skills onto someone's machine and
stops them drifting apart from each other once there.
**Who it affects:** Everyone who installs the plugin, whether they ever think about it or not.
**Arrives from:** Two commands typed at Claude Code's own prompt — not a terminal, and not a
website.
  - Evidence: README.md:12-19

## Capability: Install and update the plugin
**What it's for:** Getting four sets of instructions onto a machine without anyone downloading
a file or signing into anything.

### Action: Add the marketplace and install
- What happens: Claude Code fetches the plugin from the repository and the four skills become
  available by name and by phrase.
- Trigger: `/plugin marketplace add` then `/plugin install`, at Claude Code's prompt.
- Rules: they are Claude commands, not terminal commands — the README says so explicitly,
  because typing them into a terminal is the obvious mistake.
- Evidence: README.md:12-19
- Evidence: what the marketplace advertises .claude-plugin/marketplace.json:9-18

### Action: Get updates
- What happens: Updates arrive on their own; a command forces one immediately.
- Trigger: `/plugin marketplace update`
- Evidence: plugins/vibeassist/README.md:23-25

## Capability: Let a session with no filesystem still read the skills
**What it's for:** A cloud session cannot install a plugin, so the skills have to reach it
another way — and the only channel that reaches one is the VibeAssist connection itself.

### Action: Keep a written list of every skill file
- What happens: A build step walks the skills folder and writes out a list of every skill, what
  it is for in its own words, and every file it contains.
- Trigger: Run by hand after adding, removing or renaming any skill file.
- Rules: the connection runs on a server with no checkout and no filesystem, so it fetches
  these files over the web — and GitHub's own listing service is rate-limited hard enough to be
  unusable for that. Hence a list committed next to the thing it describes. Each skill's "when
  to use" line is taken from the skill's own words rather than written separately, so the two
  cannot disagree.
- Evidence: plugins/vibeassist/skills/build-manifest.mjs:1-11
- Evidence: it reads the description out of the skill itself plugins/vibeassist/skills/build-manifest.mjs:25-31
- Evidence: the list it produces plugins/vibeassist/skills/manifest.json:1-8

**⚠ Worth knowing about:** the list is only correct if somebody remembers to run the build step
after changing a skill's files. Nothing enforces it — the instruction to run it is a comment in
the script. — Evidence: plugins/vibeassist/skills/build-manifest.mjs:11-12

## Capability: Make a stale install detectable
**What it's for:** An out-of-date copy of the instructions that fails quietly is worse than one
that says so.

### Action: Stamp every skill with the same version
- What happens: All four skills carry the same version marker, taken from one manifest.
- Trigger: Automatic, at build time.
- Rules: the worker checks the version the server reports against its own on every run, and if
  the server's is newer it tells you in one line to update and leaves a breadcrumb on the first
  piece of work it claims — otherwise it says nothing.
- Evidence: plugins/vibeassist/.claude-plugin/plugin.json:3, README.md:46-48
- Evidence: the check on every run plugins/vibeassist/skills/vibeassist/SKILL.md:93-96

### Action: Stop the README drifting from what actually ships
- What happens: A test asserts every skill folder is named in the plugin's README, so adding or
  renaming a skill without updating the README fails the tests.
- Trigger: Automatic, in the test suite.
- Rules: this exists because it has drifted before.
- Evidence: plugins/vibeassist/README.md:10-13

### Action: Ship files that work on every operating system
- What happens: Every file is committed with one style of line ending regardless of the machine
  it was written on.
- Trigger: Automatic, on every commit.
- Rules: the shell scripts break on Mac and Linux if they arrive with Windows line endings, and
  this repository is written on Windows — so the rule is set once at the repository level rather
  than relied on per file.
  ⚠ **Not citable by the checker, verified by reading.** The rule lives in the repo's
  `.gitattributes`, and the evidence checker can never cite it: its citation pattern caps a
  file extension at 10 characters and "gitattributes" is 13. The file says, in its own words,
  "Everything ships with LF. The shell scripts break on macOS and Linux if they arrive with
  CRLF, and this repo is authored on Windows", then sets `* text=auto eol=lf`.

## Capability: Give the worker helper scripts it can actually run
**What it's for:** A check the machine refuses to run because it needs approval every time is
not a check.

**The three scripts, and why they are files rather than typed-out commands:** an inline
compound command asks for permission every session, so the connection check, the tool check and
the listening loop each ship as a file that a person approves once by name. The skill says to
install them by **copying the packaged file, never by transcribing it**.
  - Evidence: plugins/vibeassist/skills/vibeassist/SKILL.md:30-33, the approval reason plugins/vibeassist/skills/vibeassist/SKILL.md:45-49
  - Evidence: the listening loop's filename must never change, because the approval matches the exact string plugins/vibeassist/skills/vibeassist/references/listening-roles.md:15-18

**The connection check prints its own version.** A session can tell an outdated copy from a
current one without reading the file, and the skill refuses a copy older than version 3 —
because a stale checker lies with authority.
  - Evidence: plugins/vibeassist/skills/vibeassist/scripts/va-check.sh:2-4, the refusal rule plugins/vibeassist/skills/vibeassist/SKILL.md:51-53

## Capability: Remember why every rule exists
**What it's for:** A rule without its reason gets argued with, re-litigated, or dropped.

**An incident archive sits beside the worker skill**, one entry per thing that went wrong: what
happened, the rule it produced, and where that rule now lives. It is explicitly never needed on
the happy path — it is loaded only when a rule needs justifying.
  - Evidence: plugins/vibeassist/skills/vibeassist/references/incidents.md:1-6
