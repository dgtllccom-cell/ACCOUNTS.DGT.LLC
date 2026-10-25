-- 20261240 — database-level "exactly once" guards for expense / payable postings (ADDITIVE, review-only)
--
-- WHY: the application now takes a per-record lock before every expense or payable posting, but the database must also
-- refuse a duplicate on its own (a bug, a manual script or a second server process must not be able to double-count).
-- Verified before writing this file: DEV and PRODUCTION contain 0 duplicates for every rule below, so every index builds.
--
--   1. one ledger (Roznamcha) entry can be referenced by at most ONE expense / payable record;
--   2. one source expense line can have at most ONE live inter-branch claim.
--
-- Rollback: DROP INDEX IF EXISTS <name>;  (no data is changed by this migration)

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_bills_one_entry_uidx
  ON public.expenses_bills (roznamcha_entry_id)
  WHERE roznamcha_entry_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bill_expense_lines_one_entry_uidx
  ON public.bill_expense_lines (roznamcha_entry_id)
  WHERE roznamcha_entry_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clearing_payment_bills_one_entry_uidx
  ON public.clearing_payment_bills (roznamcha_entry_id)
  WHERE roznamcha_entry_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clearing_payment_bill_payments_one_entry_uidx
  ON public.clearing_payment_bill_payments (roznamcha_entry_id)
  WHERE roznamcha_entry_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shipping_expense_transfers_one_active_claim_uidx
  ON public.shipping_expense_transfers (source_table, source_id)
  WHERE deleted_at IS NULL AND source_id IS NOT NULL AND status IN ('pending', 'accepted');

COMMIT;
