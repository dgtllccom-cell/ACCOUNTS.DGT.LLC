#!/usr/bin/env bash
# Sandbox test of the ref lock (temp repos only):  bash scripts/production/test-ref-lock.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
git init -q --bare "$T/o.git"; git clone -q "$T/o.git" "$T/w" 2>/dev/null; cd "$T/w"; git checkout -q -b main; echo 1 > a; git add a; git commit -qm c1; git push -q origin main 2>/dev/null
git clone -q -b main "$T/o.git" "$T/live" 2>/dev/null; cd "$T/w"; echo 2 > a; git commit -qam c2; git push -q origin main 2>/dev/null
cd "$T/live"
# reproduce the real live checkout: a tracked .githooks dir and core.hooksPath=.githooks (git then ignores .git/hooks entirely)
mkdir -p .githooks; printf '#!/bin/sh\nexit 0\n' > .githooks/pre-commit; chmod +x .githooks/pre-commit; git config core.hooksPath .githooks
export LOCK_DIR="$T/lockdir" SAVED="$T/saved/prev"
APP_DIR="$T/live" bash "$HERE/install-ref-lock.sh" install >/dev/null
pass=0; fail=0; ok(){ if [ "$1" = "$2" ]; then pass=$((pass+1)); echo "PASS  $3"; else fail=$((fail+1)); echo "FAIL  $3 (got $1 wanted $2)"; fi; }
before="$(git rev-parse HEAD)"
ok "$(basename "$(git config core.hooksPath)")" "lockdir" "core.hooksPath points at the root-owned lock dir"
git fetch -q origin 2>/dev/null; ok "$?" 0 "fetch is allowed"
git pull -q --ff-only origin main >/dev/null 2>&1; [ "$?" != 0 ] && rc=refused || rc=allowed; ok "$rc" refused "git pull --ff-only is refused"
git reset -q --hard origin/main >/dev/null 2>&1; [ "$?" != 0 ] && rc=refused || rc=allowed; ok "$rc" refused "git reset --hard origin/main is refused"
git checkout -q -b other >/dev/null 2>&1; [ "$?" != 0 ] && rc=refused || rc=allowed; ok "$rc" refused "creating/switching a branch is refused"
ok "$(git rev-parse HEAD)" "$before" "live HEAD did not move"
# a tracked .githooks/reference-transaction pushed by an attacker/agent cannot replace the lock
mkdir -p .githooks; printf '#!/bin/sh\nexit 0\n' > .githooks/reference-transaction; chmod +x .githooks/reference-transaction
git reset -q --hard origin/main >/dev/null 2>&1; [ "$?" != 0 ] && rc=refused || rc=allowed; ok "$rc" refused "a repo-supplied hook file does not bypass the lock"
rm -f .githooks/reference-transaction
DGT_DEPLOY_GATE=1 git reset -q --hard origin/main >/dev/null 2>&1; ok "$?" 0 "the gate (DGT_DEPLOY_GATE=1) may move HEAD"
ok "$(git rev-parse HEAD)" "$(git rev-parse origin/main)" "…and it did"
APP_DIR="$T/live" bash "$HERE/install-ref-lock.sh" remove >/dev/null
ok "$(git config core.hooksPath)" ".githooks" "remove restores the previous core.hooksPath"
git reset -q --hard HEAD~1 >/dev/null 2>&1; ok "$?" 0 "after removing the lock, git works normally again"
echo "==== $pass PASS / $fail FAIL ===="; [ "$fail" = 0 ]
