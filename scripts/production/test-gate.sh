#!/usr/bin/env bash
# Exercises dgt-deploy-gate.sh / dgt-approve-deploy.sh in a throw-away sandbox (temp bare repo + clone, fake build + fake backup).
# It never touches any real server or the real repository:   bash scripts/production/test-gate.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
git init -q --bare "$T/origin.git"
git clone -q "$T/origin.git" "$T/work" 2>/dev/null; cd "$T/work"
git checkout -q -b main; mkdir -p supabase/migrations; echo v1 > app.txt; git add -A; git commit -qm c1; git push -q origin main 2>/dev/null
git checkout -q -b production; git push -q origin production 2>/dev/null
C1="$(git rev-parse HEAD)"
git checkout -q main; echo v2 > app.txt; git commit -qam c2 ; git push -q origin main 2>/dev/null; C2_MAIN_ONLY="$(git rev-parse HEAD)"   # on main, NOT on production
git checkout -q production; echo v3 > app.txt; git commit -qam c3; git push -q origin production 2>/dev/null; C3="$(git rev-parse HEAD)"
echo m > supabase/migrations/20270101_x.sql; git add -A; git commit -qm c4-migration; git push -q origin production 2>/dev/null; C4_MIG="$(git rev-parse HEAD)"
git clone -q "$T/origin.git" "$T/live" 2>/dev/null; cd "$T/live"; git checkout -q "$C1"      # the "live server" checkout, running C1
export APP_DIR="$T/live" APPROVAL_FILE="$T/etc/approved" AUDIT_LOG="$T/audit.log" LOCK_DIR="$T/lock" RELEASE_BRANCH=production BACKUP_DIR="$T/bk"
export BUILD_CMD="echo BUILD-RAN >> $T/build.log" BACKUP_CMD='echo dump > "$BACKUP_FILE"'
pass=0; fail=0
ok()   { if [ "$1" = "$2" ]; then pass=$((pass+1)); echo "PASS  $3"; else fail=$((fail+1)); echo "FAIL  $3 (got $1, wanted $2)"; fi; }
run()  { bash "$HERE/dgt-deploy-gate.sh" "$@" >/dev/null 2>&1; echo $?; }
live() { git -C "$T/live" rev-parse HEAD; }

ok "$(run)" 1 "no approval file → refused"
bash "$HERE/dgt-approve-deploy.sh" "$C2_MAIN_ONLY" >/dev/null 2>&1; ok "$?" 1 "approving a commit that is only on main → refused"
ok "$(live)" "$C1" "…and the live checkout did not move"
bash "$HERE/dgt-approve-deploy.sh" "$C3" --hours 4 >/dev/null 2>&1; ok "$?" 0 "approving a production-branch commit works"
ok "$(run --dry-run)" 0 "dry run passes all checks"
ok "$(live)" "$C1" "dry run changed nothing"
ok "$(run)" 0 "approved commit deploys"
ok "$(live)" "$C3" "live checkout is at the approved commit"
ok "$(test -s "$T/build.log" && echo yes)" yes "build ran"
ok "$(ls "$T/bk" 2>/dev/null | wc -l | tr -d ' ')" 1 "a backup was taken first"
ok "$(run)" 1 "replaying the same approval → refused (one-shot)"
bash "$HERE/dgt-approve-deploy.sh" "$C4_MIG" >/dev/null 2>&1
ok "$(run)" 1 "commit that adds a migration, approved WITHOUT --migrations → refused"
ok "$(live)" "$C3" "…and the live checkout did not move"
bash "$HERE/dgt-approve-deploy.sh" "$C4_MIG" --migrations >/dev/null 2>&1
ok "$(run)" 0 "same commit approved WITH --migrations → deploys"
printf 'sha=%s\nexpires=%s\nmigrations=no\napproved_by=x\nused=no\n' "$C1" "$(( $(date +%s) - 10 ))" > "$APPROVAL_FILE"
ok "$(run)" 1 "expired approval → refused"
printf 'sha=%s\nexpires=%s\nmigrations=no\napproved_by=x\nused=no\n' "deadbeef" "$(( $(date +%s) + 999 ))" > "$APPROVAL_FILE"
ok "$(run)" 1 "malformed commit id → refused"
bash "$HERE/dgt-approve-deploy.sh" "$C3" >/dev/null 2>&1
export BACKUP_CMD='false'; before="$(live)"
ok "$(run)" 1 "backup failure → deployment stopped"
ok "$(live)" "$before" "…before anything changed"
export BACKUP_CMD='echo dump > "$BACKUP_FILE"'; mkdir "$T/lock"
ok "$(run)" 1 "a second deployment while one runs → refused (lock)"; rmdir "$T/lock"
ok "$(run --rollback)" 0 "rollback path runs the rollback command"

# --- approval race (2026-11-22: a second approval written during the backup replaced the owner's; the build guard then refused)
approve() { bash "$HERE/dgt-approve-deploy.sh" "$@" >/dev/null 2>&1; echo $?; }
rm -f "$APPROVAL_FILE"; mkdir "$T/lock"
ok "$(approve "$C3")" 1 "approving while a deployment runs (lock held) → refused"
rmdir "$T/lock"
ok "$(approve "$C3")" 0 "approve C3"
ok "$(approve "$C1")" 1 "approving another commit over a pending approval → refused"
ok "$(grep -c "^sha=$C3" "$APPROVAL_FILE")" 1 "…and the pending approval is still C3"
ok "$(approve "$C3")" 0 "re-approving the same commit is allowed"
ok "$(approve "$C1" --replace)" 0 "--replace replaces a pending approval on purpose"
ok "$(approve "$C3" --replace)" 0 "approve C3 again (--replace)"
before="$(live)"; : > "$T/build.log"
export BACKUP_CMD="echo dump > \"\$BACKUP_FILE\"; printf 'sha=$C1\nexpires=9999999999\nmigrations=no\napproved_by=intruder\nused=no\n' > \"$APPROVAL_FILE\""
ok "$(run)" 1 "approval swapped during the backup → deployment stopped"
ok "$(live)" "$before" "…the live checkout did not move"
ok "$(test -s "$T/build.log" && echo ran || echo none)" none "…and no build ran"
export BACKUP_CMD='echo dump > "$BACKUP_FILE"'
ok "$(approve "$C3" --replace)" 0 "owner approves again"
ok "$(run)" 0 "…and the deployment now succeeds"
ok "$(grep -c '^used=yes' "$APPROVAL_FILE")" 1 "the consumed approval names the deployed commit (used=yes)"
ok "$(grep -c "^sha=$(live)" "$APPROVAL_FILE")" 1 "…which is the live checkout's commit"
ok "$(grep -q "approved $C3" "$AUDIT_LOG" && grep -q "approve REFUSED (pending approval $C3)" "$AUDIT_LOG" && echo yes)" yes "approvals and refused approvals are written to the audit log"
echo; echo "==== $pass PASS / $fail FAIL ===="; [ "$fail" = 0 ]
