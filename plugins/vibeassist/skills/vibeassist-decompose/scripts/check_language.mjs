#!/usr/bin/env node
// Flag convoluted language in card text.
//
// Usage:
//     node check_language.mjs <file> [<file> ...]
//     cat draft.md | node check_language.mjs
//
// Faithful port of check_language.py. Match its stdout and exit codes
// byte-for-byte: exit 1 if anything is flagged, 0 if clean.

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
  "leaf", "leaves", "ancestor", "cascade", "inherits", "inherited",
  "umbrella", "taxonomy", "altitude", "lens", "carve", "carved",
  "materialize", "materialise", "cake rule", "scope fence", "fine print",
  "walk-question", "shaping pass", "intent_spec", "must-not register",
  "app-level facts register",
];

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
    // the entity is an ask, never a card ("credit card details" is fine)
    const cardRe = /\bcards?\b/g;
    let m;
    while ((m = cardRe.exec(low)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      const ctx = low.slice(Math.max(0, start - 12), end + 12);
      if (!/(credit|debit|payment)\s+card|card\s+(details|number|payment)/.test(ctx)) {
        flags.push(`${name}:${i}: 'card' — the thing is an ask. Say 'ask'`);
      }
      if (m[0].length === 0) cardRe.lastIndex++;
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
  return flags;
}

function main() {
  let allFlags = [];
  const argv = process.argv.slice(2);
  if (argv.length > 0) {
    for (const p of argv) {
      const raw = fs.readFileSync(p, "utf-8");
      allFlags = allFlags.concat(check(p, universalNewlines(raw)));
    }
  } else {
    const raw = fs.readFileSync(0, "utf-8");
    allFlags = allFlags.concat(check("stdin", universalNewlines(raw)));
  }

  let out = "";
  for (const f of allFlags) out += f + "\n";
  out += (allFlags.length ? `\n${allFlags.length} flag(s).` : "Clean.") + "\n";
  process.stdout.write(out);
  process.exit(allFlags.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
