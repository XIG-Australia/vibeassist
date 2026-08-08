# Skill: vibeassist-review — the morning review

**Purpose:** Walks what got built overnight and judges each delivery against what was actually
asked for, one thing at a time, demanding evidence rather than accepting a plausible report.
**Who can use it:** Anyone with a VibeAssist account and the plugin installed.
**Arrives from:** Saying "review what got built", "morning review", "what happened overnight",
"did it actually do what we agreed", or similar.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:3
**Reached from outside:** No. It runs in conversation with you.

**Not to be confused with the worker's "review" mode.** That mode paces how work is *pulled*
during a build. This judges *finished* work afterwards. Same word, different moment.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:130-132

**The posture, and it is the whole point:** you did not write this code — even if another
session of you did. It reads as a sceptic. Where it is uncertain, the default is *not
verified*. **A verdict is earned by evidence, never granted by a plausible report.**
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:14-17

**It states plainly what it cannot do.** There is no tool that records a review verdict from
this seat — the three that did were retired on 2026-07-31 along with the board they wrote to,
and this file went on naming them until 2026-08-04. Rather than pretend, it names the two paths
that do work: the verdict can be recorded by a job that exercises the feature, or you can send
the ask back on the board and your words travel with it. Its job here is to show you the
evidence and say what it thinks — not to stamp the record itself.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:27-44

## Capability: Get one complete picture before judging anything
**What it's for:** Making sure nothing that needs your attention is buried inside a report you
would have to go looking for.

### Action: Gather everything that finished
- What happens: It pulls everything completed since the last review, with each report's notes,
  technical details, commits, branch, pull request and build state, and groups the deliveries
  **by the ask they serve** — because you review capabilities, not commits.
- Trigger: Automatic, at the start.
- Rules: a report missing its required sections is itself a finding.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:46-54

### Action: Give you the morning digest
- What happens: One message covering what was delivered in your language, what was skipped and
  why, **every manual step collected into one deduplicated checklist in run order**, anything
  done outside what was asked for, notable errors the builder worked around, and any questions
  still waiting.
- Trigger: Automatic, before any judging.
- Rules: **nothing you have to do by hand may hide inside a task report** — a manual step you
  never saw is a delivery that silently does not work.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:56-70

## Capability: Judge each delivery against what was agreed
**What it's for:** Making the board's delivered-versus-agreed picture something you can
actually trust.

### Action: Demand evidence for every acceptance criterion
- What happens: For each criterion it looks for evidence on a three-rung ladder — strongest is
  a named test that ran and passed; next is a line of code it read itself and confirmed does
  what the criterion says; weakest is a claim in the report, accepted only where there is
  genuinely nothing testable, and said out loud when used.
- Trigger: Per ask.
- Rules: **uncertain means fail.** A criterion with no evidence is not done — the rule that
  bound the builder binds the reviewer harder. It uses each ask's own criteria, never ones
  inherited from a parent.
- Rules: the builder's own self-check is not a substitute — that one had the author's context,
  and this one deliberately does not.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:72-90

## Capability: Turn what it finds into something that survives the session
**What it's for:** A conclusion that lives only in one conversation window is one the board
will contradict tomorrow.

### Action: Put each verdict to you, one at a time
- What happens: Each verdict goes to your inbox on its own, with a recommendation. Your tap is
  what records it — you accept the ask, or you send it back and your words go with it.
- Trigger: Right after judging that ask.
- Rules: **never batched.** A list of six verdicts is a list nobody answers.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:92-97

### Action: Turn a finding into a new ask
- What happens: Something genuinely missing or wrong becomes a new ask underneath the one it
  came from, proposed for you to accept.
- Trigger: Any real finding.
- Rules: **a finding that becomes a note evaporates.** It has to become work.
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:98-101

### Action: Work out why something missed before sending it back
- What happens: It asks whether the *build* was wrong or the *ask itself* was wrong. If the ask
  was badly specified, that goes back through the shaping walk and gets fixed first.
- Trigger: Before any send-back.
- Rules: **rebuilding to a broken specification fails twice.**
- Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:102-107

## What this skill deliberately is not
- **Not a fix-it session.** A problem found becomes a send-back or a new ask, never an inline
  patch from the review chair.
- **Not a merge authority.** A human merges; the verdict informs that call, it never performs it.
- **Not a rubber stamp for a green build.** Passing tests prove the named tests pass and say
  nothing about criteria no test covers — which is exactly why the evidence ladder has three
  rungs rather than one.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:117-132

## The standing guardrails
- Never state a verdict without the evidence trail, and never a stronger one than the evidence
  supports.
- Default to fail when uncertain.
- One verdict per ask, recorded right after judging that ask — never batched at the end where
  one stall loses them all.
- Surface every manual step.
- Never fix during review; never delete anything; you are the gate on every send-back and every
  new ask.
- Findings about the *process* — a missing report section, missing evidence, a criterion that
  could not be tested as written — are recorded too, because the loop only improves if the
  review says where it creaked.
  - Evidence: plugins/vibeassist/skills/vibeassist-review/SKILL.md:134-143
