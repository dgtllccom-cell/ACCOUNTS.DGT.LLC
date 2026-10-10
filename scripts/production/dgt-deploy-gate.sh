#!/usr/bin/env bash
# DGT ERP — PRODUCTION DEPLOY GATE (runs ON the VPS; the ONLY supported way to change what the live server runs).
#
#   dgt-deploy [--dry-run]        deploys exactly the commit the owner approved with dgt-approve-deploy, nothing else.
#
# It refuses unless ALL of these hold:
#   1. an approval file exists, is not expired and has not been used (one deployment per approval);
#   2. the approved commit is on origin/production (the protected release branch) — never main, never a feature branch;
#   3. if the commit adds database migration files, the approval says so explicitly (--migrations) — migrations are reviewed separately;
#   4. a fresh database backup could be taken and listed (when BACKUP_CMD is configured);
#   5. nobody else is deploying (lock).
# Then it moves the working tree to that commit, builds with scripts/safe-build-deploy.sh (atomic swap, rollback kept) and writes an audit line.
# Rollback:  dgt-deploy --rollback   (restores the previous build; the database is never touched by this script).
#
# Environment overrides exist only so scripts/production/test-gate.sh can exercise every branch without touching a real server.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/dgt-nextjs}"
APPROVAL_FILE="${APPROVAL_FILE:-/etc/dgt-deploy/approved}"
AUDIT_LOG="${AUDIT_LOG:-/var/log/dgt-deploy.log}"
RELEASE_BRANCH="${RELEASE_BRANCH:-production}"
BACKUP_CMD="${BACKUP_CMD:-}"            # e.g. 'pg_dump "$DATABASE_URL" --schema=public --no-owner -Fc -f "$BACKUP_FILE"'
BUILD_CMD="${BUILD_CMD:-bash scripts/safe-build-deploy.sh}"
LOCK_DIR="${LOCK_DIR:-/tmp/dgt-deploy.lock}"
DRY=0; ROLLBACK=0
for a in "$@"; do case "$a" in --dry-run) DRY=1;; --rollback) ROLLBACK=1;; *) echo "unknown option $a"; exit 2;; esac; done

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$AUDIT_LOG" >&2; }
die() { log "REFUSED: $*"; exit 1; }

cd "$APP_DIR"
mkdir "$LOCK_DIR" 2>/dev/null || die "another deployment is running (lock $LOCK_DIR)"
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

if [ "$ROLLBACK" = 1 ]; then
  log "rollback requested by ${SUDO_USER:-${USER:-?}}"
  [ "$DRY" = 1 ] && { log "dry-run: would run: $BUILD_CMD --rollback"; exit 0; }
  eval "$BUILD_CMD --rollback"; log "rollback done"; exit 0
fi

[ -f "$APPROVAL_FILE" ] || die "no approval file ($APPROVAL_FILE). The owner must approve a commit first (dgt-approve-deploy)."
# shellcheck disable=SC1090
sha=""; expires=0; migrations="no"; approved_by="?"; used="no"
while IFS='=' read -r k v; do case "$k" in sha) sha="$v";; expires) expires="$v";; migrations) migrations="$v";; approved_by) approved_by="$v";; used) used="$v";; esac; done < "$APPROVAL_FILE"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "approval file has no valid 40-character commit id"
[ "$used" = "no" ] || die "this approval was already used (one deployment per approval)"
[ "$(date +%s)" -le "$expires" ] || die "approval expired"

git fetch -q origin "$RELEASE_BRANCH" || die "cannot fetch origin/$RELEASE_BRANCH"
git cat-file -e "$sha^{commit}" 2>/dev/null || die "approved commit $sha is not in the repository"
git merge-base --is-ancestor "$sha" "origin/$RELEASE_BRANCH" || die "approved commit is not on origin/$RELEASE_BRANCH — only the protected release branch can be deployed"

current="$(git rev-parse HEAD)"
new_migs="$(git diff --name-only --diff-filter=AM "$current" "$sha" -- supabase/migrations 2>/dev/null || true)"
if [ -n "$new_migs" ] && [ "$migrations" != "yes" ]; then
  die "the commit adds database migrations ($(echo "$new_migs" | wc -l) file(s)); the approval does not allow migrations. Review them and approve with --migrations."
fi
log "approved by $approved_by: $current -> $sha (migrations: ${new_migs:+$(echo "$new_migs" | tr '\n' ' ')}${new_migs:-none})"

if [ "$DRY" = 1 ]; then log "dry-run: all checks passed, nothing changed"; exit 0; fi

if [ -n "$BACKUP_CMD" ]; then
  export BACKUP_FILE="${BACKUP_DIR:-/root/backups}/prod-before-deploy-$(date +%Y%m%d-%H%M%S).dump"
  mkdir -p "$(dirname "$BACKUP_FILE")"
  eval "$BACKUP_CMD" || die "backup failed — deployment stopped before anything changed"
  [ -s "$BACKUP_FILE" ] || die "backup file is empty — deployment stopped before anything changed"
  log "backup ok: $BACKUP_FILE ($(wc -c < "$BACKUP_FILE") bytes)"
fi

# consume the approval BEFORE building, so a crash can never allow a silent second run
tmp="$(mktemp)"; sed 's/^used=.*/used=yes/' "$APPROVAL_FILE" > "$tmp"; grep -q '^used=' "$tmp" || echo "used=yes" >> "$tmp"; cat "$tmp" > "$APPROVAL_FILE"; rm -f "$tmp"

DGT_DEPLOY_GATE=1 git reset --hard "$sha" >/dev/null   # DGT_DEPLOY_GATE lets the live-checkout ref lock (ref-lock-hook.sh) accept this one move
log "building $sha"
eval "$BUILD_CMD" || { log "BUILD FAILED — live site unchanged (safe-build-deploy keeps the old build). Tree is at $sha; run dgt-deploy --rollback if needed."; exit 1; }
log "DEPLOYED $sha"
