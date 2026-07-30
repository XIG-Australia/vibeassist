#!/usr/bin/env bash
# VibeAssist config + token check. Prints the VERDICT on line 1, then its own
# version on line 2 (so a session can tell an outdated copy from a current one
# without reading the file). Verdicts:
#   configured        — the CURRENT token is present AND valid
#   MISSING           — VIBEASSIST_URL / VIBEASSIST_TOKEN not set (env or file)
#   STALE             — this SESSION's env token is out of date (differs from the
#                       settings.json file), and the FILE token is VALID → RESTART
#                       the session/daemon to pick it up. Do NOT regenerate (the
#                       running process froze its env at start; a new token can't
#                       reach it).
#   REVOKED           — a token we ACTUALLY READ was rejected → regenerate in VA
#   CHECK_FAILED:<why>— the CHECK could not run. NOT a verdict on your token.
#   UNREACHABLE:<code|000> — couldn't reach VibeAssist (network/host issue)
#
# WHY read the file, not just $VIBEASSIST_TOKEN: Claude Code freezes env at
# session start, so a session (or the wake daemon / a worker it spawned) that
# began before a token change keeps the OLD token forever — validating only the
# env would print REVOKED for a perfectly valid current token and send the user
# into a pointless regenerate loop (the trap that cost hours on 2026-07-14).
#
# WHY CHECK_FAILED EXISTS (task a159bc99): the previous version did
# `CHECK_TOKEN="${FILE_TOKEN:-$VIBEASSIST_TOKEN}"` — so when it could NOT read
# settings.json (node absent, unparseable JSON, key missing) it silently fell
# back to the session's frozen env token and, if that old token 401'd, announced
# REVOKED. That is a false negative with a confident face: the real token in
# settings.json was fine (a hand curl to /whoami proved it), and the user gets
# sent to regenerate a token that was never broken. "I could not read your token"
# and "your token is rejected" are DIFFERENT ANSWERS and must never share a
# verdict. REVOKED is now only ever printed about a token we genuinely read.
VA_CHECK_VERSION=3
emit() { echo "$1"; echo "va-check-version: $VA_CHECK_VERSION"; exit 0; }

if ! command -v curl >/dev/null 2>&1; then emit "CHECK_FAILED:curl-not-installed"; fi
if [ -z "$VIBEASSIST_URL" ]; then emit "MISSING"; fi

SETTINGS="$HOME/.claude/settings.json"
FILE_TOKEN=""
FILE_STATUS="none" # none = no settings.json | ok | unreadable

if [ -f "$SETTINGS" ]; then
  if command -v node >/dev/null 2>&1; then
    FILE_TOKEN=$(node -e "try{process.stdout.write((JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).env||{}).VIBEASSIST_TOKEN||'')}catch(e){process.exit(3)}" "$SETTINGS" 2>/dev/null)
    if [ $? -ne 0 ]; then
      FILE_STATUS="unreadable" # settings.json exists but is not valid JSON
    elif [ -n "$FILE_TOKEN" ]; then
      FILE_STATUS="ok"
    fi
  else
    FILE_STATUS="unreadable" # no node → cannot parse the file at all
  fi
fi

# Pick the token AND remember where it came from — the source is what makes a
# 401 interpretable.
if [ "$FILE_STATUS" = "ok" ]; then
  CHECK_TOKEN="$FILE_TOKEN"
  SOURCE="file"
else
  CHECK_TOKEN="$VIBEASSIST_TOKEN"
  SOURCE="env"
fi
if [ -z "$CHECK_TOKEN" ]; then
  [ "$FILE_STATUS" = "unreadable" ] && emit "CHECK_FAILED:cannot-read-settings-json"
  emit "MISSING"
fi

code=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $CHECK_TOKEN" \
  "$VIBEASSIST_URL/api/public/claude/whoami")
case "$code" in
  200)
    # The token works. If this session's env copy differs from the file's, the
    # session is holding a stale token — a RESTART fixes it, not a regenerate.
    if [ "$SOURCE" = "file" ] && [ "$VIBEASSIST_TOKEN" != "$FILE_TOKEN" ]; then
      emit "STALE"
    fi
    emit "configured"
    ;;
  401 | 403)
    # Only call it REVOKED when we validated a token we actually READ. If the
    # file was unreadable we tested the session's frozen env token instead, and
    # a 401 on THAT says nothing about the real token — this is the exact case
    # that produced the 2026-07-16 false alarm.
    [ "$SOURCE" = "env" ] && [ "$FILE_STATUS" = "unreadable" ] &&
      emit "CHECK_FAILED:cannot-read-settings-json-tested-stale-env-token"
    emit "REVOKED"
    ;;
  *) emit "UNREACHABLE:$code" ;;
esac
