#!/usr/bin/env bash
# =============================================================================
# Standalone Server Deployment Script for root@72.60.209.121
# Target Repository: https://github.com/dgtllccom-cell/dht-nextjs.git
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
  git remote add origin https://github.com/dgtllccom-cell/dht-nextjs.git
fi

echo "[3/6] Fetching and resetting to origin/main..."
git remote set-url origin https://github.com/dgtllccom-cell/dht-nextjs.git
git fetch origin main
git checkout -B main origin/main
git reset --hard origin/main

echo "[4/6] Restoring production .env.local..."
if [ -f "/var/www/env_backups/.env.local.bak" ]; then
  cp -f /var/www/env_backups/.env.local.bak /var/www/dgt-nextjs/.env.local
  cp -f /var/www/env_backups/.env.local.bak /var/www/dgt-nextjs/.env
fi

echo "[5/6] Building application..."
npm install
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "[6/6] Restarting PM2 and reloading Nginx..."
pm2 restart dgt-nextjs --update-env || pm2 start ecosystem.config.cjs
pm2 save

sudo nginx -t
sudo systemctl reload nginx

echo "======================================================================="
echo "  DEPLOYMENT COMPLETE! App running on http://72.60.209.121 (port 3000)"
echo "======================================================================="
