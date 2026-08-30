-- Migration: 20261016_settlement_sync_schema_fix.sql
-- Repair the Settlement sync chain.
--
-- `sync_settlement_from_purchases / _sales / _roznamcha` were written against an OLD
-- schema and silently never worked:
--   • purchases  → referenced purchase_booking_order_number, booking_date,
--                  final_currency, remaining_due_amount, total_purchase_amount,
--                  supplier_name, goods_description — none of which exist on
--                  public.purchase_orders any more.
--   • sales      → ON CONFLICT (source_table, source_id) with NO matching unique
--                  constraint → every call errored out.
--   • roznamcha  → referenced re.total_credit / total_debit / currency / usd_rate /
--                  total_credit_usd / total_debit_usd / party_name — the totals live
--                  in roznamcha_lines, not on the entry.
--
-- Result: Purchase / Sales / Roznamcha postings never reached the Settlement module.
--
-- This migration adds the missing UNIQUE(source_table, source_id) key and rewrites
-- the three functions against the real current columns, gated on the transaction
-- actually being posted/confirmed. Additive & idempotent — no data deleted.

BEGIN;

-- One settlement row per source transaction (also what the upserts need).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.settlement_transactions'::regclass
       AND conname = 'settlement_transactions_source_uk'
  ) THEN
    -- clear any accidental dupes first (there are none in practice — table is empty)
    DELETE FROM public.settlement_transactions a
     USING public.settlement_transactions b
     WHERE a.ctid < b.ctid
       AND a.source_table = b.source_table
       AND a.source_id = b.source_id;
    ALTER TABLE public.settlement_transactions
      ADD CONSTRAINT settlement_transactions_source_uk UNIQUE (source_table, source_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PURCHASES → settlement (DR: we owe the supplier for goods still unpaid)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_settlement_from_purchases(
  p_from_date date DEFAULT NULL, p_country_id uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_count integer := 0;
BEGIN
  INSERT INTO public.settlement_transactions (
    country_id, country_branch_id, city_branch_id,
    source_module, source_table, source_id, source_reference_no, source_date,
    direction, settlement_type,
    local_currency, local_amount, original_usd_rate, original_usd_amount,
    party_name, narration
  )
  SELECT
    po.country_id, po.country_branch_id, po.city_branch_id,
    'purchase', 'purchase_orders', po.id,
    COALESCE(po.purchase_order_no, po.country_transaction_serial_number),
    COALESCE(NULLIF(po.form_data->'form'->>'orderDate','')::date, po.created_at::date),
    'dr', 'purchase_payment',
    COALESCE(po.currency_code, po.purchase_currency, 'USD'),
    COALESCE(NULLIF(po.remaining_due, 0), po.order_total, 0),
    COALESCE(NULLIF(po.exchange_rate, 0), 1),
    COALESCE(NULLIF(po.remaining_due, 0), po.order_total, 0) / NULLIF(COALESCE(NULLIF(po.exchange_rate,0), 1), 0),
    COALESCE(po.form_data->'form'->>'supplierName', po.form_data->'form'->>'purchaseAccountName'),
    COALESCE(po.form_data->'form'->>'goodsName', po.purchase_contract_no)
  FROM public.purchase_orders po
  WHERE po.deleted_at IS NULL
    AND po.ledger_posting_status = 'posted'
    AND lower(COALESCE(po.payment_status, '')) IN ('pending','partial','partially_paid','unpaid')
    AND (p_from_date  IS NULL OR COALESCE(NULLIF(po.form_data->'form'->>'orderDate','')::date, po.created_at::date) >= p_from_date)
    AND (p_country_id IS NULL OR po.country_id = p_country_id)
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    local_amount        = EXCLUDED.local_amount,
    original_usd_amount = EXCLUDED.original_usd_amount,
    settlement_status   = CASE
                            WHEN EXCLUDED.local_amount <= 0.01 THEN 'settled'
                            WHEN settlement_transactions.settled_local_amount > 0 THEN 'partially_settled'
                            ELSE 'unsettled'
                          END,
    updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SALES → settlement (CR: the customer owes us for goods still unpaid)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_settlement_from_sales(
  p_from_date date DEFAULT NULL, p_country_id uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_count integer := 0;
BEGIN
  INSERT INTO public.settlement_transactions (
    country_id, country_branch_id, city_branch_id,
    source_module, source_table, source_id, source_reference_no, source_date,
    direction, settlement_type,
    local_currency, local_amount, original_usd_rate, original_usd_amount,
    party_name, narration
  )
  SELECT
    so.country_id, so.country_branch_id, so.city_branch_id,
    'sales', 'sales_orders', so.id,
    COALESCE(so.sales_order_no, so.country_transaction_serial_number),
    COALESCE(so.order_date, so.created_at::date),
    'cr', 'sales_receipt',
    COALESCE(so.currency_code, so.original_currency_code, 'USD'),
    COALESCE(NULLIF(so.remaining_amount, 0), so.order_total, 0),
    COALESCE(NULLIF(so.exchange_rate, 0), 1),
    COALESCE(NULLIF(so.remaining_amount, 0), so.order_total, 0) / NULLIF(COALESCE(NULLIF(so.exchange_rate,0), 1), 0),
    COALESCE(so.customer_name, so.form_data->'form'->>'customerName'),
    so.product_summary
  FROM public.sales_orders so
  WHERE so.deleted_at IS NULL
    AND (so.ledger_posting_status IN ('transferred','posted')
         OR lower(COALESCE(so.sales_status,'')) IN ('confirmed','finalized','posted','completed'))
    AND lower(COALESCE(so.payment_status, '')) IN ('pending','partial','partially_paid','unpaid')
    AND (p_from_date  IS NULL OR so.order_date >= p_from_date)
    AND (p_country_id IS NULL OR so.country_id = p_country_id)
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    local_amount        = EXCLUDED.local_amount,
    original_usd_amount = EXCLUDED.original_usd_amount,
    settlement_status   = CASE
                            WHEN EXCLUDED.local_amount <= 0.01 THEN 'settled'
                            WHEN settlement_transactions.settled_local_amount > 0 THEN 'partially_settled'
                            ELSE 'unsettled'
                          END,
    updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROZNAMCHA → settlement (direction + amount aggregated from roznamcha_lines)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_settlement_from_roznamcha(
  p_from_date date DEFAULT NULL, p_country_id uuid DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_count integer := 0;
BEGIN
  INSERT INTO public.settlement_transactions (
    country_id, country_branch_id, city_branch_id,
    source_module, source_table, source_id, source_reference_no, source_date,
    direction, settlement_type,
    local_currency, local_amount, original_usd_rate, original_usd_amount,
    party_name, narration
  )
  SELECT
    re.country_id, re.country_branch_id, re.city_branch_id,
    COALESCE(re.source_module, 'roznamcha'), 'roznamcha_entries', re.id,
    COALESCE(re.journal_no, re.voucher_no, re.reference_no, re.entry_serial_number),
    re.entry_date,
    CASE WHEN agg.cr >= agg.dr THEN 'cr' ELSE 'dr' END,
    CASE
      WHEN re.source_module IN ('bank','bank_entry')  THEN 'bank'
      WHEN re.source_module IN ('cash','cash_entry')  THEN 'cash'
      WHEN re.source_module = 'purchase'              THEN 'purchase_payment'
      WHEN re.source_module = 'sales'                 THEN 'sales_receipt'
      WHEN re.source_module IN ('expense','expenses') THEN 'expense_payment'
      WHEN re.source_module = 'transfer'              THEN 'transfer'
      ELSE 'other'
    END,
    COALESCE(re.original_currency_code, agg.ccy, 'USD'),
    GREATEST(agg.cr, agg.dr),
    COALESCE(NULLIF(agg.usd_rate, 0), 1),
    GREATEST(agg.cr_usd, agg.dr_usd),
    NULL,
    re.narration
  FROM public.roznamcha_entries re
  JOIN LATERAL (
    SELECT
      COALESCE(SUM(rl.credit), 0)      AS cr,
      COALESCE(SUM(rl.debit), 0)       AS dr,
      COALESCE(SUM(CASE WHEN rl.credit > 0 THEN rl.usd_amount ELSE 0 END), 0) AS cr_usd,
      COALESCE(SUM(CASE WHEN rl.debit  > 0 THEN rl.usd_amount ELSE 0 END), 0) AS dr_usd,
      MAX(rl.usd_rate)                 AS usd_rate,
      MAX(rl.currency)                 AS ccy
    FROM public.roznamcha_lines rl
    WHERE rl.roznamcha_entry_id = re.id
  ) agg ON true
  WHERE re.deleted_at IS NULL
    AND re.status = 'posted'
    -- a purchase/sales payment is already represented by its own source row; avoid
    -- double-counting the roznamcha mirror of it.
    AND COALESCE(re.source_module, '') NOT IN ('purchase','sales')
    AND (p_from_date  IS NULL OR re.entry_date >= p_from_date)
    AND (p_country_id IS NULL OR re.country_id = p_country_id)
  ON CONFLICT (source_table, source_id) DO UPDATE SET
    local_amount        = EXCLUDED.local_amount,
    original_usd_amount = EXCLUDED.original_usd_amount,
    direction           = EXCLUDED.direction,
    updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261016_settlement_sync_schema_fix', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
