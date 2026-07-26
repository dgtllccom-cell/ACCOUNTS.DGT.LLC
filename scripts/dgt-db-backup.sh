#!/usr/bin/env bash
set -eo pipefail

BACKUP_DIR="/var/backups/dgt-database"
LOG_FILE="/var/log/dgt-db-backup.log"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/dgt_backup_${TIMESTAMP}.sql.gz"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting database backup..."

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [ -z "$DATABASE_URL" ] && [ -f "/var/www/dgt-nextjs/.env.local" ]; then
  DATABASE_URL=$(grep "^DATABASE_URL=" /var/www/dgt-nextjs/.env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$DATABASE_URL" ] && [ -f "/var/www/dgt-nextjs/.env" ]; then
  DATABASE_URL=$(grep "^DATABASE_URL=" /var/www/dgt-nextjs/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$DATABASE_URL" ]; then
  log "ERROR: DATABASE_URL is not defined in environment or .env.local"
  exit 1
fi

if pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"; then
  chmod 600 "$BACKUP_FILE"
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "SUCCESS: Backup created at ${BACKUP_FILE} (Size: ${FILE_SIZE})"
else
  log "ERROR: pg_dump failed"
  rm -f "$BACKUP_FILE"
  exit 1
fi

log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -type f -name "dgt_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete || true

log "Database backup task finished successfully."
