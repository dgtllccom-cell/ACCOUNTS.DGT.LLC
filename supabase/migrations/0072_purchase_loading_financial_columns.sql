-- Migration: Add proportional financial columns to purchase_loading_records
-- and duplicate-prevention flags to both loading and payment records.

-- ============================================================================
-- Part 1: purchase_loading_records — proportional financial tracking
-- ============================================================================
ALTER TABLE purchase_loading_records
  ADD COLUMN IF NOT EXISTS loaded_quantity numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_quantity numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loading_percentage numeric(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loaded_purchase_amount numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loaded_advance_amount numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(18,8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS loaded_purchase_local numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loaded_advance_local numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_made numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_loading_balance numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS local_currency text NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS posted_to_journal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid NULL,
  ADD COLUMN IF NOT EXISTS journal_posted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS journal_posted_by uuid NULL;

-- ============================================================================
-- Part 2: purchase_order_payments — duplicate-prevention and loading linkage
-- ============================================================================
ALTER TABLE purchase_order_payments
  ADD COLUMN IF NOT EXISTS posted_to_journal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS journal_posted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS journal_posted_by uuid NULL,
  ADD COLUMN IF NOT EXISTS loading_record_id uuid NULL REFERENCES purchase_loading_records(id) ON DELETE SET NULL;

-- All existing posted payments should be marked as already posted
UPDATE purchase_order_payments
SET posted_to_journal = true,
    journal_posted_at = created_at
WHERE status = 'posted'
  AND posted_to_journal = false
  AND deleted_at IS NULL;

-- ============================================================================
-- Part 3: Indexes for the new columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS plr_purchase_order_loading_idx
  ON purchase_loading_records(purchase_order_id, loading_percentage)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS plr_journal_posted_idx
  ON purchase_loading_records(posted_to_journal)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pop_loading_record_idx
  ON purchase_order_payments(loading_record_id)
  WHERE loading_record_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pop_journal_posted_idx
  ON purchase_order_payments(posted_to_journal)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- Part 4: Recalculate loading proportions for existing records
-- ============================================================================
-- Backfill loaded_quantity from report_payload for existing records
UPDATE purchase_loading_records plr
SET
  loaded_quantity = COALESCE(
    NULLIF((plr.report_payload->>'loadedQuantity')::numeric, 0),
    NULLIF((plr.report_payload->'workflow'->>'loadedQuantity')::numeric, 0),
    0
  ),
  total_quantity = COALESCE(
    NULLIF((plr.report_payload->'workflow'->>'totalQuantity')::numeric, 0),
    NULLIF((plr.report_payload->'totals'->>'totalQuantity')::numeric, 0),
    0
  )
WHERE plr.deleted_at IS NULL
  AND plr.loaded_quantity = 0;

-- Compute loading_percentage from loaded/total
UPDATE purchase_loading_records plr
SET loading_percentage = CASE
    WHEN total_quantity > 0 THEN ROUND((loaded_quantity / total_quantity) * 100, 4)
    ELSE 0
  END
WHERE plr.deleted_at IS NULL
  AND total_quantity > 0
  AND loading_percentage = 0;

-- Backfill proportional financial amounts from linked purchase orders
UPDATE purchase_loading_records plr
SET
  purchase_currency = COALESCE(po.currency_code, 'USD'),
  exchange_rate = COALESCE(NULLIF(po.exchange_rate, 0), 1),
  loaded_purchase_amount = ROUND(COALESCE(po.order_total, 0) * plr.loading_percentage / 100, 4),
  loaded_advance_amount = ROUND(COALESCE(po.advance_paid, 0) * plr.loading_percentage / 100, 4),
  loaded_purchase_local = ROUND(
    COALESCE(po.order_total, 0) * plr.loading_percentage / 100 * COALESCE(NULLIF(po.exchange_rate, 0), 1), 4
  ),
  loaded_advance_local = ROUND(
    COALESCE(po.advance_paid, 0) * plr.loading_percentage / 100 * COALESCE(NULLIF(po.exchange_rate, 0), 1), 4
  ),
  remaining_loading_balance = ROUND(
    (COALESCE(po.order_total, 0) * plr.loading_percentage / 100) -
    (COALESCE(po.advance_paid, 0) * plr.loading_percentage / 100), 4
  )
FROM purchase_orders po
WHERE plr.purchase_order_id = po.id
  AND plr.deleted_at IS NULL
  AND po.deleted_at IS NULL
  AND plr.loading_percentage > 0
  AND plr.loaded_purchase_amount = 0;
