#!/usr/bin/env node
// Flag convoluted language in card text.
//
// Usage:
//     node check_language.mjs <file> [<file> ...]
//     cat draft.md | node check_language.mjs
//
// Two kinds of output, and the difference matters:
//   FLAGS   — things that are wrong. Exit 1.
//   NOTICES — things a human has to look at, because no regex can settle
//             them. Exit code unaffected.
//
// It began as a byte-for-byte port of check_language.py. It is not one any
// more: the furniture-words notice and the dash-aside / vague-deferral flags
// came after the Python was retired.

import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const FILLER = [
  "utilize", "utilise", "leverage", "leveraging", "seamless", "seamlessly",
  "robust", "intuitive", "intuitively", "streamlined", "streamline",
  "holistic", "holistically", "comprehensive", "comprehensively",
  "empower", "empowering", "delightful", "delight", "frictionless",
  "effortless", "effortlessly", "elegant", "elegantly", "sophisticated",
  "cutting-edge", "best-in-class", "state-of-the-art", "world-class",
  "ecosystem", "paradigm", "synergy", "curated", "bespoke", "granular",
  "actionable", "facilitate", "facilitates", "in order to", "ensure that",
  "user experience", "booking experience", "journey",
];

// Method vocabulary — words from the decomposition method that must never
// appear on anything the user reads. They are bookkeeping, not card language.
const METHOD_VOCAB = [
  "ancestor", "cascade", "inherits", "inherited",
  "umbrella", "taxonomy", "altitude", "lens", "carve", "carved",
  "materialize", "materialise", "cake rule", "scope fence", "fine print",
  "walk-question", "shaping pass", "intent_spec", "must-not register",
  "app-level facts register",
];

// VibeAssist's own words for its workspace. On a shape they may only ever
// carry the APP's meaning — a gardening app's tree is a plant and its ask is
// a question, and both are correct there. What is never allowed is VA's board
// meaning leaking onto an app that is not a board.
//
// A regex cannot tell a garden tree from a board tree; they are the same
// token. So these are a NOTICE for a human eye, never a failure — hard-banning
// them would break every legitimate gardening, forestry or to-do app.
const FURNITURE = ["ask", "tree", "board", "branch", "leaf", "leaves", "room", "card"];

// Say where it happens, or drop the clause. A deferral that names no place is
// the shape admitting it does not know.
const VAGUE_DEFERRAL = [
  "somewhere else", "happens elsewhere", "handled elsewhere", "done elsewhere",
];

// A clause hung off an em-dash at the END of a line: "… — that happens
// somewhere else." Give it its own sentence or delete it.
//
// It must run to the end of the line to count. An em-dash with a finished
// sentence after it is ordinary punctuation, not an afterthought, so the
// clause may hold at most its own closing full stop.
const DASH_ASIDE = /—\s*[^—.!?]*[^—.!?\s][^—.!?]*[.!?]?\s*$/;

const MAX_SENTENCE_WORDS = 25;

// --- Python string semantics helpers -------------------------------------

// Python text-mode read (newline=None) translates \r\n and lone \r to \n.
function universalNewlines(s) {
  return s.replace(/\r\n?/g, "\n");
}

// Python str.splitlines() (keepends=False). Line boundaries per CPython:
// \n \r \r\n \v \f \x1c \x1d \x1e \x85 \u2028 \u2029. Built with new RegExp
const LINE_BOUNDARY = new RegExp("\\r\\n|[\\n\\r\\v\\f\\x1c\\x1d\\x1e\\x85\\u2028\\u2029]", "g");
function pySplitlines(s) {
  const out = [];
  let last = 0;
  LINE_BOUNDARY.lastIndex = 0;
  let m;
  while ((m = LINE_BOUNDARY.exec(s)) !== null) {
    out.push(s.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[0].length === 0) LINE_BOUNDARY.lastIndex++;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

// Python str.split() with no args: split on runs of whitespace, drop empties.
function pySplitWhitespace(s) {
  const t = s.trim();
  if (t === "") return [];
  return t.split(/\s+/);
}

// Python code-point slice s[:n].
function cpSlice(s, n) {
  return Array.from(s).slice(0, n).join("");
}

// Python re.escape(): escape exactly the chars CPython escapes.
const RE_SPECIAL = new Set("()[]{}?*+-|^$\\.&~# \t\n\r\f");
function reEscape(s) {
  let out = "";
  for (const ch of s) out += RE_SPECIAL.has(ch) ? "\\" + ch : ch;
  return out;
}

function countChar(s, ch) {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

// --- checks --------------------------------------------------------------

function* sentences(text) {
  // crude but good enough: split on . ! ? followed by space/EOL
  for (let chunk of text.split(/(?<=[.!?])\s+/)) {
    chunk = chunk.trim();
    if (chunk) yield chunk;
  }
}

function check(name, text) {
  const flags = [];
  const notices = [];
  const lines = pySplitlines(text);
  for (let idx = 0; idx < lines.length; idx++) {
    const i = idx + 1;
    const line = lines[idx];
    const low = line.toLowerCase();
    for (const w of FILLER) {
      if (low.includes(w)) {
        flags.push(`${name}:${i}: filler: '${w}' — delete it or say the thing plainly`);
      }
    }
    for (const w of METHOD_VOCAB) {
      if (new RegExp("\\b" + reEscape(w) + "s?\\b").test(low)) {
        flags.push(`${name}:${i}: method vocabulary: '${w}' — this word is for the method, not the user. Say it plainly or drop it`);
      }
    }
    for (const w of VAGUE_DEFERRAL) {
      if (low.includes(w)) {
        flags.push(`${name}:${i}: vague deferral: '${w}' — say WHERE it happens, or delete the clause`);
      }
    }
    if (DASH_ASIDE.test(line.replace(/\s+$/, ""))) {
      flags.push(`${name}:${i}: dash-aside: "${cpSlice(line.trim(), 80)}" — the clause after the em-dash is an afterthought. Give it its own sentence or drop it`);
    }
    // Furniture words are a NOTICE, never a flag — see FURNITURE above.
    // "credit card details" is the app's meaning too, so it needs no notice.
    for (const w of FURNITURE) {
      if (!new RegExp("\\b" + reEscape(w) + "(?:s|es)?\\b").test(low)) continue;
      if (w === "card" && /(credit|debit|payment)\s+card|card\s+(details|number|payment)/.test(low)) {
        continue;
      }
      notices.push(`${name}:${i}: '${w}' is one of VibeAssist's own words — is this the APP's meaning, or ours? Ours must never appear on a shape`);
    }
    if (line.includes(";")) {
      flags.push(`${name}:${i}: semicolon — write two sentences instead`);
    }
  }
  for (const s of sentences(text.replace(/\s+/g, " "))) {
    const words = pySplitWhitespace(s).length;
    if (words > MAX_SENTENCE_WORDS) {
      flags.push(`${name}: sentence with ${words} words (max ${MAX_SENTENCE_WORDS}): "${cpSlice(s, 80)}..." — split it`);
    }
    const dashes = countChar(s, "—");
    if (dashes > 1) {
      flags.push(`${name}: ${dashes} em-dashes in one sentence: "${cpSlice(s, 80)}..." — split it`);
    }
    if (/,\s+(?:not|never)\s+\w/.test(s) && words > 6) {
      flags.push(`${name}: 'X, not Y' construction: "${cpSlice(s, 80)}..." — say what it is, drop the contrast`);
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
    for (const p of argv) {
      const raw = fs.readFileSync(p, "utf-8");
      take(check(p, universalNewlines(raw)));
    }
  } else {
    const raw = fs.readFileSync(0, "utf-8");
    take(check("stdin", universalNewlines(raw)));
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
  // Notices never fail the run. Only a human can settle them.
  process.exit(allFlags.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
