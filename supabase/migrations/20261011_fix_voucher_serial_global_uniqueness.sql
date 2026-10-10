-- Migration: 20261011_fix_voucher_serial_global_uniqueness.sql
-- 1. Fixes voucher_no serial collision (DRV-00000001) safely without deleting, overwriting, or renumbering genuine records.
-- 2. Restores automatic parent order balance recalculation in post_purchase_order_payment and post_sales_order_payment.

BEGIN;

-- 1. Ensure transaction_serial_sequences has global rows for DRV, CRV, BUS, CSH, BNK seeded above existing max values
DO $$
DECLARE
  v_max_drv bigint;
  v_max_crv bigint;
  v_max_bus bigint;
  v_max_csh bigint;
  v_max_bnk bigint;
BEGIN
  -- Find maximum numbers in existing roznamcha_entries without modifying them
  SELECT COALESCE(MAX(SUBSTRING(voucher_no FROM 5)::bigint), 0) INTO v_max_drv
  FROM roznamcha_entries WHERE voucher_no ~ '^DRV-[0-9]+$';

  SELECT COALESCE(MAX(SUBSTRING(voucher_no FROM 5)::bigint), 0) INTO v_max_crv
  FROM roznamcha_entries WHERE voucher_no ~ '^CRV-[0-9]+$';

  SELECT COALESCE(MAX(SUBSTRING(journal_no FROM 5)::bigint), 0) INTO v_max_bus
  FROM roznamcha_entries WHERE journal_no ~ '^BUS-[0-9]+$';

  SELECT COALESCE(MAX(SUBSTRING(journal_no FROM 5)::bigint), 0) INTO v_max_csh
  FROM roznamcha_entries WHERE journal_no ~ '^CSH-[0-9]+$';

  SELECT COALESCE(MAX(SUBSTRING(journal_no FROM 5)::bigint), 0) INTO v_max_bnk
  FROM roznamcha_entries WHERE journal_no ~ '^BNK-[0-9]+$';

  -- Seed / update global sequence counters
  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('global', 'GLOBAL', 'journal', 'DRV', v_max_drv + 1)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET
    next_value = GREATEST(transaction_serial_sequences.next_value, v_max_drv + 1),
    prefix = 'DRV',
    updated_at = NOW();

  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('global', 'GLOBAL', 'purchase', 'CRV', v_max_crv + 1)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET
    next_value = GREATEST(transaction_serial_sequences.next_value, v_max_crv + 1),
    prefix = 'CRV',
    updated_at = NOW();

  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('global', 'GLOBAL', 'roznamcha', 'BUS', v_max_bus + 1)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET
    next_value = GREATEST(transaction_serial_sequences.next_value, v_max_bus + 1),
    prefix = 'BUS',
    updated_at = NOW();

  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('global', 'GLOBAL', 'payment', 'CSH', v_max_csh + 1)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET
    next_value = GREATEST(transaction_serial_sequences.next_value, v_max_csh + 1),
    prefix = 'CSH',
    updated_at = NOW();

  INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
  VALUES ('global', 'GLOBAL', 'loading', 'BNK', v_max_bnk + 1)
  ON CONFLICT (scope_type, scope_key, entity_type)
  DO UPDATE SET
    next_value = GREATEST(transaction_serial_sequences.next_value, v_max_bnk + 1),
    prefix = 'BNK',
    updated_at = NOW();
END;
$$;

-- 2. Update next_entity_serial to enforce global scope and collision resistance for voucher prefixes
CREATE OR REPLACE FUNCTION next_entity_serial(
  p_scope_type text,
  p_scope_key text,
  p_entity_type text,
  p_prefix text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
  v_prefix text;
  v_scope_key text;
  v_scope_type text;
  v_entity_type text;
  v_result text;
  v_attempt int := 0;
BEGIN
  v_prefix := UPPER(COALESCE(NULLIF(TRIM(p_prefix), ''), 'SER'));
  v_entity_type := LOWER(COALESCE(NULLIF(TRIM(p_entity_type), ''), 'general'));

  -- For global voucher numbers (DRV, CRV), enforce unified global scope
  -- because roznamcha_entries enforces a unique index on voucher_no table-wide
  IF v_prefix IN ('DRV', 'CRV') THEN
    v_scope_type := 'global';
    v_scope_key := 'GLOBAL';
  ELSE
    v_scope_type := LOWER(COALESCE(NULLIF(TRIM(p_scope_type), ''), 'global'));
    v_scope_key := COALESCE(NULLIF(TRIM(p_scope_key), ''), 'GLOBAL');
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 1000 THEN
      RAISE EXCEPTION 'next_entity_serial: Exceeded 1000 attempts allocating unique serial for %', v_prefix;
    END IF;

    INSERT INTO public.transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
    VALUES (v_scope_type, v_scope_key, v_entity_type, v_prefix, 2)
    ON CONFLICT (scope_type, scope_key, entity_type)
    DO UPDATE SET
      next_value = transaction_serial_sequences.next_value + 1,
      prefix = EXCLUDED.prefix,
      updated_at = NOW()
    RETURNING transaction_serial_sequences.next_value - 1 INTO v_next;

    v_result := v_prefix || '-' || LPAD(v_next::text, 8, '0');

    -- Collision check: If generated voucher_no or journal_no already exists in roznamcha_entries,
    -- loop and take the next number without failing
    IF v_prefix IN ('DRV', 'CRV') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.roznamcha_entries
        WHERE voucher_no = v_result AND deleted_at IS NULL
      ) THEN
        EXIT;
      END IF;
    ELSIF v_prefix IN ('BUS', 'CSH', 'BNK') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.roznamcha_entries
        WHERE journal_no = v_result AND deleted_at IS NULL
      ) THEN
        EXIT;
      END IF;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION next_entity_serial(text, text, text, text) TO authenticated, service_role, anon;

-- 3. Update post_purchase_order_payment to call recalc_purchase_order_payment_totals
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

  SELECT COALESCE(currency_code, 'AED') INTO v_local_currency
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

  SELECT code, name INTO v_credit_code, v_credit_name
  FROM ledgers
  WHERE id = p_credit_ledger_id;

  IF (v_credit_code ILIKE '%CSH%' OR v_credit_name ILIKE '%cash%') THEN
    v_is_cash := true;
  END IF;
  IF (v_credit_code ILIKE '%BNK%' OR v_credit_name ILIKE '%bank%') THEN
    v_is_bank := true;
  END IF;

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

  IF p_kind = 'booking' THEN
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'roznamcha', 'BUS');
  ELSIF v_is_cash THEN
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'payment', 'CSH');
  ELSIF v_is_bank THEN
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'loading', 'BNK');
  ELSE
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'roznamcha', 'BUS');
  END IF;

  IF p_kind = 'booking' THEN
    v_voucher := next_entity_serial(v_scope_type, v_scope_key, 'purchase', 'CRV');
  ELSE
    v_voucher := next_entity_serial(v_scope_type, v_scope_key, 'journal', 'DRV');
  END IF;

  v_gl_ref := next_entity_serial(v_scope_type, v_scope_key, 'general', 'GLR');
  v_reference_no := COALESCE(NULLIF(TRIM(p_reference_no), ''), v_gl_ref);

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

  v_po_payment_id := gen_random_uuid();

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
    source_transaction_id = CASE WHEN p_kind = 'booking' THEN v_order.id ELSE v_po_payment_id END,
    source_reference_no = v_reference_no,
    original_currency_code = v_orig_currency,
    currency_name = v_local_currency,
    base_currency_amount = v_base_amount
  WHERE id = v_entry_id;

  INSERT INTO purchase_order_payments (
    id,
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
    v_po_payment_id,
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
    CASE p_kind
      WHEN 'booking' THEN 'purchase_booking_transfer'
      WHEN 'advance' THEN 'purchase_advance_payment'
      WHEN 'remaining' THEN 'purchase_remaining_payment'
      WHEN 'credit' THEN 'purchase_credit_payment'
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
  );

  -- Perform automatic balance recalculation on parent purchase order
  PERFORM public.recalc_purchase_order_payment_totals(v_order.id);

  RETURN v_po_payment_id;
END;
$$;

-- 4. Update post_sales_order_payment to call recalc_sales_order_payment_totals
CREATE OR REPLACE FUNCTION post_sales_order_payment(
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
SET search_path = public
AS $$
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
    COALESCE(NULLIF(TRIM(p_reference_no), ''), v_voucher),
    COALESCE(NULLIF(TRIM(p_narration), ''), CONCAT('Sales payment for ', v_voucher)),
    v_lines,
    true
  );

  v_payment_id := gen_random_uuid();

  UPDATE roznamcha_entries
  SET
    source_module = 'sales',
    source_transaction_type = 'sales_payment',
    source_transaction_id = v_payment_id,
    source_reference_no = COALESCE(NULLIF(TRIM(p_reference_no), ''), v_voucher),
    original_currency_code = v_orig_currency,
    currency_name = v_local_currency,
    base_currency_amount = v_base_amount
  WHERE id = v_entry_id;

  INSERT INTO sales_order_payments (
    id,
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
    v_payment_id,
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
  );

  -- Perform automatic balance recalculation on parent sales order
  PERFORM public.recalc_sales_order_payment_totals(v_order.id);

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION post_purchase_order_payment(uuid, purchase_order_payment_kind, date, numeric, text, numeric, uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION post_sales_order_payment(uuid, text, date, numeric, text, numeric, uuid, uuid, text, text) TO authenticated, service_role;

COMMIT;
