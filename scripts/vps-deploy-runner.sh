#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "  DGT ERP — PRODUCTION VPS ATOMIC DEPLOYMENT RUNNER"
echo "  Target: root@72.60.209.121 (/var/www/dgt-nextjs)"
echo "=========================================================="

# Crucial for bypassing VPS reference-transaction git hook
export DGT_DEPLOY_GATE=1

cd /var/www/dgt-nextjs

echo "[1/7] Cleaning stale lock and building directories..."
rm -f .deploy.lock
rm -rf .next.building

echo "[2/7] Resetting any uncommitted working changes..."
git reset --hard HEAD
git clean -fd -e .env.local -e .env -e "prod-before-deploy*"

echo "[3/7] Fetching and syncing latest code from origin/main..."
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin main production
TARGET_SHA=$(git rev-parse origin/main)
echo "Target SHA: $TARGET_SHA"

git checkout -f main
git reset --hard "$TARGET_SHA"
git branch -f production "$TARGET_SHA"

echo "[4/7] Verified Git HEAD on VPS:"
git log -n 1 --oneline

echo "[5/7] Installing dependencies..."
npm install --include=dev

echo "[6/7] Running safe-build-deploy (atomic swap + zero downtime reload)..."
bash scripts/safe-build-deploy.sh

echo "[7/7] Persisting PM2 status and reloading Nginx..."
pm2 save
sudo systemctl reload nginx || systemctl reload nginx 2>/dev/null || true

echo "=========================================================="
echo "✅ PRODUCTION VPS ATOMIC DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "=========================================================="
