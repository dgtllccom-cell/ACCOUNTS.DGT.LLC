-- Migration: 20261015_fix_booking_transfer_numeric_overflow.sql
-- Description: Guard post_purchase_order_payment and post_sales_order_payment against numeric field overflow
-- when converting booking orders where order_total is already recorded in the destination currency, or when
-- the exchange rate / amount would otherwise exceed the numeric(18,4) capacity (10^14).

CREATE OR REPLACE FUNCTION public.post_purchase_order_payment(
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
 SET search_path TO 'public'
AS $function$
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
  v_local_currency text;
  
  v_credit_code text;
  v_credit_name text;
  v_is_cash boolean := false;
  v_is_bank boolean := false;
  
  v_scope_type text;
  v_scope_key text;
  v_gl_ref text;
  v_orig_currency text;
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

  -- Resolve Local Currency of the branch country
  SELECT COALESCE(currency_code, 'PKR') INTO v_local_currency
  FROM countries
  WHERE id = v_order.country_id;

  v_currency := UPPER(TRIM(COALESCE(p_currency_code, v_order.currency_code, 'USD')));
  v_exchange_rate := CASE WHEN COALESCE(p_exchange_rate, 0) <= 0 THEN 1 ELSE p_exchange_rate END;
  v_orig_currency := UPPER(TRIM(COALESCE(v_order.currency_code, 'USD')));
  
  -- Prevent double conversion and numeric field overflow:
  -- 1. If p_amount is already in local currency OR matches order_total
  -- 2. If booking transfer and order_total > 0, use order_total directly (wizard already computed base currency using * or /)
  -- 3. If multiplying p_amount * v_exchange_rate would overflow or order_total is already recorded, fallback to order_total
  IF v_currency = UPPER(TRIM(COALESCE(v_local_currency, ''))) 
     OR (v_order.order_total > 0 AND ABS(COALESCE(p_amount, 0) - v_order.order_total) < 0.05) THEN
    v_base_amount := ROUND(COALESCE(p_amount, 0), 4);
    v_line_rate := 1;
  ELSIF v_order.order_total > 0 AND (p_kind = 'booking' OR v_exchange_rate >= 1000 OR COALESCE(p_amount, 0) >= 1000000000) THEN
    v_base_amount := ROUND(v_order.order_total, 4);
    v_line_rate := CASE WHEN COALESCE(p_amount, 0) > 0 THEN ROUND(v_base_amount / p_amount, 8) ELSE 1 END;
  ELSE
    v_base_amount := ROUND(COALESCE(p_amount, 0) * v_exchange_rate, 4);
    v_line_rate := CASE WHEN v_exchange_rate = 0 THEN 1 ELSE 1 / v_exchange_rate END;
  END IF;

  v_roz_type := CASE
    WHEN v_order.city_branch_id IS NOT NULL OR v_order.country_branch_id IS NOT NULL THEN 'branch'::roznamcha_type
    WHEN v_order.country_id IS NOT NULL THEN 'country'::roznamcha_type
    ELSE 'super_admin'::roznamcha_type
  END;

  -- Check if credit ledger is Cash or Bank to assign correct serials
  SELECT code, name INTO v_credit_code, v_credit_name
  FROM ledgers
  WHERE id = p_credit_ledger_id;

  IF v_credit_code ILIKE '%cash%' OR v_credit_name ILIKE '%cash%' THEN
    v_is_cash := true;
  ELSIF v_credit_code ILIKE '%bank%' OR v_credit_name ILIKE '%bank%' THEN
    v_is_bank := true;
  END IF;

  -- Resolve Scope details for next_entity_serial
  v_scope_type := CASE
    WHEN v_order.city_branch_id IS NOT NULL THEN 'city_branch'
    WHEN v_order.country_branch_id IS NOT NULL THEN 'main_branch'
    WHEN v_order.country_id IS NOT NULL THEN 'country'
    ELSE 'global'
  END;

  v_scope_key := CASE
    WHEN v_order.city_branch_id IS NOT NULL THEN v_order.city_branch_id::text
    WHEN v_order.country_branch_id IS NOT NULL THEN v_order.country_branch_id::text
    WHEN v_order.country_id IS NOT NULL THEN v_order.country_id::text
    ELSE 'global'
  END;

  -- 1. Generate independent Journal/Roznamcha Serial Number
  IF p_kind = 'booking' THEN
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'roznamcha', 'BUS');
  ELSIF v_is_cash THEN
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'payment', 'CSH');
  ELSIF v_is_bank THEN
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'loading', 'BNK');
  ELSE
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'roznamcha', 'BUS');
  END IF;

  -- 2. Generate independent Voucher Serial Number
  IF p_kind = 'booking' THEN
    v_voucher := next_entity_serial(v_scope_type, v_scope_key, 'purchase', 'CRV');
  ELSE
    v_voucher := next_entity_serial(v_scope_type, v_scope_key, 'journal', 'DRV');
  END IF;

  -- 3. Generate independent GL Transaction Reference
  v_gl_ref := next_entity_serial(v_scope_type, v_scope_key, 'general', 'GLR');
  v_reference_no := COALESCE(NULLIF(TRIM(p_reference_no), ''), v_gl_ref);

  -- Create double-entry lines in Final Local Currency (v_local_currency)
  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', COALESCE(NULLIF(TRIM(p_narration), ''), 'Purchase payment debit'),
      'debit', v_base_amount,
      'credit', 0,
      'currency', v_local_currency,
      'usdRate', v_line_rate
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', COALESCE(NULLIF(TRIM(p_narration), ''), 'Purchase payment credit'),
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
    v_reference_no,
    COALESCE(NULLIF(TRIM(p_narration), ''), CONCAT('Purchase payment for ', v_reference_no)),
    v_lines,
    true
  );

  UPDATE roznamcha_entries
  SET
    source_module = 'purchase',
    source_transaction_type = CASE p_kind::text
      WHEN 'booking' THEN 'purchase_booking_transfer'
      WHEN 'advance' THEN 'purchase_advance_payment'
      WHEN 'remaining' THEN 'purchase_remaining_payment'
      WHEN 'credit' THEN 'purchase_credit_payment'
      WHEN 'final' THEN 'purchase_final_payment'
      ELSE 'purchase_order_payment'
    END,
    source_transaction_id = p_purchase_order_id,
    source_reference_no = v_reference_no,
    original_currency_code = v_orig_currency,
    currency_name = v_local_currency,
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
    v_base_amount,
    v_local_currency,
    v_exchange_rate,
    p_debit_ledger_id,
    p_credit_ledger_id,
    v_entry_id,
    'posted',
    v_reference_no,
    p_narration,
    'purchase',
    CASE p_kind::text
      WHEN 'booking' THEN 'purchase_booking_transfer'
      WHEN 'advance' THEN 'purchase_advance_payment'
      WHEN 'remaining' THEN 'purchase_remaining_payment'
      WHEN 'credit' THEN 'purchase_credit_payment'
      WHEN 'final' THEN 'purchase_final_payment'
      ELSE 'purchase_payment'
    END,
    v_reference_no,
    v_orig_currency,
    v_local_currency,
    v_base_amount,
    true,
    NOW(),
    auth.uid(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_po_payment_id;

  RETURN v_po_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_sales_order_payment(
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
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ELSIF v_order.order_total > 0 AND (p_payment_kind = 'booking' OR v_exchange_rate >= 1000 OR COALESCE(p_amount, 0) >= 1000000000) THEN
    v_base_amount := ROUND(v_order.order_total, 4);
    v_line_rate := CASE WHEN COALESCE(p_amount, 0) > 0 THEN ROUND(v_base_amount / p_amount, 8) ELSE 1 END;
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
    COALESCE(NULLIF(TRIM(p_reference_no), ''), v_journal),
    COALESCE(NULLIF(TRIM(p_narration), ''), CONCAT('Sales payment for ', v_order.sales_order_no)),
    v_lines,
    true
  );

  UPDATE roznamcha_entries
  SET
    source_module = 'sales',
    source_transaction_type = 'sales_order_payment',
    source_transaction_id = p_sales_order_id,
    source_reference_no = COALESCE(NULLIF(TRIM(p_reference_no), ''), v_journal)
  WHERE id = v_entry_id;

  INSERT INTO sales_order_payments (
    sales_order_id,
    kind,
    entry_date,
    amount,
    currency_code,
    exchange_rate,
    base_currency_amount,
    debit_ledger_id,
    credit_ledger_id,
    roznamcha_entry_id,
    status,
    reference_no,
    narration,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    p_sales_order_id,
    p_payment_kind,
    p_entry_date,
    p_amount,
    v_currency,
    v_exchange_rate,
    v_base_amount,
    p_debit_ledger_id,
    p_credit_ledger_id,
    v_entry_id,
    'posted',
    p_reference_no,
    p_narration,
    auth.uid(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$function$;
