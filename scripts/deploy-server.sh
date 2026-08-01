#!/usr/bin/env bash
# =============================================================================
# Standalone Server Deployment Script for root@72.60.209.121
# Target Repository: https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
# =============================================================================
set -e

echo "[1/6] Preserving production .env.local..."
mkdir -p /var/www/env_backups
if [ -f "/var/www/dgt-nextjs/.env.local" ]; then
  cp -f /var/www/dgt-nextjs/.env.local /var/www/env_backups/.env.local.bak
fi

echo "[2/6] Navigating to application directory..."
mkdir -p /var/www/dgt-nextjs
cd /var/www/dgt-nextjs

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
fi

echo "[3/6] Fetching and resetting to origin/main..."
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main

COMMIT_HASH=$(git rev-parse HEAD)
echo "[INFO] Active Production Commit Hash: ${COMMIT_HASH}"

echo "[4/6] Restoring production .env.local..."
if [ -f "/var/www/env_backups/.env.production" ]; then
  cp -f /var/www/env_backups/.env.production /var/www/dgt-nextjs/.env.local
elif [ -f "/var/www/env_backups/.env.local.bak" ]; then
  cp -f /var/www/env_backups/.env.local.bak /var/www/dgt-nextjs/.env.local
fi

if [ ! -f "/var/www/dgt-nextjs/.env.local" ]; then
  echo "ERROR: production .env.local is missing."
  exit 1
fi

node scripts/verify-production-env.mjs
cp -f /var/www/dgt-nextjs/.env.local /var/www/dgt-nextjs/.env
chmod 600 /var/www/dgt-nextjs/.env.local /var/www/dgt-nextjs/.env

echo "[5/6] Stopping old PM2 process & purging stale .next build cache..."
pm2 stop dgt-nextjs || true
rm -rf .next

echo "[5.1/6] Installing dependencies and building fresh production bundle..."
npm install
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[5.2/6] Setting 755 permissions on build assets..."
chmod -R 755 .next

echo "[6/6] Starting PM2 and reloading Nginx..."
pm2 start ecosystem.config.cjs --update-env || pm2 restart dgt-nextjs --update-env
pm2 save

sudo nginx -t
sudo systemctl reload nginx

echo "======================================================================="
echo "  DEPLOYMENT COMPLETE! Commit: ${COMMIT_HASH}"
echo "  App running on http://72.60.209.121 (port 3000)"
echo "======================================================================="
