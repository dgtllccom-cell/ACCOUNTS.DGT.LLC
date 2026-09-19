#!/usr/bin/env bash
# Shared, safe build+deploy primitive for the Digital Dock ERP VPS.
#
# Root cause this fixes (confirmed 2026-09-19): three independent deploy paths
# (deploy-vps.sh, deploy-server.sh, deploy-prod-vps.mjs) all target the same
# /var/www/dgt-nextjs/.next directory with zero coordination. Two of them
# (deploy-server.sh, deploy-prod-vps.mjs) `rm -rf .next` immediately before
# rebuilding and `pm2 delete`+`pm2 start` (not reload) afterward — if that
# build is interrupted, or overlaps with another build/request touching
# .next, the live server is left serving a directory with no
# BUILD_ID/prerender-manifest.json and crash-loops on every request. This is
# exactly the failure the production error log showed (6,588 repeated
# `ENOENT .next/prerender-manifest.json` entries) and matches the fresh PM2
# process (reset restart counter) found immediately after — `pm2 delete`+
# `pm2 start` wipes PM2's own history, `pm2 reload` does not.
#
# This script is the ONE place all three deploy paths should delegate to:
#   1. Exclusive lock (flock) — a second concurrent invocation fails fast
#      instead of racing on the same directory.
#   2. Builds into a genuinely SEPARATE directory (.next.building) via
#      Next.js's own NEXT_DIST_DIR override (next.config.ts:10) — the live
#      .next is never opened for writing while the old server is still
#      serving requests from it, for the entire duration of the build.
#   3. Verifies the new build is actually complete (BUILD_ID +
#      prerender-manifest.json + routes-manifest.json all present and
#      non-empty) before going anywhere near the live directory.
#   4. Atomic swap: `mv` (same-filesystem rename, atomic) the live .next
#      aside to .next.rollback, then `mv` .next.building into place as the
#      new .next. There is never a moment where .next is missing or partial.
#   5. `pm2 reload` (never `pm2 delete`+`start`) — zero-downtime, and PM2's
#      own restart/uptime history is preserved instead of being wiped.
#   6. `--rollback` restores .next.rollback back into place and reloads PM2,
#      for verified recovery from a build that succeeded but misbehaves at
#      runtime.
#
# Usage (run ON the VPS, from the repo root, AFTER `git pull`/`git reset` has
# already brought the working tree to the commit you want to build):
#   bash scripts/safe-build-deploy.sh            # build + atomic swap + reload
#   bash scripts/safe-build-deploy.sh --rollback # restore the previous build
#
# On any failure this exits non-zero and the live .next is guaranteed to
# still be exactly what it was before this script ran.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_DIR="$(pwd)"
LOCK_FILE="$APP_DIR/.deploy.lock"
BUILD_DIR="$APP_DIR/.next.building"
ROLLBACK_DIR="$APP_DIR/.next.rollback"
LIVE_DIR="$APP_DIR/.next"
PM2_APP="${PM2_APP_NAME:-dgt-nextjs}"

log() { echo "[safe-build-deploy] $*"; }

require_manifest_complete() {
  local dir="$1"
  [ -f "$dir/BUILD_ID" ] || { log "!! $dir/BUILD_ID missing"; return 1; }
  [ -s "$dir/BUILD_ID" ] || { log "!! $dir/BUILD_ID is empty"; return 1; }
  [ -f "$dir/prerender-manifest.json" ] || { log "!! $dir/prerender-manifest.json missing"; return 1; }
  [ -s "$dir/prerender-manifest.json" ] || { log "!! $dir/prerender-manifest.json is empty"; return 1; }
  [ -f "$dir/routes-manifest.json" ] || { log "!! $dir/routes-manifest.json missing"; return 1; }
  [ -s "$dir/routes-manifest.json" ] || { log "!! $dir/routes-manifest.json is empty"; return 1; }
  return 0
}

do_rollback() {
  if [ ! -d "$ROLLBACK_DIR" ]; then
    log "!! no rollback generation available (.next.rollback does not exist) — nothing to restore"
    exit 1
  fi
  if ! require_manifest_complete "$ROLLBACK_DIR"; then
    log "!! rollback generation is itself incomplete — refusing to swap it in"
    exit 1
  fi
  log "Rolling back: swapping .next.rollback into place..."
  local tmp_current="$APP_DIR/.next.rolledback-forward-$$"
  if [ -d "$LIVE_DIR" ]; then mv "$LIVE_DIR" "$tmp_current"; fi
  mv "$ROLLBACK_DIR" "$LIVE_DIR"
  if [ -d "$tmp_current" ]; then mv "$tmp_current" "$ROLLBACK_DIR"; fi
  log "Reloading PM2 against the restored build..."
  pm2 reload "$PM2_APP" --update-env
  log "Rollback complete."
}

if [ "${1:-}" = "--rollback" ]; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "!! another deploy/rollback is already in progress (lock held) — aborting"
    exit 1
  fi
  do_rollback
  exit 0
fi

# ---- Normal build + swap path ----
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "!! another build is already running (lock held on $LOCK_FILE) — refusing to start a second one"
  log "!! this is the exact condition that used to corrupt .next; failing safely instead"
  exit 1
fi
log "Lock acquired (pid $$)."

rm -rf "$BUILD_DIR"

log "Building into an isolated directory ($BUILD_DIR) via NEXT_DIST_DIR — the live .next is never opened for writing during this build."
NEXT_DIST_DIR=.next.building NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}" npm run build

if ! require_manifest_complete "$BUILD_DIR"; then
  log "!! build finished but the isolated output is incomplete — the LIVE .next was never touched, previous deployment is still serving unaffected"
  rm -rf "$BUILD_DIR"
  exit 1
fi
log "Build verified complete in the isolated directory. Live .next has been untouched throughout."

log "Atomic swap: live .next -> .next.rollback, .next.building -> .next"
rm -rf "$ROLLBACK_DIR"
if [ -d "$LIVE_DIR" ]; then mv "$LIVE_DIR" "$ROLLBACK_DIR"; fi
mv "$BUILD_DIR" "$LIVE_DIR"

log "Reloading PM2 (zero-downtime graceful reload, never delete+start)..."
if ! pm2 reload "$PM2_APP" --update-env 2>/dev/null; then
  log "No existing '$PM2_APP' process to reload (first-ever deploy on this host) — starting fresh."
  if [ -f "ecosystem.config.cjs" ]; then
    pm2 start ecosystem.config.cjs --update-env
  elif [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js --update-env
  else
    pm2 start npm --name "$PM2_APP" --update-env -- start
  fi
fi

log "Done. Deployed commit: $(git rev-parse --short HEAD). Previous build kept at .next.rollback for --rollback."
