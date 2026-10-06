-- Fix post_sales_order_payment(): it INSERTs into sales_order_payments using
-- column names ("kind", "updated_at") that were never migrated onto that table
-- (the real columns are "payment_kind"; there is no "updated_at" column at all,
-- and "payment_date" was never populated either). This meant every real Sales
-- Order transfer-to-payment call failed with
-- 'column "kind" of relation "sales_order_payments" does not exist' — confirmed
-- live during a Sales E2E test on 2026-09-20 (DEV, csesvyxxjivnkkozgopt). The
-- roznamcha posting (post_roznamcha_entry) already succeeds before this INSERT,
-- so only the final payment-row insert needed correcting; no other logic here
-- changes.
create or replace function public.post_sales_order_payment(
  p_sales_order_id uuid,
  p_payment_kind text,
  p_entry_date date,
  p_amount numeric,
  p_currency_code text,
  p_exchange_rate numeric,
  p_debit_ledger_id uuid,
  p_credit_ledger_id uuid,
  p_reference_no text,
  p_narration text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_order sales_orders%rowtype;
  v_payment_id uuid;
  v_roz_type roznamcha_type;
  v_journal text;
  v_voucher text;
  v_entry_id uuid;
  v_lines jsonb;
  v_local_currency text;
  v_currency text;
  v_exchange_rate numeric;
  v_base_amount numeric;
  v_line_rate numeric;
  v_orig_currency text;
BEGIN
  SELECT * INTO v_order
  FROM sales_orders
  WHERE id = p_sales_order_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found';
  END IF;

  IF p_debit_ledger_id IS NULL OR p_credit_ledger_id IS NULL THEN
    RAISE EXCEPTION 'Debit and credit ledgers are required';
  END IF;

  IF p_debit_ledger_id = p_credit_ledger_id THEN
    RAISE EXCEPTION 'Debit and credit ledgers must be different';
  END IF;

  SELECT COALESCE(currency_code, 'PKR') INTO v_local_currency
  FROM countries
  WHERE id = v_order.country_id;

  v_currency := UPPER(TRIM(COALESCE(p_currency_code, v_order.currency_code, 'USD')));
  v_exchange_rate := CASE WHEN COALESCE(p_exchange_rate, 0) <= 0 THEN 1 ELSE p_exchange_rate END;
  v_orig_currency := UPPER(TRIM(COALESCE(v_order.currency_code, 'USD')));

  IF v_currency = UPPER(TRIM(COALESCE(v_local_currency, '')))
     OR (v_order.order_total > 0 AND ABS(COALESCE(p_amount, 0) - v_order.order_total) < 0.05) THEN
    v_base_amount := ROUND(COALESCE(p_amount, 0), 4);
    v_line_rate := 1;
  ELSE
    v_base_amount := ROUND(COALESCE(p_amount, 0) * v_exchange_rate, 4);
    v_line_rate := CASE WHEN v_exchange_rate = 0 THEN 1 ELSE 1 / v_exchange_rate END;
  END IF;

  v_roz_type := CASE
    WHEN v_order.city_branch_id IS NOT NULL OR v_order.country_branch_id IS NOT NULL THEN 'branch'::roznamcha_type
    WHEN v_order.country_id IS NOT NULL THEN 'country'::roznamcha_type
    ELSE 'super_admin'::roznamcha_type
  END;

  v_journal := CONCAT('SO-', TO_CHAR(NOW(), 'YYYYMMDD'), '-', SUBSTR(REPLACE(gen_random_uuid()::text,'-',''),1,6));
  v_voucher := CONCAT('SOPAY-', TO_CHAR(NOW(), 'YYYYMMDD'), '-', SUBSTR(REPLACE(gen_random_uuid()::text,'-',''),1,6));

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', NULLIF(TRIM(COALESCE(p_narration,'')), ''),
      'debit', v_base_amount,
      'credit', 0,
      'currency', v_local_currency,
      'usdRate', v_line_rate
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', NULLIF(TRIM(COALESCE(p_narration,'')), ''),
      'debit', 0,
      'credit', v_base_amount,
      'currency', v_local_currency,
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
    p_reference_no,
    p_narration,
    v_lines,
    true
  );

  UPDATE roznamcha_entries
  SET
    source_module = 'sales',
    source_transaction_type = 'sales_booking_transfer',
    source_transaction_id = v_order.id,
    source_reference_no = p_reference_no,
    original_currency_code = v_orig_currency,
    currency_name = v_local_currency,
    base_currency_amount = v_base_amount
  WHERE id = v_entry_id;

  INSERT INTO sales_order_payments (
    sales_order_id,
    roznamcha_entry_id,
    payment_kind,
    payment_date,
    amount,
    base_currency_amount,
    currency_code,
    original_currency_code,
    exchange_rate,
    status,
    created_at
  )
  VALUES (
    v_order.id,
    v_entry_id,
    p_payment_kind,
    p_entry_date,
    v_base_amount,
    v_base_amount,
    v_local_currency,
    v_orig_currency,
    v_exchange_rate,
    'posted',
    NOW()
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$function$;
