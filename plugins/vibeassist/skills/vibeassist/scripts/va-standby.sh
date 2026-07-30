#!/usr/bin/env bash
# VibeAssist standby long-poll (STANDBY variant: no sprint wakes).
# Prints updates JSON when actionable; exits. Bounded rounds so a quiet period
# exits cleanly; transient failures (empty/error responses) retry briefly.
#
# WORKER variant: identical except the comment header says WORKER variant and
# the curl URL ends `updates?wait=25&sprints=1` (append `&sprints=1` — nothing
# else changes). See references/listening-roles.md for when each applies.
BASE="${VIBEASSIST_URL%/}"
if [ -z "$BASE" ] || [ -z "$VIBEASSIST_TOKEN" ]; then
  echo "STANDBY ERROR: missing VIBEASSIST_URL or VIBEASSIST_TOKEN"; exit 0
fi
i=0
fail_streak=0
while [ "$i" -lt 15 ]; do
  # --max-time 30: a hung connection must never outlive the round — one stuck
  # curl would blow the harness's ~10-min command cap and get the whole loop
  # killed from outside, which reads as a mystery stop.
  r=$(curl -sL --max-time 30 -H "Authorization: Bearer $VIBEASSIST_TOKEN" "$BASE/api/public/claude/updates?wait=25")
  case "$r" in
    *'"actionable":true'*) echo "$r"; exit 0 ;;
    *'"ok":true'*) fail_streak=0 ;;
    *)
      fail_streak=$((fail_streak + 1))
      if [ "$fail_streak" -ge 3 ]; then
        echo "STANDBY TRANSIENT: 3 consecutive failed polls; last: ${r:0:300}"; exit 0
      fi
      sleep 5 ;;
  esac
  i=$((i+1))
done
echo '{"ok":true,"actionable":false,"round_complete":true}'; exit 0
