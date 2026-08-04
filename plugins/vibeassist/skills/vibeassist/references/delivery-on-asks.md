# Delivery runs on asks — the loop

**Load this when:** `next_approved_ask` is available, or the user talks about
building an ask rather than working a sprint. This is the delivery loop. The
sprint loop in `SKILL.md` is the OLD road — still driveable while sprints are
queued on it, but nothing new should be dispatched that way.

Decided by Simon on 3 August 2026: _"Yes — rebuild delivery on asks, leave the
rest in the bin."_

## What changed, in one line

There is no sprint to pull, no task to claim, and no batch to compose. You take
**the next approved ask**, build it, and report what it now does.

| Old                              | New                                   |
| -------------------------------- | ------------------------------------- |
| `next_sprint` + `start_task`     | `next_approved_ask`                   |
| `complete_task`                  | `report_ask_delivery`                 |
| `VibeAssist-Task: <id>` trailer  | `VibeAssist-Ask: <id>` trailer        |
| One PR per sprint                | One PR per ask                        |
| `create_sprint` composes a batch | Nothing. The ask tree IS the grouping |

**Nesting replaces sprints.** An ask already contains asks. A big ask is
delivered by delivering its children — that grouping is one the user authored,
not one a machine proposed. Do not build or ask for a grouping mechanism.

## The loop

1. **`next_approved_ask({ projectId?, workerId? })`.** It serves and claims in
   one call — the ask moves to `building` and a build record opens. `ask: null`
   means nothing is approved: the queue is genuinely empty. Say so and stop.

   It will only ever serve an **approved** ask, and there is no parameter that
   relaxes that. If the user expects work and nothing comes, the answer is
   almost always that the ask is shaped but not approved — approval is the only
   thing that makes work available. Tell them that; do not go looking for
   another way in.

   **You are served leaves, not parents.** The deepest approved ask comes first,
   and a parent is never handed out while a needed child of it is unfinished. A
   parent is delivered by delivering its children, so serving one directly would
   hand you something you cannot finish. Two things follow:
   - **Do not go looking for the parent.** If a big ask the user is expecting
     does not arrive, its children are arriving instead. That is the system
     working.
   - **Build only the ask you were handed.** Its children are someone else's
     turn — possibly another worker's, right now. Reaching up to the parent, or
     down into a child, is the scope creep this ordering exists to prevent.

   An **extra** (`needed: false`) never blocks its parent: "Sign in" can be
   delivered while Google login is still undecided.

2. **Read what you were handed.** You get the **Shape** — `want`, `mustNot`,
   `doneWhen` — its place in the tree (parent, children), what it `touches`,
   and the actions it names.

   `doneWhen` is the definition of done. Everything outside the Shape is out of
   scope, and a gap in the Shape is a question for the user, not a guess.

   **A question goes on the ask.** `ask({ askId, question, options,
   recommendedOptionId, reasoning })` — the question shows on the card that is
   stopped, and your build stays open, so you carry on the moment it is
   answered. Do NOT raise a project-level question about an ask you are
   building: it blocks nothing, it lands nowhere near the card, and the answer
   has no way back to you. (Before 4 Aug 2026 that was the only option there
   was, which is why so many builds went quiet.)

   Between the question and the answer, work on something else or stop — but if
   you stop, the question IS the record of why. Do not also report the delivery
   failed; that would hand the ask to the next worker to hit the same wall.

   **You are NOT handed a technical brief, and that is deliberate.** Working out
   how to build it is your job. Simon: _"I care how it was built only as far as
   what goes into an ask, but the developer task-level work, I don't want
   recorded."_ So do not file tasks, do not create sub-asks to track your own
   steps, and do not report your working. Track your own work however you like;
   none of it belongs on his board.

3. **Build it** on the `branch` you were given (`ask/<short-id>-<slug>`), cut
   from the latest `main`. One ask, one branch, one pull request.

4. **Stamp every commit** with the `commitTrailer` you were handed —
   `VibeAssist-Ask: <id>` — as the last line after a blank line. That trailer is
   how commits find their way back to the ask; without it the link is guesswork.

5. **`bun run verify` fully green**, then push and open the PR. Same gate as
   ever: a PR may not be opened on a red verify.

6. **`report_ask_delivery({ askId, outcome, built, branch, commits })`.**

   Write `built` in the **product's** words — what the thing now does for the
   person. Not files, not functions, not an approach. If a sentence would only
   mean something to a developer, it belongs nowhere.

   `outcome: "accepted"` means _you finished it_. It does **not** mark the ask
   accepted — that verdict is the user's, and the tool will not make it for
   them. `outcome: "failed"` returns the ask to `approved` so another worker can
   take it; never leave an ask stranded on `building`.

   **A worker that stops must record why.** `outcome: "failed"` is **refused**
   unless `built` carries one plain sentence saying what stopped you. It is the
   same single field, and the user reads it on the ask — so write it for them
   ("the sign-in page needs a decision about what happens after Google login"),
   not for a developer ("blocked on OAuth callback config"). Twice in one week a
   session parked work and said nothing, the ask sat looking available, and the
   reason lived only in a terminal that was later closed. That is what the
   refusal exists to prevent. Stopping is fine; stopping silently is not.

   There is deliberately **one** free-text field and there must never be a
   second. The old `complete_task` had a `techDetails` beside it, and that field
   is where developer working leaked back onto the board.

7. **Stop at "PR opened."** The user reviews and merges. Then poll for the next
   approved ask and keep going until there are none.

## What does NOT come across

Named individually, because the whole point is that none of it creeps back:

- Sprints, batches, packets, `create_sprint`, `compose_sprints`.
- The pending-review tray for tasks — an ask's own `proposed` state is the gate.
- The `tasks` table as a board of record. The rows may sit there as storage;
  **curating them does not come across.** Do not file tasks to track work.
- Sprint-grouped pull requests.

If you find yourself reaching for one of these, the question to ask is not "how
do I get the new thing into the old machinery" — it is whether the old machinery
should be there at all. That confusion is what this replaced.

## Everything else still binds

The guardrails in `SKILL.md` § 6 are unchanged and apply here exactly as they
do to a sprint: never push to `main`; build in a worktree, not the canonical
clone; `bun run verify` green before any PR; every deliberate stop goes through
the VA inbox with `ask`, never only your terminal; recommendation-first
questions; confirm before anything destructive.
