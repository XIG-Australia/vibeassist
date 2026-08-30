#!/usr/bin/env node
// Flag moron-English in UI copy — the words a user reads on a screen.
//
// Sibling to check_language.mjs, which guards board/shape text. This one guards
// the strings the app SHOWS: buttons, headings, empty states, errors,
// placeholders. The standard it enforces the mechanical half of is
// references/ui-copy-standard.md.
//
// Usage:
//     node check_copy.mjs <file> [<file> ...]   # one user-facing string per line
//     printf '%s\n' "Oops! You're all set!" | node check_copy.mjs
//
// Two kinds of output, and the difference matters:
//   FLAGS   — near-certain sins. Exit 1. A clean run is the FLOOR, not proof the
//             copy is good — a human still reads it against the out-loud test.
//   NOTICES — context-dependent. A human settles them. Exit code unaffected.

import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// Whole-word, case-insensitive. The tells that are almost never right in a UI.
const FLAG_WORDS = [
  // cheerful interjections — a UI is not excited
  "oops", "whoops", "uh oh", "uh-oh", "yay", "woohoo", "woo-hoo", "hooray",
  "hurray", "yikes", "voila", "voilà", "ta-da", "ta da", "kaboom", "awesome",
  // hype / marketing
  "unlock", "supercharge", "supercharged", "elevate", "empower", "empowering",
  "streamline", "streamlined", "seamless", "seamlessly", "effortless",
  "effortlessly", "leverage", "revolutionise", "revolutionize", "turbocharge",
  "frictionless", "delight", "delightful", "next-level", "game-changer",
  "game-changing",
  // servile softeners
  "simply", "in seconds",
  // apology theatre
  "sorry", "apologise", "apologize", "apologies",
];

// Phrases (substring, case-insensitive). Filler and stock chatbot lines.
const FLAG_PHRASES = [
  "let's", "let us",
  "something went wrong", "our bad", "my bad",
  "you're all set", "youre all set", "you're good to go", "sit back and relax",
  "few clicks", "a few clicks", "level up",
  "click here", "tap here", "click below", "tap below",
  "happy building", "happy to help",
];

// Line STARTS with one of these → explaining the obvious. The screen should not
// need a sentence announcing what it plainly is.
const FLAG_OPENERS = [
  "here you can", "here's where", "heres where", "this screen", "this page",
  "this is where", "use this to", "in this section", "welcome to",
];

// Context-dependent — a human decides. Sometimes fine, often a tell.
const NOTICE_WORDS = [
  "just", "easily", "quickly", "quick", "please", "kindly", "submit",
  "continue", "get started", "learn more", "read more",
];

// Any exclamation mark is a flag on its own — see the standard.
const EXCLAMATION = /!/;

// A rough Title Case heading: a short line, no sentence punctuation, with three
// or more Capitalised (not ALL-CAPS) words. Catches "Awaiting Your Confirmation"
// / "Start A New Project" while sparing normal sentences, which carry lowercase
// words. A NOTICE, because a real name ("VibeAssist Project") trips it too.
function looksTitleCase(line) {
  const t = line.trim();
  if (t === "" || /[.?]$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 8) return false;
  const capped = words.filter((w) => /^[A-Z][a-z]+$/.test(w)).length;
  return capped >= 3;
}

// A button or label written as a description instead of the common word — the
// "more words than meaning" failure ("Place it where it can be retrieved later"
// for Save; "See what came back"). A regex can't know a string is a button, and
// it can't know the one right word, so this is a NOTICE tuned to the shape:
// short enough to be a control, no sentence punctuation, and more than three
// words. Body sentences (which end in . ? !) and one-to-three-word labels are
// left alone. Role-tagged extraction will let this become a hard rule later.
function looksLikeLongLabel(line) {
  const t = line.trim();
  if (t === "" || t.length > 40 || /[.?!]$/.test(t)) return false;
  return t.split(/\s+/).length >= 4;
}

// A broad sweep for emoji — a NOTICE unless the owner asked for them.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word test that also handles multi-word tokens ("uh oh") and hyphens.
function hasWord(low, word) {
  return new RegExp("(?:^|[^a-z0-9])" + reEscape(word) + "(?:[^a-z0-9]|$)", "i").test(
    low,
  );
}

function check(name, text) {
  const flags = [];
  const notices = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.trim() === "") continue;
    const i = idx + 1;
    const low = line.toLowerCase();
    const where = `${name}:${i}`;

    if (EXCLAMATION.test(line)) {
      flags.push(`${where}: exclamation mark — a UI is not excited. Use a full stop`);
    }
    for (const w of FLAG_WORDS) {
      if (hasWord(low, w)) {
        flags.push(`${where}: '${w}' — chatbot tell. Say the plain thing (ui-copy-standard § Never)`);
      }
    }
    for (const p of FLAG_PHRASES) {
      if (low.includes(p)) {
        flags.push(`${where}: '${p}' — filler / stock line. Cut it or name the action`);
      }
    }
    for (const o of FLAG_OPENERS) {
      if (low.trimStart().startsWith(o)) {
        flags.push(`${where}: opens with '${o}…' — explaining the obvious. Delete the sentence`);
      }
    }

    for (const w of NOTICE_WORDS) {
      if (hasWord(low, w)) {
        notices.push(`${where}: '${w}' — often a tell. Is it earning its place, or servile filler?`);
      }
    }
    if (looksLikeLongLabel(line)) {
      notices.push(`${where}: "${line.trim()}" — if this is a button or label, it's a description, not the word. Is there one common word for it (Save, Delete, Open…)?`);
    }
    if (looksTitleCase(line)) {
      notices.push(`${where}: "${line.trim().slice(0, 60)}" looks Title Case — UI copy is sentence case (unless it's a name)`);
    }
    if (EMOJI.test(line)) {
      notices.push(`${where}: emoji — only if the owner asked for them`);
    }
  }

  return { flags, notices };
}

function main() {
  let allFlags = [];
  let allNotices = [];
  const take = (r) => {
    allFlags = allFlags.concat(r.flags);
    allNotices = allNotices.concat(r.notices);
  };

  const argv = process.argv.slice(2);
  if (argv.length > 0) {
    for (const p of argv) take(check(p, fs.readFileSync(p, "utf-8")));
  } else {
    take(check("stdin", fs.readFileSync(0, "utf-8")));
  }

  let out = "";
  for (const f of allFlags) out += f + "\n";
  out += (allFlags.length ? `\n${allFlags.length} flag(s).` : "Clean.") + "\n";
  if (allNotices.length) {
    out += "\n";
    for (const n of allNotices) out += n + "\n";
    out += `\n${allNotices.length} notice(s) — read each one. They are not failures.\n`;
  }
  process.stdout.write(out);
  process.exit(allFlags.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
