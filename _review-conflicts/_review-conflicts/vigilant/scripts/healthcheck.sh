#!/bin/bash
# =============================================================================
# Healthcheck & Self-Healing Monitoring Script for DGT ERP
# Target: 72.60.209.121
# Path  : /var/www/dgt-nextjs/scripts/healthcheck.sh
# =============================================================================

APP_DIR="/var/www/dgt-nextjs"
ENV_LOCAL="${APP_DIR}/.env.local"
ENV_FILE="${APP_DIR}/.env"
ENV_BAK_LOCAL="/var/www/env_backups/.env.local.bak"
ENV_BAK="/var/www/env_backups/.env.bak"
APP_NAME="dgt-nextjs"
PORT=3000

# 1. Ensure .env.local / .env exist, fallback to backup if missing
if [ ! -f "$ENV_LOCAL" ] && [ ! -f "$ENV_FILE" ]; then
    echo "[HEALTHCHECK] Warning: Environment file missing! Restoring from backup..."
    mkdir -p /var/www/env_backups
    if [ -f "$ENV_BAK_LOCAL" ]; then
        cp -f "$ENV_BAK_LOCAL" "$ENV_LOCAL"
        cp -f "$ENV_BAK_LOCAL" "$ENV_FILE"
    elif [ -f "$ENV_BAK" ]; then
        cp -f "$ENV_BAK" "$ENV_LOCAL"
        cp -f "$ENV_BAK" "$ENV_FILE"
    fi
    chmod 600 "$ENV_LOCAL" "$ENV_FILE" 2>/dev/null || true
fi

# 2. Check if port 3000 responds with HTTP 200/302/307
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:${PORT}/api/erp/auth/login?temp=1 || echo "000")

if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "302" ] && [ "$HTTP_STATUS" != "307" ]; then
    echo "[HEALTHCHECK] Alert: Application unhealthy (HTTP ${HTTP_STATUS}). Restarting PM2 process '${APP_NAME}'..."
    cd "$APP_DIR" || exit 1
    pm2 restart "$APP_NAME" --update-env || pm2 startOrReload ecosystem.config.cjs
    pm2 save
else
    echo "[HEALTHCHECK] OK: Application healthy (HTTP ${HTTP_STATUS})."
fi
