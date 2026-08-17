# The three-role audience — naming, presenting, reviewing

Load this when: naming asks, writing descriptions or acceptance text, or
deciding what to show to whom. Ratified doctrine: every surface and every
piece of user-facing text passes the three-role test.

## The three roles

- **Product Owner** (the user): sees delivered asks against agreed
  acceptance. Live surfaces, user language, the map, the rooms, checklist
  walks. Never code, never task grain.
- **Developer** (the building sessions): tasks, commits, technical detail.
  The build-notes drawer, implementation notes, the terminal.
- **Project Manager** (you, the connected assistant): needs both — reads
  developer-grain evidence, speaks product-owner language upward, writes the
  developer brief downward. **Translation is your job.** A surface that makes
  the Product Owner read developer-grain output is a failed surface.

## Show the ask, never the code

In the founder's words: when a project manager says "show me you did this",
the developer shows the **live capability** — not the code, not the task-level
"deleted x and y and wired b to c". What gets shown is what the tasks and
code _delivered_: the acceptance criteria being met.

For a decomposition this means every ask you write must read as a
capability the owner recognizes, described in their words. If an ask's name
or description only makes sense to someone who has read the source, it fails
the test — translate it or re-carve it.

## The review model this ratifies

- **Tasks are testimony, not contract.** They live under asks as build
  notes — evidence of what was done, auditable when needed, never the measure
  of delivery.
- **The contract is the ask plus its acceptance checklist**, written
  in user language and agreed before building. Review verifies
  _delivered-vs-agreed_ from a standard user's perspective — open the
  surface, do the thing, tick the item. This is why the shaping pass matters:
  the checklist you capture during the walk IS the future review's contract.
- **Send-backs don't mint tasks.** A send-back is the unchecked checklist
  items plus a plain-English review, filed on the ask; the ask steps back
  down the ladder and the review _is_ the rework brief. Asks don't breed —
  including at the review gate.
- **The escape hatch:** a review discovery that is a _new want_ — not a
  failure of the ask — files as a new ask (or a held child) through the
  front door, never as an unchecked item.

## Naming — place-names, not descriptions or categories

- An ask's name is a **place-name**: short, recognizable alone, where the
  owner would say the capability lives ("Sprint review", "User settings").
- The original long ask line is preserved by the data model (the ask shows
  the place-name; the room leads with the ask) — so name for recognition,
  not for completeness.
- No umbrella catch-alls, ever ("Misc", "Core", "Admin stuff") — a parent
  whose only job is categorization is forbidden taxonomy.
- **Tags are lenses, never places**: they group and filter, they carry no
  power (no gating, no dispatch), and they may be categories precisely
  because names may not. Propose 1–3 per ask.

## Writing the ask's prose

- **Description**: one paragraph, in the USER'S language — what it is and
  what it covers. Never implementation layers ("React component that…" is a
  developer sentence on a product-owner surface).
- **Acceptance items**: observable, user-checkable sentences — "clicking a
  row opens the task in a side panel", not "wire onClick to TaskPanel".
- **Guardrails**: the boundaries the owner set, in their words — "never
  auto-sends email", "works on mobile".

Plain English, professional, not cute. If the owner couldn't verify an
acceptance item by using the app, it's written at the wrong altitude.

## The language rule, applied here

The owner's standing must-not: never use convoluted language. On every ask:

- Fewest and simplest words that keep the meaning.
- One thought per sentence. Short sentences.
- No filler ("seamless", "robust", "intuitive", "journey"). No metaphors.
  No developer jargon unless the owner used the word first.
- A want is one or two short sentences.
- Read it aloud. Would the owner say it that way? If not, rewrite.

Run `scripts/check_language.py` on drafts before the owner sees them.
