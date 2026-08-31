# UI copy standard — how the product talks

**Load this before writing ANY word a user will read** — a button, a heading, an
empty state, an error, a placeholder, a menu item. It is the single source of
truth for the product's voice, and `scripts/check_copy.mjs` enforces the
mechanical half of it.

This is NOT the doctrine voice in the project docs, which may be crafted and
literary. The UI may not. And it is not the shape voice either. It is the plainest
thing that is still exact.

## The one idea

**Write like a competent person wrote it on purpose — not like an assistant being
helpful.** The reader is busy and capable. They do not need cheering on, warming
up, or walking through the obvious. Say the true thing in the fewest ordinary
words and stop.

The test, always: **would a person actually say this out loud to another person?**
"You're all set!" — no one says that. "Reading your app…" — yes. If it fails the
out-loud test, rewrite it.

## THE FIRST RULE: use the word everyone already knows

**A button is a known word, not a description of what the button does.** This is
the one that causes the most rework, so it comes first.

The rules, plainly:

- **Use standard, concise microcopy for controls** — Save, Cancel, Delete,
  Settings, Add, Remove, Edit, Done, Close, Open, Import, Export, Search.
- **Never use conversational, verbose, or descriptive phrases** for button
  labels, headings, or tooltips.
- **Prefer 1–3 word actionable labels using standard imperatives.**
- **Follow standard design-system conventions** (Shadcn/UI, Tailwind UI) for
  wording, typography and component naming. If those systems label a control a
  certain way, match it — do not reinvent it.

There is a shared vocabulary every user already understands, built up over
decades of software: **Save, Delete, Cancel, Done, Add, Remove, Edit, Rename,
Close, Copy, Share, Undo, Next, Back, Sign in, Sign out, Search, Open, Send,
Create, Move, Import, Export.** When one of these fits, use it exactly. Do not
paraphrase it. Do not improve it. Do not describe the underlying mechanism.

The failure is always the same shape: **more words than meaning.** A label that
is longer than the word it replaces, and clearer to nobody.

- "Place it where it can be retrieved later" → **Save**. Everyone knows Save.
  Nobody knows what the long one means.
- "See what came back" → whatever it actually does: **Open**, or **See the
  report**. A button no one has ever seen before is a puzzle, not a control.
- "Remove this from the collection permanently" → **Delete**.
- "Take me back to where I was" → **Back**.
- "Confirm and proceed with this action" → **Save**, or **Done**, or the real verb.

The rule generalises past buttons: **when a plain, common word exists for the
thing, use it — never a novel phrase that means the same.** Novelty in a UI is
not craft; it is a tax the reader pays every time. If you find yourself writing a
label longer than three words, stop: there is almost certainly one word for it,
and the reader already knows that word.

Two words fewer with the same meaning is always better. A word everyone knows
beats a phrase you invented, every time.

## Never (the checker flags these)

These are the tells of AI copy. They are banned, not discouraged.

- **Cheerful interjections.** Oops, Whoops, Uh oh, Yay, Woohoo, Hooray, Boom,
  Voilà, Ta-da, "Great!", "Awesome", "Perfect!", "Nice!". A UI is not excited.
- **Exclamation marks.** Almost never warranted. The default is a full stop. If a
  line seems to need one, the line is trying too hard — rewrite it.
- **Hype and marketing verbs.** Unlock, supercharge, elevate, empower, streamline,
  seamless(ly), effortless(ly), leverage, revolutionise, turbocharge, "level up",
  "next-level", "game-chang…", delight. You are describing a tool, not selling it.
- **Servile softeners.** Simply, just, easily, quickly, "in seconds", "with just a
  few clicks", "don't worry". They pretend the thing is easier than it is and they
  talk down to the reader.
- **"Let's…"** — "Let's get started", "Let's set up your project". The app and the
  user are not a team on an adventure. Name the action: "Start a project".
- **Apology theatre.** "Oops, something went wrong", "Sorry about that". An error
  says what happened and what to do, without performing regret.
- **Explaining the obvious.** "Here you can…", "This screen lets you…", "This is
  where you…", "Use this to…". If the screen needs a sentence to explain what it
  obviously is, the screen is the problem, not the missing sentence.
- **Redundant qualifiers that state the obvious.** "in your own words", "if you
  like", "as you see fit", "however you want", "whatever you prefer". Of course it
  is their words and their choice. Cut the qualifier — it adds nothing and it
  reads as if the reader needed telling.
- **Clever phrasing that has to be decoded.** "It leads with the half you need and
  the other half is always one link away." A metaphor or a small riddle standing in
  for the plain fact. If the reader has to work out what a line means, it has
  failed. Say the plain thing.
- **A rule where a description belongs.** "Never take a message when no assistant is
  listening. Say so instead." reads like an instruction to the software, not a
  description for the person. Say what the PERSON experiences: "If nothing is
  listening, it tells you instead of losing your message." This one bites shape
  lines hardest — a want or a must-not written as an internal rule.
- **"You're all set" / "You're good to go" / "Sit back and relax" / "Happy
  building!"** Filler that says nothing.
- **Vague calls to action.** "Click here", "Submit", "Continue" where a real verb
  fits. A button says the action it does.
- **Title Case On Headings.** Sentence case. Only the first word and proper nouns
  are capitalised.
- **Emoji**, unless the user has explicitly asked for them.

## Always

- **Sentence case** everywhere — headings, buttons, labels.
- **Buttons are the conventional word, 1–3 words** (see THE FIRST RULE). Save,
  Delete, Cancel, Done, Add, Import. Only reach past the shared vocabulary when
  no common word fits, and then still stay to a short imperative — "Add", not
  "Add it to the board"; "Import", not "Bring it in". Never a description of the
  action.
- **Controls vs prose.** The one-to-three-word rule is for CONTROLS — buttons,
  menu items, tabs, tooltips, field labels. Explanatory PROSE — an empty state, a
  help line, an error — is still plain and in the owner's world, just concise: a
  short true sentence, no filler.
- **Empty states say two things: what will live here, and the one thing to do.**
  "No projects yet. Start one." Not "Nothing to see here!"
- **Errors say what happened and what to do**, plainly, in the user's world.
  "That didn't save. Try again." Not "Error: request failed" and not "Oops!".
- **Help text only if it adds something the label doesn't.** If it just restates
  the label, delete it.
- **The owner's world, not the builder's.** No commit, branch, merge, landed,
  worktree, endpoint, payload. The owner cares what a thing IS and whether it is
  good. (See `ui-copy-is-plain-speech` — this standard supersedes and extends it.)
- **Shortest ordinary words.** "Where is the code?" beats "Specify the repository
  location". If a shorter true word exists, use it.
- **Same-on-every-row is a heading, not content.** If a line is identical on every
  row of a list, say it once at the top and give each row what differs.

## Before → after

- "Oops! Something went wrong. Please try again." → "That didn't save. Try again."
- "You're all set! Your project is ready to go." → "Your project is ready." (or
  nothing — just show it).
- "Let's get started by naming your project." → "What's it called?"
- "Simply click below to seamlessly import your codebase." → "Bring your code in."
- "Here you can manage all of your projects in one place." → *(delete it — the
  page is the projects; it does not need announcing)*.
- "Submit" → "Create it" / "Save" / "Send" — whatever it actually does.
- "Awaiting Your Confirmation" → "Waiting on you".
- "Say what you want in your own words and it answers." → "Ask it anything about
  this." *(the "in your own words" is filler; they know)*.
- "Never take a message when no assistant is listening. Say so instead." → "If
  nothing is listening, it tells you rather than losing your message." *(describe
  the experience, not the rule)*.
- "It leads with the half you need and the other half is always one link away." →
  "Shows what you need first; the rest is one click away." *(say the plain thing)*.

## What the checker can and can't do

`check_copy.mjs` catches the mechanical sins above — the banned words, the
exclamation marks, the "Let's", the title case, the "click here". A clean run is
the floor, not the ceiling: it means the copy is free of the obvious tells, not
that it is good. **A human still reads it against the out-loud test.** The checker
tightens the screws so the reading is a light pass, not a rescue.

Run it on any user-facing string before it lands:

```
node scripts/check_copy.mjs <file>        # one string per line
printf '%s\n' "Oops! You're all set!" | node scripts/check_copy.mjs
```
