#!/usr/bin/env bash
# Production deploy for the Digital Dock ERP VPS (72.60.209.121:/var/www/dgt-nextjs).
#
# Goal: cut the "502 Bad Gateway" + "ChunkLoadError / 404 _next/static" window that
# QA kept seeing during rollouts.
#
# Two root causes of that window and how this script avoids them:
#
#   1. `rm -rf .next` BEFORE the build deleted the chunks the still-running server
#      was serving, so every request during the ~10-minute build 404'd on
#      /_next/static/chunks/*. Fix: never delete `.next` up front. `next build`
#      writes a fresh `.next` in place; the old server keeps serving the old
#      build until the very end. We only clear `.next/cache` (safe — it is a
#      compiler cache, not served output).
#
#   2. `pm2 restart` fully stops the process before starting the new one, giving
#      nginx a 2-4s window with no upstream -> 502. Fix: `pm2 reload`, which waits
#      for the new process to come up (listen_timeout) before killing the old one.
#      For true zero-downtime, switch ecosystem.config.js to
#      exec_mode:'cluster', instances:2 (OWNER/DevOps approval — changes the
#      runtime model) and this same `reload` becomes a rolling restart.
#
# Usage (run ON the VPS, from the repo root):
#   bash scripts/deploy-vps.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Sync working tree"
git checkout -- api-error-log.txt 2>/dev/null || true
git pull origin main

echo "==> Clear compiler cache only (keep served .next output live during build)"
rm -rf .next/cache

echo "==> Build (old server still serving the previous build)"
npm run build

test -f .next/BUILD_ID || { echo "!! build produced no BUILD_ID — aborting, server untouched"; exit 1; }

echo "==> Graceful reload (new process must bind before the old one is killed)"
pm2 reload dgt-nextjs --update-env

sleep 4
code=$(curl -s -o /dev/null -w '%{http_code}' https://api.dgt.llc/login || echo 000)
echo "==> https://api.dgt.llc/login -> HTTP $code"
[ "$code" = "200" ] || [ "$code" = "307" ] || { echo "!! health check failed"; exit 1; }
echo "==> Deployed $(git rev-parse --short HEAD)"
