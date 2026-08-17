#!/usr/bin/env python3
"""Flag convoluted language in card text.

Usage:
    python check_language.py <file> [<file> ...]
    cat draft.md | python check_language.py

Checks text the user will read (cards, shapes, questions). Flags:
- filler words that say nothing
- sentences over 25 words
- more than one em-dash in a sentence

Exit code 1 if anything is flagged, 0 if clean. Fix every flag before
showing the draft to the user. The rule behind this: fewest and simplest
words that keep the meaning.
"""
import re
import sys

FILLER = [
    "utilize", "utilise", "leverage", "leveraging", "seamless", "seamlessly",
    "robust", "intuitive", "intuitively", "streamlined", "streamline",
    "holistic", "holistically", "comprehensive", "comprehensively",
    "empower", "empowering", "delightful", "delight", "frictionless",
    "effortless", "effortlessly", "elegant", "elegantly", "sophisticated",
    "cutting-edge", "best-in-class", "state-of-the-art", "world-class",
    "ecosystem", "paradigm", "synergy", "curated", "bespoke", "granular",
    "actionable", "facilitate", "facilitates", "in order to", "ensure that",
    "user experience", "booking experience", "journey",
]

# Method vocabulary — words from the decomposition method that must never
# appear on anything the user reads. They are bookkeeping, not card language.
METHOD_VOCAB = [
    "leaf", "leaves", "ancestor", "cascade", "inherits", "inherited",
    "umbrella", "taxonomy", "altitude", "lens", "carve", "carved",
    "materialize", "materialise", "cake rule", "scope fence", "fine print",
    "walk-question", "shaping pass", "intent_spec", "must-not register",
    "app-level facts register",
]

MAX_SENTENCE_WORDS = 25


def sentences(text):
    # crude but good enough: split on . ! ? followed by space/EOL
    for chunk in re.split(r"(?<=[.!?])\s+", text):
        chunk = chunk.strip()
        if chunk:
            yield chunk


def check(name, text):
    flags = []
    for i, line in enumerate(text.splitlines(), 1):
        low = line.lower()
        for w in FILLER:
            if w in low:
                flags.append(f"{name}:{i}: filler: '{w}' — delete it or say the thing plainly")
        for w in METHOD_VOCAB:
            if re.search(r"\b" + re.escape(w) + r"s?\b", low):
                flags.append(f"{name}:{i}: method vocabulary: '{w}' — this word is for the method, not the user. Say it plainly or drop it")
        # the entity is an ask, never a card ("credit card details" is fine)
        for m in re.finditer(r"\bcards?\b", low):
            ctx = low[max(0, m.start() - 12):m.end() + 12]
            if not re.search(r"(credit|debit|payment)\s+card|card\s+(details|number|payment)", ctx):
                flags.append(f"{name}:{i}: 'card' — the thing is an ask. Say 'ask'")
        if ";" in line:
            flags.append(f"{name}:{i}: semicolon — write two sentences instead")
    for s in sentences(re.sub(r"\s+", " ", text)):
        words = len(s.split())
        if words > MAX_SENTENCE_WORDS:
            flags.append(f"{name}: sentence with {words} words (max {MAX_SENTENCE_WORDS}): \"{s[:80]}...\" — split it")
        if s.count("—") > 1:
            flags.append(f"{name}: {s.count('—')} em-dashes in one sentence: \"{s[:80]}...\" — split it")
        if re.search(r",\s+(?:not|never)\s+\w", s) and words > 6:
            flags.append(f"{name}: 'X, not Y' construction: \"{s[:80]}...\" — say what it is, drop the contrast")
    return flags


def main():
    all_flags = []
    if len(sys.argv) > 1:
        for path in sys.argv[1:]:
            with open(path, encoding="utf-8") as f:
                all_flags += check(path, f.read())
    else:
        all_flags += check("stdin", sys.stdin.read())

    for f in all_flags:
        print(f)
    print(f"\n{len(all_flags)} flag(s)." if all_flags else "Clean.")
    sys.exit(1 if all_flags else 0)


if __name__ == "__main__":
    main()
