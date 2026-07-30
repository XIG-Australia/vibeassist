# The graveyard — retire, never delete

Load this when: you meet pulled or dead work, research, spikes, or housekeeping
work during a breakdown, or the user asks to remove something. Ratified
doctrine: work that doesn't directly serve the end product is **maintained,
not discarded** — there are lessons, research, and things worth going back
to.

## The rule

When an ask is pulled from the product you do **not** delete its work on
removal; you **retire it to a graveyard** and **record and report the
removal actions**. The graveyard is kept somewhere findable but **out of the
main product tree** — it isn't an ask, and it must not clutter the map of
what the product is.

## What belongs in the graveyard — three kinds

1. **Retired asks**, each with its **removal report**: a short record of
   what was removed, why, and what removal actually touched.
2. **Research and spikes** — "we might revisit this" work. These are never
   product asks; they go straight to the graveyard, not onto the map.
3. **Housekeeping / infrastructure lessons** — CI, build, cleanup work and
   what it taught. A graveyard lesson, not a product ask.

## What does NOT belong

Genuine product work is **never graveyarded just because it's ambiguous** —
it's anchored to the ask it served (and if no ask fits, the ask is created;
see homing in SKILL.md). The graveyard holds only non-product work:
removals, research, spikes, lessons.

## How retirement runs in a walk

- Retiring an ask is a **move with a record**, proposed like everything
  else: recommendation-first, user-gated, applied only on acceptance. Never
  a silent drop, never a delete.
- In breakdown mode, code that looks pulled or dead is a **walk-question**,
  not a unilateral retirement: "X appears unused/superseded — retire it to
  the graveyard with a removal report?" (Recommended answer + one line of
  reasoning, as always.) A live card the user no longer wants follows the
  same explicit door — the map records the retirement rather than losing the
  history.
- The removal report travels WITH the retired item: what was removed, why,
  when, and what the removal touched — so a future "should we bring this
  back?" starts from evidence, not archaeology.

## Why this exists

Deleting pulled work throws away the lessons that made pulling it the right
call (the cautionary tale: a capability built before its guardrails were
understood — the app was categorically better without it, and the record of
WHY is worth keeping). The graveyard keeps the product tree honest — a map
of what the product IS — without ever paying for that honesty in lost
history.
