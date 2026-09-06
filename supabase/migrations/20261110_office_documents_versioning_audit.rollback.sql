-- Rollback for 20261110_office_documents_versioning_audit.sql
-- All seven columns are new and additive — dropping them loses only the
-- version/checksum/approval/ledger-link metadata written after the migration;
-- no pre-existing office_documents data depends on them.
-- Safe to run only if you first re-deploy the code that predates the migration
-- (current prod build 2914b42 already tolerates the columns being present OR absent).

DROP INDEX IF EXISTS public.office_documents_uploaded_by_idx;
DROP INDEX IF EXISTS public.office_documents_approval_status_idx;
DROP INDEX IF EXISTS public.office_documents_ledger_account_idx;

ALTER TABLE IF EXISTS public.office_documents
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS checksum_sha256,
  DROP COLUMN IF EXISTS uploaded_by_id,
  DROP COLUMN IF EXISTS approval_status,
  DROP COLUMN IF EXISTS approved_by_id,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS ledger_account_id;
