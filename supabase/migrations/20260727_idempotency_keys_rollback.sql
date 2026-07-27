-- Rollback Migration: 20260727_idempotency_keys_rollback.sql
-- Description: Safely drops the idempotency_keys table, indices, and associated helper functions.

DROP FUNCTION IF EXISTS public.acquire_idempotency_lock(TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, TEXT, INTEGER);
DROP INDEX IF EXISTS public.idx_idempotency_expires_at;
DROP INDEX IF EXISTS public.idx_idempotency_tenant_key;
DROP TABLE IF EXISTS public.idempotency_keys CASCADE;
