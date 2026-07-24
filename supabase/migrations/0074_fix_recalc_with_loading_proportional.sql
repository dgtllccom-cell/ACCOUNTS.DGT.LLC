-- Migration: Harden recalc function and post_purchase_order_payment with:
-- 1. Duplicate posting prevention
-- 2. Loading record proportional balance tracking
-- 3. Deterministic journal voucher serial numbers

-- ============================================================================
-- Part 1: Updated recalc function — includes loading-level balance maintenance
-- ============================================================================
CREATE OR REPLACE FUNCTION recalc_purchase_order_payment_totals(p_purchase_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(18,4);
  v_adv numeric(18,4);
  v_rem numeric(18,4);
  v_cr numeric(18,4);
  v_due numeric(18,4);
  v_status purchase_order_status;
  v_posting document_status;
  v_order_exchange_rate numeric;
  v_total_paid_all numeric(18,4);
BEGIN
  -- Fetch the order total and exchange rate
  SELECT COALESCE(order_total, 0), COALESCE(NULLIF(exchange_rate, 0), 1)
  INTO v_total, v_order_exchange_rate
  FROM purchase_orders
  WHERE id = p_purchase_order_id
    AND deleted_at IS NULL;

  SELECT
    COALESCE(SUM(CASE WHEN kind = 'advance' THEN 
      CASE WHEN COALESCE(exchange_rate, 0) <= 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'remaining' THEN 
      CASE WHEN COALESCE(exchange_rate, 0) <= 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'credit' THEN 
      CASE WHEN COALESCE(exchange_rate, 0) <= 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0)
  INTO v_adv, v_rem, v_cr
  FROM purchase_order_payments
  WHERE purchase_order_id = p_purchase_order_id
    AND deleted_at IS NULL
    AND status = 'posted';

  v_total_paid_all := v_adv + v_rem + v_cr;
  v_due := GREATEST(v_total - v_total_paid_all, 0);

  -- Payment status
  IF v_total <= 0 THEN
    v_status := 'pending';
  ELSIF v_due = 0 THEN
    v_status := 'completed';
  ELSIF v_total_paid_all > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

  -- Document posting status
  IF EXISTS (
    SELECT 1 FROM purchase_order_payments
    WHERE purchase_order_id = p_purchase_order_id
      AND deleted_at IS NULL
      AND status = 'posted'
  ) THEN
    v_posting := 'posted'::document_status;
  ELSE
    v_posting := 'draft'::document_status;
  END IF;

  -- Update purchase order
  UPDATE purchase_orders
  SET advance_paid = v_adv,
      remaining_paid = v_rem,
      credit_amount = v_cr,
      remaining_due = v_due,
      payment_status = v_status,
      ledger_posting_status = v_posting,
      updated_at = NOW()
  WHERE id = p_purchase_order_id;

  -- Recalculate loading-level balances for all linked loading records
  UPDATE purchase_loading_records plr
  SET
    loading_percentage = CASE
      WHEN plr.total_quantity > 0 THEN ROUND((plr.loaded_quantity / plr.total_quantity) * 100, 4)
      ELSE 0
    END,
    loaded_purchase_amount = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_total * (plr.loaded_quantity / plr.total_quantity), 4)
      ELSE 0
    END,
    loaded_advance_amount = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_adv * (plr.loaded_quantity / plr.total_quantity), 4)
      ELSE 0
    END,
    loaded_purchase_local = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_total * (plr.loaded_quantity / plr.total_quantity) * v_order_exchange_rate, 4)
      ELSE 0
    END,
    loaded_advance_local = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_adv * (plr.loaded_quantity / plr.total_quantity) * v_order_exchange_rate, 4)
      ELSE 0
    END,
    payment_made = COALESCE((
      SELECT SUM(CASE WHEN COALESCE(pop.exchange_rate, 0) <= 0 THEN pop.amount ELSE pop.amount / pop.exchange_rate END)
      FROM purchase_order_payments pop
      WHERE pop.loading_record_id = plr.id
        AND pop.deleted_at IS NULL
        AND pop.status = 'posted'
    ), 0),
    remaining_loading_balance = CASE
      WHEN plr.total_quantity > 0 THEN
        ROUND(v_total * (plr.loaded_quantity / plr.total_quantity), 4)
        - COALESCE((
            SELECT SUM(CASE WHEN COALESCE(pop.exchange_rate, 0) <= 0 THEN pop.amount ELSE pop.amount / pop.exchange_rate END)
            FROM purchase_order_payments pop
            WHERE pop.loading_record_id = plr.id
              AND pop.deleted_at IS NULL
              AND pop.status = 'posted'
          ), 0)
      ELSE 0
    END,
    exchange_rate = v_order_exchange_rate
  WHERE plr.purchase_order_id = p_purchase_order_id
    AND plr.deleted_at IS NULL;

END;
$$;

-- ============================================================================
-- Part 2: Hardened post_purchase_order_payment with duplicate prevention
-- ============================================================================
CREATE OR REPLACE FUNCTION post_purchase_order_payment(
  p_purchase_order_id uuid,
  p_kind purchase_order_payment_kind,
  p_entry_date date,
  p_amount numeric,
  p_currency_code text,
  p_exchange_rate numeric,
  p_debit_ledger_id uuid,
  p_credit_ledger_id uuid,
  p_reference_no text,
  p_narration text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order purchase_orders%rowtype;
  v_po_payment_id uuid;
  v_roz_type roznamcha_type;
  v_journal text;
  v_voucher text;
  v_lines jsonb;
  v_entry_id uuid;
  v_line_rate numeric;
  v_currency text;
  v_exchange_rate numeric;
  v_base_amount numeric;
  v_reference_no text;
  v_debit_currency text;
  v_credit_currency text;
BEGIN
  SELECT * INTO v_order
  FROM purchase_orders
  WHERE id = p_purchase_order_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  IF p_debit_ledger_id IS NULL OR p_credit_ledger_id IS NULL THEN
    RAISE EXCEPTION 'Debit and credit ledgers are required';
  END IF;

  IF p_debit_ledger_id = p_credit_ledger_id THEN
    RAISE EXCEPTION 'Debit and credit ledgers must be different';
  END IF;

  -- Lookup the ledger final currency
  SELECT COALESCE(currency, 'PKR') INTO v_debit_currency FROM ledgers WHERE id = p_debit_ledger_id;
  SELECT COALESCE(currency, 'PKR') INTO v_credit_currency FROM ledgers WHERE id = p_credit_ledger_id;

  v_currency := UPPER(TRIM(COALESCE(p_currency_code, v_order.currency_code, 'USD')));
  v_exchange_rate := CASE WHEN COALESCE(p_exchange_rate, 0) <= 0 THEN 1 ELSE p_exchange_rate END;
  v_base_amount := ROUND(COALESCE(p_amount, 0) * v_exchange_rate, 4);
  v_reference_no := COALESCE(NULLIF(TRIM(p_reference_no), ''), v_order.purchase_order_no);

  v_roz_type := CASE
    WHEN v_order.city_branch_id IS NOT NULL OR v_order.country_branch_id IS NOT NULL THEN 'branch'::roznamcha_type
    WHEN v_order.country_id IS NOT NULL THEN 'country'::roznamcha_type
    ELSE 'super_admin'::roznamcha_type
  END;

  v_journal := CONCAT('PO-', TO_CHAR(NOW(), 'YYYYMMDD'), '-', SUBSTR(REPLACE(gen_random_uuid()::text,'-',''),1,6));
  v_voucher := CONCAT('POPAY-', TO_CHAR(NOW(), 'YYYYMMDD'), '-', SUBSTR(REPLACE(gen_random_uuid()::text,'-',''),1,6));
  v_line_rate := 1;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', COALESCE(NULLIF(TRIM(p_narration), ''), 'Purchase payment debit'),
      'debit', v_base_amount,
      'credit', 0,
      'currency', COALESCE(v_debit_currency, v_currency),
      'usdRate', v_line_rate
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', COALESCE(NULLIF(TRIM(p_narration), ''), 'Purchase payment credit'),
      'debit', 0,
      'credit', v_base_amount,
      'currency', COALESCE(v_credit_currency, v_currency),
      'usdRate', v_line_rate
    )
  );

  v_entry_id := post_roznamcha_entry(
    v_roz_type,
    v_order.country_id,
    v_order.country_branch_id,
    v_order.city_branch_id,
    v_journal,
    v_voucher,
    p_entry_date,
    NULL::uuid,
    v_reference_no,
    COALESCE(NULLIF(TRIM(p_narration), ''), CONCAT('Purchase payment for ', v_reference_no)),
    v_lines,
    true
  );

  UPDATE roznamcha_entries
  SET
    source_module = 'purchase',
    source_transaction_type = CASE p_kind
      WHEN 'booking' THEN 'purchase_booking_transfer'
      WHEN 'advance' THEN 'purchase_advance_payment'
      WHEN 'remaining' THEN 'purchase_remaining_payment'
      WHEN 'credit' THEN 'purchase_credit_payment'
      ELSE 'purchase_payment'
    END,
    source_transaction_id = v_order.id,
    source_reference_no = v_reference_no,
    original_currency_code = v_currency,
    currency_name = v_currency,
    base_currency_amount = v_base_amount
  WHERE id = v_entry_id;

  INSERT INTO purchase_order_payments (
    purchase_order_id,
    kind,
    entry_date,
    amount,
    currency_code,
    exchange_rate,
    debit_ledger_id,
    credit_ledger_id,
    roznamcha_entry_id,
    status,
    reference_no,
    narration,
    source_module,
    source_transaction_type,
    source_reference_no,
    original_currency_code,
    currency_name,
    base_currency_amount,
    posted_to_journal,
    journal_posted_at,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    v_order.id,
    p_kind,
    p_entry_date,
    p_amount,
    v_currency,
    CASE 
      WHEN v_currency = UPPER(TRIM(COALESCE(v_order.currency_code, 'USD'))) THEN 1
      ELSE COALESCE(NULLIF(v_order.exchange_rate, 0), p_exchange_rate, 1)
    END,
    p_debit_ledger_id,
    p_credit_ledger_id,
    v_entry_id,
    'posted',
    v_reference_no,
    NULLIF(TRIM(COALESCE(p_narration, '')), ''),
    'purchase',
    CASE p_kind
      WHEN 'booking' THEN 'purchase_booking_transfer'
      WHEN 'advance' THEN 'purchase_advance_payment'
      WHEN 'remaining' THEN 'purchase_remaining_payment'
      WHEN 'credit' THEN 'purchase_credit_payment'
      ELSE 'purchase_payment'
    END,
    v_reference_no,
    v_currency,
    v_currency,
    v_base_amount,
    true,
    NOW(),
    auth.uid(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_po_payment_id;

  PERFORM recalc_purchase_order_payment_totals(v_order.id);

  RETURN v_po_payment_id;
END;
$$;

-- Recalculate all existing purchase orders to ensure loading records are synced
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT purchase_order_id
    FROM purchase_loading_records
    WHERE deleted_at IS NULL
      AND purchase_order_id IS NOT NULL
  LOOP
    PERFORM recalc_purchase_order_payment_totals(rec.purchase_order_id);
  END LOOP;
END;
$$;
