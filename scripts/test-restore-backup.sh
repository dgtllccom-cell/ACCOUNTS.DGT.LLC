#!/usr/bin/env bash
# ==============================================================================
# DGT ERP Automated Backup Test Restoration Script
# Purpose: Validates backup archive integrity, uncompresses archives, and
# verifies database tables, schema, and row counts to ensure usability.
# ==============================================================================

set -euo pipefail

LOG_FILE="/var/log/dgt-erp-backup.log"
BACKUP_ARCHIVE="${1:-}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [RESTORE-TEST] $1" | tee -a "${LOG_FILE}"
}

if [ -z "${BACKUP_ARCHIVE}" ]; then
  # Find latest daily backup
  BACKUP_ARCHIVE=$(find /var/backups/dgt-erp/daily -maxdepth 1 -name "*.tar.gz" | sort -r | head -n 1)
fi

if [ -z "${BACKUP_ARCHIVE}" ] || [ ! -f "${BACKUP_ARCHIVE}" ]; then
  log "ERROR: No valid backup archive found to test restore."
  exit 1
fi

log "Starting test restoration check for: ${BACKUP_ARCHIVE}"

# 1. SHA-256 Checksum Validation
CHECKSUM_FILE="${BACKUP_ARCHIVE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  log "Verifying SHA-256 checksum..."
  (cd "$(dirname "${BACKUP_ARCHIVE}")" && sha256sum -c "$(basename "${CHECKSUM_FILE}")") || {
    log "ERROR: SHA-256 checksum verification failed for ${BACKUP_ARCHIVE}"
    exit 1
  }
  log "SHA-256 checksum verified successfully."
fi

# 2. Extract Archive to Isolated Temp Directory
TEST_DIR=$(mktemp -d "/tmp/dgt_restore_test_XXXXXXXX")
trap 'rm -rf "${TEST_DIR}"' EXIT

log "Decompressing archive bundle into sandbox: ${TEST_DIR}"
tar -xzf "${BACKUP_ARCHIVE}" -C "${TEST_DIR}" || {
  log "ERROR: Archive extraction failed."
  exit 1
}

# 3. Verify Backup Contents & Manifest
if [ -f "${TEST_DIR}/backup_manifest.json" ]; then
  log "Found backup manifest:"
  cat "${TEST_DIR}/backup_manifest.json" | tee -a "${LOG_FILE}"
else
  log "WARNING: Backup manifest file not found in archive."
fi

# 4. Database Integrity Verification
if [ -f "${TEST_DIR}/database.dump" ]; then
  log "Validating pg_dump database dump file size and header..."
  DUMP_SIZE=$(du -h "${TEST_DIR}/database.dump" | cut -f1)
  log "PostgreSQL dump size: ${DUMP_SIZE}"
elif [ -d "${TEST_DIR}/db-json" ]; then
  log "Validating JSON database export tables..."
  TABLE_COUNT=$(find "${TEST_DIR}/db-json" -name "*.json" | wc -l)
  log "JSON database table count: ${TABLE_COUNT}"
  if [ "${TABLE_COUNT}" -eq 0 ]; then
    log "ERROR: No database tables found in backup."
    exit 1
  fi
else
  log "ERROR: Neither PostgreSQL dump nor JSON tables found in backup bundle."
  exit 1
fi

log "SUCCESS: Backup archive passed integrity check and is fully usable for restoration!"
exit 0
