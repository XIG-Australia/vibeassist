# Skill: vibeassist-map — the mapper

**Purpose:** Reads a codebase and produces a map of it the way its *users* meet it: every page,
what a person can do on each, and which database tables each action reads or writes — with a
citation behind every single claim, checked before the map is written.
**Who can use it:** Anyone with the plugin installed. **This is the only one of the four that
needs no account and no connection.** Point it at a repository and it works.
  - Evidence: README.md:29-31
**Arrives from:** Saying "map this codebase", "understand this app", "document what this app
does", "import this codebase", or "create a sitemap from code".
  - Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:3
**Reached from outside:** No. It runs against a repository you already have.

**The bar it sets itself:** a competent builder who has never seen the codebase should be able
to rebuild the app from the map alone, and it would work the same way — different look,
identical behaviour. Every rule in it serves that test.
  - Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:12

**The rule the whole skill turns on:** everything is described at three levels, in order —
plain user language with no code words in it, then the visible thing you press, then the
technical trace with citations. The first two are the deliverable; the third exists so the
claims can be checked. Level-three vocabulary is never allowed to leak upward.
  - Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:16-22

## Capability: Find every page without relying on memory
**What it's for:** A list of pages recalled rather than extracted is the single easiest way for
a map to be quietly incomplete.

### Action: Enumerate the pages mechanically
- What happens: It runs a script that reads the routes out of the code, then sorts every one
  into three lists — pages a person opens and stays on, old addresses that send you elsewhere,
  and addresses only another computer ever requests.
- Trigger: Automatic, phase 1.
- Rules: **100% of the pages a person opens get a full write-up.** Machine-only addresses and
  old redirects each get one line in their own appendix — never dropped silently, because
  hiding real surface area is how a map lies. It handles file-based routers and config-based
  ones with two different scripts, and says to enumerate by hand on the same rules for
  conventions it does not know.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:30-49
- Evidence: `routes_file_based.py` plugins/vibeassist/skills/vibeassist-map/scripts/routes_file_based.py:1-5, `routes_react_router.py` plugins/vibeassist/skills/vibeassist-map/scripts/routes_react_router.py:1-5

### Action: Work out how the pages link to each other
- What happens: A script scans the whole codebase for links, attributing the ones in shared
  navigation to "global navigation" rather than to any single page.
- Trigger: Automatic, phase 2.
- Rules: navigation hides in four places, and it checks all four — links in the page itself,
  the shared sidebar and footer, lists of addresses the navigation is built from, and rails
  whose addresses are assembled from a list so the finished address appears nowhere in the
  code. It normalises the four different ways frameworks write a placeholder before comparing,
  because otherwise every page with a changing part in its address falsely looks unreachable.
- Rules: **a page with no inbound link is a claim, not an observation** — it must be checked
  against all of those before being reported.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:51-66
- Evidence: `gen_edges.py` plugins/vibeassist/skills/vibeassist-map/scripts/gen_edges.py:1-4

## Capability: Gather the evidence before writing a word
**What it's for:** Making an honest citation cheap — you have the line number in front of you
before you write the sentence, rather than hunting for one to justify a sentence you already
wrote.

### Action: Harvest what every page touches
- What happens: One script resolves each page plus its imports two levels deep and pulls out,
  with line numbers, every control, every server function and every database call, tagged as a
  read, an insert, an update or a delete.
- Trigger: Automatic, once, before the per-page work.
- Rules: **what it produces is a list of candidates, not a list of claims.** Following imports
  two levels deep offers a page far more tables than it actually touches — a dashboard can be
  offered 23 while truly using 8 — so each one has to be confirmed as something the page's own
  controls actually reach. A page offered more than about ten tables is almost certainly
  inheriting them.
- Rules: **it refuses rather than guessing.** If it finds controls but cannot recognise the
  data layer, it stops with an error instead of producing a map that would falsely claim
  nothing touches any data. If everything comes back empty it warns that imports are not
  resolving, and says to fix that first — because a map written from an empty harvest is a
  confident wrong answer, which is worse than no map.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:70-81
- Evidence: `harvest.py` plugins/vibeassist/skills/vibeassist-map/scripts/harvest.py:1-5

### Action: Write up one page at a time, in the order people reach them
- What happens: Each page is written in its own pass — the public entrances first, then
  everything the shared navigation reaches, then the interior by distance from the entrances.
- Trigger: Phase 3, per page.
- Rules: the order exists so that a run cut short still leaves a useful map, missing the
  least-visited part rather than a random half. **Never reduce depth to increase count** — a
  shallow page is worse than a missing one, because a missing one is honest.
- Rules: every action must also state the **rules** its path passes through — the condition
  that gates a write, the formula that produces a number, the ordering rule. A rule that cannot
  be stated plainly is an action that has not been finished, and it is the first thing a
  rebuild gets wrong.
- Rules: each capability must carry one line saying what it is *for* — what a person achieves
  by using it, not a restatement of its name.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:84-104

## Capability: Refuse to publish a claim it has not checked
**What it's for:** This is the difference between a map and a plausible-sounding document.

### Action: Check every citation
- What happens: A script pulls out every citation, confirms the file exists, confirms the line
  range is real, and confirms the cited lines actually contain the things named in the claim.
- Trigger: Phase 4, before assembling anything.
- Rules: **existing is not enough** — a citation can point at a real file and the wrong line.
  A failure means going back to the code, not softening the wording until it is vague enough to
  be safe; that would produce exactly the useless output the skill exists to prevent. Anything
  that cannot be re-verified is marked unverified in plain sight.
- Rules: the script may be fixed if it is genuinely wrong, but the fix and the failing case
  must be reported, and it may **never** be edited to make one of your own claims pass — "a
  gate you widened is not a gate".
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:107-124
- Evidence: `check_evidence.py` plugins/vibeassist/skills/vibeassist-map/scripts/check_evidence.py:1-5

## Capability: Assemble the result the same way every time
**What it's for:** Stopping the map changing shape depending on who assembled it.

### Action: Build the map, the data index and the machine-readable version
- What happens: One script writes the whole document — a coverage table with counts read from
  the data rather than typed, the sitemap, every page, an index of which page reads and writes
  each table, and up to ten more sections built from the scan: what runs on its own, what the
  app emails out, the states records move through, what gets deleted along with what, the
  sign-in journey, where free stops and paid starts, who is allowed to do what, and which keys
  and outside services the app needs. A second script produces the same thing as structured
  data, and a third draws the sitemap as a proper tree.
- Trigger: Phase 5.
- Rules: **never write the map by hand.** The findings it computes are candidates, not
  verdicts — each must be checked against the code, and one that turns out to be intentional
  keeps its line with a note saying so, because deleting it hides the question from the next
  reader.
- Rules: if the structured output warns that it read no harvest, the file is pages and nothing
  else — half a reading wearing a complete one's face — and must be fixed before it is handed
  over.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:125-145
- Evidence: `assemble.py` plugins/vibeassist/skills/vibeassist-map/scripts/assemble.py:1-5, `emit_map_json.py` plugins/vibeassist/skills/vibeassist-map/scripts/emit_map_json.py:1-4, `tree_from_map.py` plugins/vibeassist/skills/vibeassist-map/scripts/tree_from_map.py:1-4

## Capability: Record what is broken while tracing it
**What it's for:** Somebody tracing what a button does is in the perfect position to notice
that it does nothing — and that is first-class output, not a digression.

### Action: Note a defect on the thing it is about
- What happens: A one-line note is attached to the page, or to the specific control, saying
  what is broken in user terms with its own citation.
- Trigger: Whenever tracing reveals one.
- Rules: one line per defect, never two joined into a sentence, because they are carried
  separately and attached individually.
- Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:189-191

**What it can handle:** file-based routers, config-based routers, and apps with no router at
all — for which it maps screens instead of pages and attributes data calls to the function
that contains them.
  - Evidence: plugins/vibeassist/skills/vibeassist-map/SKILL.md:145
  - Evidence: `nav_edges.py` plugins/vibeassist/skills/vibeassist-map/scripts/nav_edges.py:1-3, `index_calls.py` plugins/vibeassist/skills/vibeassist-map/scripts/index_calls.py:1-3

**It tests its own output format.** A self-test checks the structured output still matches what
an importer expects.
  - Evidence: `selftest_emit_map_json.py` plugins/vibeassist/skills/vibeassist-map/scripts/selftest_emit_map_json.py:1-3
