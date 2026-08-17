# Decomposition — worked examples

Load this when: judging whether something is a sub-ask or shape, carving or
naming feels ambiguous, or you want the worked examples behind the rules in
SKILL.md. Every example here is ratified doctrine, learned by dogfooding the
decomposition on VibeAssist itself.

## Sub-asks only where wants genuinely fork — the Sprints example

_Sprints_ decomposes into exactly **three** sub-asks: **create**, **run**,
**review** — three genuinely distinct wants (making one, executing one,
judging one). Of those, only _create_ forks further: **manual** vs
**AI-assisted**, because those are two genuinely different ways to do the
same thing. _Run_ and _review_ are leaves.

What does NOT appear as sub-asks: sprint naming rules, the queue ordering,
what the progress bar shows, pause behaviour. All of that is the SHAPE of
create/run/review — it hangs on those asks as intent, guardrails and
acceptance. The tree stays three asks deep at most, and every ask is a
thing the owner would point at and say "build that".

The test: **would the user want this even if its parent didn't exist in this
form?** Distinct want → sub-ask. More detail about the same want → shape.

## Shape stays on the ask — the Assistant-chat example

_Assistant chat_ is a single leaf ask, richly specified. "Answers are
grounded in real state", "you never wait for a reply", "you can pick short vs
detailed" are its **guardrails** — they hang on the ask's `intent_spec`, they
never become child asks. A decomposition that turns each behaviour into a
sub-ask has mistaken specification for structure: the map gets deep and
unreadable, and every ask stops being a capability.

When you catch yourself writing a child ask whose name is a property, a
rule, or an option of its parent — stop, demote it into the parent's
guardrails or acceptance, and keep the tree shallow.

## The quirk / reuse exception — the avatar example

_Person details_ is an ask. An **avatar** added later becomes its **own**
ask — not because it's big, but because it's **reused differently and in more
places**: it appears across many surfaces, evolves on its own schedule, and
someone will point at it independently of person-details. Cross-cutting reuse
is what earns the promotion. The same goes for genuinely quirky pieces:
something with enough independent behaviour that specifying it inside another
ask's shape would bury it.

Things bolted on later often deserve their own ask for exactly this reason —
they were never part of the original want; they are a new want.

## The cart rule, worked — capabilities stay on the thing

A cart page shows a table of items. You can delete an item or change its
quantity. The decomposition: **Cart** is a page (or an element, if it sits
inside a bigger page). Delete and update are two must-do lines on it. They
are NOT capability asks — neither is its own thing in its own right, neither
would be built and reviewed separately, and nobody demos "update quantity"
in a sprint review.

Contrast: "map the repo" in VibeAssist is started by one button, but it IS a
capability ask — its own delivery, its own shape, and the owner talks about
it by name. The button is never the thing. What the owner points at is an
element; what the owner does is a capability; what merely happens along the
way is a line.

## No umbrellas — the name-specificity rule, applied

An ask earns its place by being **recognizable from its name alone**.

- "Settings" — too general to be an ask. "User settings" and "App
  settings" are each their own independent ask, because you know exactly what
  each is from its name.
- A parent whose only job is categorization ("Admin stuff", "Misc",
  "Core") is **taxonomy, and taxonomy is forbidden** — depth is
  earned by decomposition, never classification.
- Wanting to group things is fine — that's what **tags** are for. Tags are
  lenses, never places: tags may be categories; ask names may not.

This applies everywhere asks are named or carved: greenfield
decomposition, repo ingestion, rename proposals, and grouping during the
correction walk.

## Gaps become walk-questions — never inventions, never omissions

Breakdown mode, and the code has sign-in but clearly no password reset. Do
NOT quietly add a "Password reset" ask (inventing structure the code doesn't
have), and do NOT quietly leave it out (hiding a gap the owner should see).
Raise it in the walk, recommendation-first:

> The code has sign-in but no password reset — should the map carry it as a
> planned ask?
> **Recommended: yes, as a held/proposed ask** — users will expect it, and
> holding it keeps it visible without gating anything.
> Options: [Add it as proposed] [Leave it off the map] [It exists — point me at it]

That third option matters: a "gap" is sometimes your reading error, and the
walk is where the user corrects readings cheaply.

## A shaping pass, worked — a task-list UI ask

The tree is agreed and _Task list_ is an ask. Its shaping pass captures the
detail that makes it properly specified — batched, recommendation-first:

- **Columns** — recommended: title, status, priority, updated. One question.
- **States** — recommended: the board's real status set, named in user words.
- **Behaviour** — row click opens the task; recommended: in a side panel.
- **Filters** — recommended: status + priority; free-text search deferred.
- **Sorting** — recommended: updated-desc default, click-to-sort columns.
- **Design rules** — follows the project's design language; anything novel is
  proposed, not invented silently.

Each confirmed answer becomes an **acceptance checklist item** on the ask's
`intent_spec` — "columns show title/status/priority/updated", "clicking a row
opens the side panel", and so on. That checklist is the contract review will
verify delivered-vs-agreed against. A non-UI ask shapes the same way with its
own defining detail: inputs, rules, edge behaviour, the observable "done".

## Homing — never a catch-all

An absolute rule, learned the hard way: work is filed **under the ask it
actually belongs to** — and if no ask fits, you **create the ask** to hold
it. A real session once piled unrelated build work onto a handy "Idea Tree
map" ask because it was convenient — wrong, and never again. A catch-all
parent is a filing bug, not a shortcut.

Misfiling is correctable ("Move to…" exists because a filing is a reading,
and readings get corrected) — but correctability is the safety net, not a
licence to file lazily.

## Held-for-later — how MVPs live on the map

Functions mature: a dashboard may ship doing X now with Y planned later. Any
ask can be deliberately **held** as proposed — visible on the map, part of
the shape, NOT gating. The founder's gate rule: "all children must be agreed
before the parent is built, the exception being where the children are those
additional parts we're thinking about but not building yet." Held children
don't count toward a parent's readiness; releasing the hold returns the ask
to the normal ladder. MVP scoping lives ON the map, never in a separate
backlog — so when a walk surfaces a "later" want, propose it as a held ask
rather than dropping it.

## Live is fact, not desire — recompose, don't erase

In breakdown mode you judge whether a capability **exists and runs** — never
whether the user still wants it. A map of a real app will contain live asks
the user intends to reshape or retire; that is expected, not an error. The
ladder has a re-entry path: a live ask can be deliberately sent back to
shaping (**recomposed**), carrying its evidence and history, then travels the
normal road back to a new live. Retirement is the same kind of door:
explicit, user-gated, recorded — never a silent drop (see
`references/graveyard.md`).
