#!/usr/bin/env bash
# Sandbox test of require-approved-commit.sh (temp repo + temp approval file only):  bash scripts/production/test-require-approved.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
git init -q "$T/r"; cd "$T/r"; echo 1 > a; git add a; git commit -qm c1; c1="$(git rev-parse HEAD)"; echo 2 > a; git commit -qam c2; c2="$(git rev-parse HEAD)"
mkdir -p "$T/etc"; export APPROVAL_FILE="$T/etc/approved"
pass=0; fail=0; ok(){ if [ "$1" = "$2" ]; then pass=$((pass+1)); echo "PASS  $3"; else fail=$((fail+1)); echo "FAIL  $3 (got $1 wanted $2)"; fi; }
run(){ bash "$HERE/require-approved-commit.sh" "$T/r" >/dev/null 2>&1; echo $?; }
now=$(date +%s)
APPROVAL_FILE="$T/nodir/approved" bash "$HERE/require-approved-commit.sh" "$T/r" >/dev/null 2>&1; ok "$?" 0 "no gate on this machine (DEV/CI): allowed"
ok "$(run)" 1 "gated server, no approval file: refused"
printf 'sha=%s\nexpires=%s\nused=yes\n' "$c2" "$((now+600))" > "$APPROVAL_FILE"; ok "$(run)" 0 "HEAD is the approved, consumed, unexpired commit: allowed"
printf 'sha=%s\nexpires=%s\nused=yes\n' "$c1" "$((now+600))" > "$APPROVAL_FILE"; ok "$(run)" 1 "a runner moved HEAD to a different commit than the approved one: refused"
printf 'sha=%s\nexpires=%s\nused=no\n' "$c2" "$((now+600))" > "$APPROVAL_FILE"; ok "$(run)" 1 "approval not consumed by dgt-deploy: refused"
printf 'sha=%s\nexpires=%s\nused=yes\n' "$c2" "$((now-5))" > "$APPROVAL_FILE"; ok "$(run)" 1 "expired approval: refused"
echo "==== $pass PASS / $fail FAIL ===="; [ "$fail" = 0 ]
