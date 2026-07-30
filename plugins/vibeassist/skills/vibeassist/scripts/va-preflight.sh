#!/usr/bin/env bash
# VibeAssist environment preflight — one line per tool: "<tool>: ok|MISSING".
for t in git gh bun npm node; do
  if command -v "$t" >/dev/null 2>&1; then echo "$t: ok"; else echo "$t: MISSING"; fi
done
