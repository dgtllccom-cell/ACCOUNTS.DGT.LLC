# 💾 Digital Dock ERP — Database Backup, Restore & Disaster Recovery Guide

**Document Version**: 1.0.0  
**Target Database**: Supabase PostgreSQL  
**Scope**: Full Database Backup, Automated Snapshots, Point-in-Time Recovery, and Emergency Disaster Recovery  

---

## 1. Automated & Manual Database Backup Procedures

### Method A: Supabase Automated Daily Backups
- **Frequency**: Automatic daily snapshots maintained by Supabase infrastructure.
- **Retention**: 7 to 30 days depending on plan tier.
- **Location**: Supabase Dashboard -> Database -> Backups.

### Method B: Manual CLI Database Backup (pg_dump)
To perform an immediate, on-demand physical backup before major deployments:

```bash
# Set your Supabase database connection string
export DATABASE_URL="postgres://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Execute pg_dump script to generate timestamped SQL dump
pg_dump "$DATABASE_URL" \
  --clean \
  --if-exists \
  --quote-all-identifiers \
  --schema=public \
  -f "backups/dgt_erp_backup_$(date +%Y%m%m_%H%M%S).sql"
```

---

## 2. Disaster Recovery & Restoration Procedures

### Scenario 1: Restore Full Database from SQL Backup File
If a database corruption or catastrophic event occurs, execute the restoration command:

```bash
# Restore schema and data from SQL backup
psql "$DATABASE_URL" -f "backups/dgt_erp_backup_YYYYMMDD_HHMMSS.sql"
```

### Scenario 2: Rollback Idempotency Keys Table Schema
If idempotency locks need to be reset during database maintenance:

```sql
-- Execute in Supabase SQL Editor:
-- File: supabase/migrations/20260727_idempotency_keys_rollback.sql
DROP FUNCTION IF EXISTS public.acquire_idempotency_lock(TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, TEXT, INTEGER);
DROP INDEX IF EXISTS public.idx_idempotency_expires_at;
DROP INDEX IF EXISTS public.idx_idempotency_tenant_key;
DROP TABLE IF EXISTS public.idempotency_keys CASCADE;

-- Re-apply forward migration:
-- File: supabase/migrations/20260727_idempotency_keys.sql
```

---

## 3. Disaster Recovery Verification Protocol

After restoring a database backup, perform the following verification protocol:

1. **Verify Serial Numbers**: Ensure `journal_serial_no`, `country_serial_no`, and `branch_serial_no` pick up from the max existing value without key collision.
2. **Verify Account Balances**: Check that `ledgers.current_balance` matches the sum of debit minus credit for all transactions.
3. **Verify Active Sessions**: Confirm that session authentication (`profiles` table) functions correctly.
