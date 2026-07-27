# 📋 Digital Dock ERP — Production Deployment & Rollback Guide

**Document Version**: 1.0.0  
**Target Release**: Production Stabilization & Idempotency Framework  
**Scope**: All Direct Posting APIs & Accounting Ledger Modules  

---

## 🛑 Pre-Deployment Checklist

Before deploying to the production server (VPS), ensure the following prerequisites are met:

1. [ ] Full database backup performed in Supabase Dashboard.
2. [ ] Environment variables verified (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`).
3. [ ] All 9 Direct Posting APIs audited and verified clean.
4. [ ] All unit and integration tests passing (`npx vitest run`).

---

## 🚀 Step-by-Step Production Deployment Procedure

### Step 1: Database Migration Execution
Execute the idempotency framework forward migration in your Supabase SQL Editor or CLI:

```sql
-- File: supabase/migrations/20260727_idempotency_keys.sql
-- Execute in Supabase SQL Editor:
-- Creates public.idempotency_keys table, composite unique index, and acquire_idempotency_lock RPC function.
```

### Step 2: Codebase Build & Local Verification
On local/build machine:

```bash
# Clean install & run unit test suite
npm test

# Verify production Next.js build
npm run build
```

### Step 3: Deployment Execution to Production Server
Push latest commits to production repository branch and deploy:

```bash
# Pull latest main branch on VPS
git pull origin main

# Build production bundle
npm run build

# Restart PM2 / Node service safely
pm2 reload erp-app --update-env
```

### Step 4: Post-Deployment Smoke Verification
Perform manual verification on key accounting workflows:
1. **Roznamcha Cash Entry**: Post a test cash entry; verify voucher serial generated and duplicate submit blocked.
2. **Purchase Order Payment**: Post an advance payment; verify single payment record created.
3. **Sales Order Transfer**: Perform a sales order transfer; verify single journal entry recorded.

---

## ⏪ Emergency Rollback Procedure

If any critical issue or unexpected database lock occurs during deployment, follow this rollback guide:

### Step 1: Codebase Rollback
Revert the VPS application code to the previous git commit:

```bash
git reset --hard HEAD~1
npm run build
pm2 reload erp-app --update-env
```

### Step 2: Database Schema Rollback
Run the rollback migration script in Supabase SQL Editor:

```sql
-- File: supabase/migrations/20260727_idempotency_keys_rollback.sql
DROP FUNCTION IF EXISTS public.acquire_idempotency_lock(TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, TEXT, INTEGER);
DROP INDEX IF EXISTS public.idx_idempotency_expires_at;
DROP INDEX IF EXISTS public.idx_idempotency_tenant_key;
DROP TABLE IF EXISTS public.idempotency_keys CASCADE;
```

---

## 📞 Support & Monitoring

- **System Logs**: Inspect Next.js runtime logs for `[Idempotency]` or `ROZNAMCHA_POST_ERROR`.
- **Database Locks**: Monitor `public.idempotency_keys` table for any locks stuck in `PROCESSING` state for longer than 90 seconds.
