# Stack — and why this repo is mapped differently

**What this repo is:** the VibeAssist plugin for Claude Code. It is not an application. It has
no pages, no router, no database, no server and no user interface. It is four sets of written
instructions — "skills" — that a person installs into Claude Code, plus a handful of helper
scripts those instructions tell Claude to run.

**Why the page-by-page method does not apply here, stated plainly.** The mapping method
assumes a person opens pages in a browser and presses things. Nobody opens anything here. The
skill's own enumerators were run against this repo and both correctly reported nothing:
the route enumerator found no routes directory, and the harvester reported "data layer(s)
detected: NONE" with zero controls and zero database calls. Those are true answers, not
failures — so no page files were invented to fill the gap.

**What was mapped instead, and why it is the honest equivalent.** The person using this repo
is someone typing at Claude Code's prompt. What they meet is a **skill**; what opens it is a
**phrase they say**; what it then does is a **capability**. So each skill gets a file in the
same three-level shape the method demands — plain-language purpose, the trigger, and a
`file:line` citation behind every claim — and the same evidence checker was run over all of
them. The vocabulary changes; the discipline does not.

**How it is delivered:** a person adds the marketplace and installs the plugin from Claude
Code's own prompt. Nothing is downloaded from a website and nothing is signed into.
  - Evidence: README.md:10-19

**How the four skills reach the outside world:** three of them talk to a VibeAssist account —
first choice is a set of connected tools, and a fallback that uses a saved key. The fourth,
the mapper, talks to nothing at all and needs no account.
  - Evidence: README.md:29-44

**Version marker:** all four skills carry the same version, stamped from one manifest, so an
out-of-date install can be detected rather than failing quietly.
  - Evidence: plugins/vibeassist/.claude-plugin/plugin.json:3, README.md:46-48

**Scan provenance:** run 2026-08-08 against commit `12da0b8`, using the bundled
`vibeassist-map` scripts at plugin version 0.8.0 — the same scripts this repo ships.
