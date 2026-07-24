#!/usr/bin/env bash
# ==============================================================================
# DGT ERP Enterprise Automated Backup System
# Target OS: Ubuntu / Linux (Hostinger VPS)
# Retention: Daily (30 days), Weekly (12 weeks), Monthly (12 months)
# Storage Path: /var/backups/dgt-erp (STRICTLY OUTSIDE GIT REPOSITORY)
# ==============================================================================

set -euo pipefail

# Configuration & Paths
APP_DIR="/var/www/dgt-nextjs"
BACKUP_ROOT="/var/backups/dgt-erp"
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
MONTHLY_DIR="${BACKUP_ROOT}/monthly"
LOG_FILE="/var/log/dgt-erp-backup.log"

DATE_STAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DAY_OF_WEEK=$(date +"%u")  # 1 = Monday, 7 = Sunday
DAY_OF_MONTH=$(date +"%d") # 01 - 31

# Ensure directories exist
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}" "${MONTHLY_DIR}"
touch "${LOG_FILE}"

log() {
  local msg="$1"
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ${msg}" | tee -a "${LOG_FILE}"
}

alert_failure() {
  local error_msg="$1"
  log "CRITICAL ERROR: ${error_msg}"
  # System notification alert (can be piped to mail, webhook, or slack)
  if command -v mail >/dev/null 2>&1; then
    echo "DGT ERP Backup Failure on $(hostname): ${error_msg}" | mail -s "ALERT: DGT ERP Backup Failure" root@localhost || true
  fi
}

trap 'alert_failure "Backup script exited unexpectedly at line $LINENO"' ERR

log "Starting DGT ERP enterprise backup process..."

# 1. Load Database Connection String from environment
ENV_FILE="${APP_DIR}/.env.production"
if [ ! -f "${ENV_FILE}" ]; then
  ENV_FILE="${APP_DIR}/.env.local"
fi

DB_URL=""
if [ -f "${ENV_FILE}" ]; then
  DB_URL=$(grep -E "^DATABASE_URL=" "${ENV_FILE}" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
fi

TARGET_PREFIX="dgt_erp_backup_${DATE_STAMP}"
WORK_DIR=$(mktemp -d "/tmp/dgt_backup_XXXXXXXX")

# 2. Database Backup (PostgreSQL pg_dump / Node Backup Engine)
log "Extracting database schema and data..."
if [ -n "${DB_URL}" ] && command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${DB_URL}" --clean --if-exists --create -F c -f "${WORK_DIR}/database.dump" || {
    alert_failure "pg_dump database export failed"
    exit 1
  }
  pg_dump "${DB_URL}" --schema=public --avatar=plain -f "${WORK_DIR}/database_schema.sql" || true
else
  log "Using Node.js database dump engine..."
  cd "${APP_DIR}" && node scripts/db-backup-engine.mjs --output "${WORK_DIR}/db-json" || {
    alert_failure "Node.js database engine backup failed"
    exit 1
  }
fi

# 3. Storage & Configuration Archiving
log "Archiving project configuration and user storage..."
mkdir -p "${WORK_DIR}/config"
if [ -f "${APP_DIR}/.env.production" ]; then cp "${APP_DIR}/.env.production" "${WORK_DIR}/config/"; fi
if [ -f "${APP_DIR}/.env.local" ]; then cp "${APP_DIR}/.env.local" "${WORK_DIR}/config/"; fi

if [ -d "${APP_DIR}/public/uploads" ]; then
  mkdir -p "${WORK_DIR}/storage"
  cp -r "${APP_DIR}/public/uploads" "${WORK_DIR}/storage/"
fi

# Write Backup Metadata Manifest
cat <<EOF > "${WORK_DIR}/backup_manifest.json"
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "hostname": "$(hostname)",
  "app": "DGT ERP (dht-nextjs)",
  "database": "Supabase PostgreSQL",
  "version": "1.0.0"
}
EOF

# 4. Create Compressed Archive Bundle
log "Compressing backup bundle..."
ARCHIVE_NAME="${TARGET_PREFIX}.tar.gz"
ARCHIVE_PATH="${DAILY_DIR}/${ARCHIVE_NAME}"

tar -czf "${ARCHIVE_PATH}" -C "${WORK_DIR}" .

# Generate SHA-256 Checksum
cd "${DAILY_DIR}" && sha256sum "${ARCHIVE_NAME}" > "${ARCHIVE_NAME}.sha256"

log "Daily backup created successfully: ${ARCHIVE_PATH}"

# 5. Retention Management (Weekly & Monthly Promotion)
if [ "${DAY_OF_WEEK}" -eq "7" ]; then
  log "Promoting backup to Weekly archive..."
  cp "${ARCHIVE_PATH}" "${WEEKLY_DIR}/${ARCHIVE_NAME}"
  cp "${DAILY_DIR}/${ARCHIVE_NAME}.sha256" "${WEEKLY_DIR}/${ARCHIVE_NAME}.sha256"
fi

if [ "${DAY_OF_MONTH}" -eq "01" ]; then
  log "Promoting backup to Monthly archive..."
  cp "${ARCHIVE_PATH}" "${MONTHLY_DIR}/${ARCHIVE_NAME}"
  cp "${DAILY_DIR}/${ARCHIVE_NAME}.sha256" "${MONTHLY_DIR}/${ARCHIVE_NAME}.sha256"
fi

# Cleanup Temporary Work Directory
rm -rf "${WORK_DIR}"

# 6. Retention Pruning Policy
log "Applying retention pruning policy..."
# Daily: Purge backups older than 30 days
find "${DAILY_DIR}" -type f \( -name "*.tar.gz" -o -name "*.sha256" \) -mtime +30 -delete
# Weekly: Purge backups older than 84 days (12 weeks)
find "${WEEKLY_DIR}" -type f \( -name "*.tar.gz" -o -name "*.sha256" \) -mtime +84 -delete
# Monthly: Purge backups older than 365 days (12 months)
find "${MONTHLY_DIR}" -type f \( -name "*.tar.gz" -o -name "*.sha256" \) -mtime +365 -delete

log "Retention pruning completed."

# 7. Automated Test Restoration Trigger
log "Triggering automated test restoration check..."
if [ -f "${APP_DIR}/scripts/test-restore-backup.sh" ]; then
  bash "${APP_DIR}/scripts/test-restore-backup.sh" "${ARCHIVE_PATH}" || alert_failure "Test restoration check failed"
fi

log "DGT ERP Enterprise Backup completed cleanly."
exit 0
