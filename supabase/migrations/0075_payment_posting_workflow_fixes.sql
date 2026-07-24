-- Migration: Fixed Payment posting, Roznamcha and Ledger Workflow
-- Adds balance updates to post_roznamcha_entry
-- Adds Final (Local) Currency resolution, actual exchange rate storage, and independent document serials (CSH/BNK/BUS/DRV/CRV/GLR) to post_purchase_order_payment.

-- ============================================================================
-- Part 1: Corrected post_roznamcha_entry
-- ============================================================================
CREATE OR REPLACE FUNCTION post_roznamcha_entry(
  p_type roznamcha_type,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  p_journal_no text,
  p_voucher_no text,
  p_entry_date date,
  p_payment_method_id uuid,
  p_reference_no text,
  p_narration text,
  p_lines jsonb,
  p_bypass_ledger_scope boolean default false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  line_item jsonb;
  ledger_scope_value ledger_scope;
  line_account_id uuid;
  line_ledger_id uuid;
  line_payment_type payment_entry_type;
  line_description text;
  line_debit numeric(18, 4);
  line_credit numeric(18, 4);
  line_currency text;
  line_usd_rate numeric(18, 8);
  debit_total numeric(18, 4) := 0;
  credit_total numeric(18, 4) := 0;

  v_country_prefix text := 'CNT';
  v_main_branch_prefix text := 'MB';
  v_city_branch_prefix text := 'CB';
  
  v_super_admin_serial text;
  v_country_serial text;
  v_branch_serial text;
  v_main_branch_serial text;
  v_city_branch_serial text;
  v_entry_serial text;

  ledger_record record;
BEGIN
  ledger_scope_value := CASE
    WHEN p_type = 'super_admin' THEN 'super_admin'::ledger_scope
    WHEN p_type = 'country' THEN 'country'::ledger_scope
    WHEN p_type = 'branch' AND p_city_branch_id IS NULL AND p_country_branch_id IS NOT NULL THEN 'main_branch'::ledger_scope
    ELSE 'city_branch'::ledger_scope
  END;

  IF NOT p_bypass_ledger_scope THEN
    PERFORM assert_enterprise_scope_access(ledger_scope_value, p_country_id, p_country_branch_id, p_city_branch_id);
  END IF;
  
  PERFORM assert_financial_period_open(ledger_scope_value, p_country_id, p_country_branch_id, p_city_branch_id, p_entry_date);

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'At least two Roznamcha lines are required';
  END IF;

  -- Validate amounts & balances
  FOR line_item IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    line_debit := COALESCE((line_item ->> 'debit')::numeric, 0);
    line_credit := COALESCE((line_item ->> 'credit')::numeric, 0);
    line_usd_rate := COALESCE((COALESCE(line_item ->> 'exchangeRate', line_item ->> 'usdRate'))::numeric, 1);

    IF (line_debit > 0 AND line_credit > 0) OR (line_debit = 0 AND line_credit = 0) THEN
      RAISE EXCEPTION 'Each Roznamcha line must contain either debit or credit';
    END IF;

    IF line_debit < 0 OR line_credit < 0 OR line_usd_rate <= 0 THEN
      RAISE EXCEPTION 'Roznamcha amounts and USD rate must be valid';
    END IF;

    debit_total := debit_total + line_debit;
    credit_total := credit_total + line_credit;
  END LOOP;

  IF ROUND(debit_total, 4) <> ROUND(credit_total, 4) OR debit_total <= 0 THEN
    RAISE EXCEPTION 'Debit total must equal credit total';
  END IF;

  -- Generate Prefixes
  IF p_country_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(iso2, ''), COALESCE(NULLIF(iso3, ''), name))
    INTO v_country_prefix
    from countries WHERE id = p_country_id;
    v_country_prefix := COALESCE(regexp_replace(UPPER(v_country_prefix), '[^A-Z0-9]', '', 'g'), 'CNT');
  END IF;

  IF p_country_branch_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(code, ''), name)
    INTO v_main_branch_prefix
    from country_branches WHERE id = p_country_branch_id;
    v_main_branch_prefix := COALESCE(regexp_replace(UPPER(v_main_branch_prefix), '[^A-Z0-9]', '', 'g'), 'MB');
  END IF;

  IF p_city_branch_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(code, ''), name)
    INTO v_city_branch_prefix
    from city_branches WHERE id = p_city_branch_id;
    v_city_branch_prefix := COALESCE(regexp_replace(UPPER(v_city_branch_prefix), '[^A-Z0-9]', '', 'g'), 'CB');
  END IF;

  -- Generate Transaction Serials
  v_super_admin_serial := next_transaction_serial('global', 'global', 'SA');
  v_entry_serial := next_transaction_serial('module_roznamcha', 'global', 'ROZ');
  
  IF p_country_id IS NOT NULL THEN
    v_country_serial := next_transaction_serial('country', p_country_id::text, v_country_prefix);
  END IF;

  IF COALESCE(p_city_branch_id, p_country_branch_id) IS NOT NULL THEN
    v_branch_serial := next_transaction_serial(
      'branch',
      COALESCE(p_city_branch_id, p_country_branch_id)::text,
      CASE WHEN p_city_branch_id IS NOT NULL THEN v_city_branch_prefix ELSE v_main_branch_prefix END
    );
  END IF;

  IF p_country_branch_id IS NOT NULL THEN
    v_main_branch_serial := next_transaction_serial('main_branch', p_country_branch_id::text, v_main_branch_prefix);
  END IF;

  IF p_city_branch_id IS NOT NULL THEN
    v_city_branch_serial := next_transaction_serial('city_branch', p_city_branch_id::text, v_city_branch_prefix);
  END IF;

  INSERT INTO roznamcha_entries (
    type,
    country_id,
    country_branch_id,
    city_branch_id,
    journal_no,
    voucher_no,
    entry_date,
    payment_method_id,
    reference_no,
    narration,
    status,
    created_by,
    posted_at,
    super_admin_serial_number,
    country_transaction_serial_number,
    branch_transaction_serial_number
  )
  VALUES (
    p_type,
    p_country_id,
    p_country_branch_id,
    p_city_branch_id,
    p_journal_no,
    p_voucher_no,
    p_entry_date,
    p_payment_method_id,
    NULLIF(TRIM(p_reference_no), ''),
    NULLIF(TRIM(p_narration), ''),
    'posted',
    auth.uid(),
    NOW(),
    v_super_admin_serial,
    v_country_serial,
    v_branch_serial
  )
  RETURNING id INTO v_entry_id;

  -- Process lines and update balances
  FOR line_item IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    line_payment_type := COALESCE(line_item ->> 'paymentEntryType', line_item ->> 'payment_entry_type')::payment_entry_type;
    line_ledger_id := (line_item ->> 'ledgerId')::uuid;
    line_description := NULLIF(TRIM(line_item ->> 'description'), '');
    line_debit := COALESCE((line_item ->> 'debit')::numeric, 0);
    line_credit := COALESCE((line_item ->> 'credit')::numeric, 0);
    line_currency := UPPER(TRIM(COALESCE(line_item ->> 'currency', 'USD')));
    line_usd_rate := COALESCE((COALESCE(line_item ->> 'exchangeRate', line_item ->> 'usdRate'))::numeric, 1);

    IF line_ledger_id IS NULL THEN
      RAISE EXCEPTION 'Roznamcha line must specify a ledger ID';
    END IF;

    IF NOT p_bypass_ledger_scope THEN
      IF NOT EXISTS (
        SELECT 1
        from ledgers l
        WHERE l.id = line_ledger_id
          and l.deleted_at IS NULL
          and (
            is_super_admin()
            or (l.country_id IS NOT NULL AND can_access_country(l.country_id))
            or (l.country_branch_id IS NOT NULL AND can_access_country_branch(l.country_branch_id))
            or (l.city_branch_id IS NOT NULL AND can_access_city_branch(l.city_branch_id))
          )
      ) THEN
        RAISE EXCEPTION 'Ledger scope is not allowed';
      END IF;
    END IF;

    SELECT * INTO ledger_record
    from ledgers
    WHERE id = line_ledger_id;

    line_account_id := ledger_record.account_id;

    -- Insert Roznamcha line
    INSERT INTO roznamcha_lines (
      roznamcha_entry_id,
      payment_entry_type,
      account_id,
      ledger_id,
      description,
      debit,
      credit,
      currency,
      usd_rate,
      usd_amount,
      super_admin_serial_number,
      country_transaction_serial_number,
      branch_transaction_serial_number,
      main_branch_transaction_serial,
      city_branch_transaction_serial,
      entry_serial_number
    )
    VALUES (
      v_entry_id,
      line_payment_type,
      line_account_id,
      line_ledger_id,
      line_description,
      line_debit,
      line_credit,
      line_currency,
      line_usd_rate,
      ROUND((line_debit + line_credit) * line_usd_rate, 4),
      v_super_admin_serial,
      v_country_serial,
      v_branch_serial,
      v_main_branch_serial,
      v_city_branch_serial,
      v_entry_serial
    );

    -- Update Ledger Totals and Current Balance
    UPDATE ledgers
    SET debit_total = debit_total + line_debit,
        credit_total = credit_total + line_credit,
        current_balance = current_balance + line_debit - line_credit,
        updated_at = NOW()
    WHERE id = line_ledger_id;

    -- Update Enterprise Account Balance
    IF COALESCE(line_account_id, ledger_record.enterprise_account_id) IS NOT NULL THEN
      UPDATE enterprise_accounts
      SET current_balance = current_balance + line_debit - line_credit,
          updated_at = NOW()
      WHERE id = COALESCE(line_account_id, ledger_record.enterprise_account_id);
    END IF;

    -- Upsert daily ledger balance
    INSERT INTO ledger_balances (
      ledger_id,
      balance_date,
      opening_balance,
      debit_total,
      credit_total,
      closing_balance
    )
    VALUES (
      line_ledger_id,
      p_entry_date,
      0,
      line_debit,
      line_credit,
      line_debit - line_credit
    )
    ON CONFLICT (ledger_id, balance_date) DO UPDATE
    SET debit_total = ledger_balances.debit_total + excluded.debit_total,
        credit_total = ledger_balances.credit_total + excluded.credit_total,
        closing_balance = ledger_balances.closing_balance + excluded.closing_balance,
        updated_at = NOW();
  END LOOP;

  -- Record audit log
  PERFORM write_erp_audit_log(
    'post',
    'roznamcha_entries',
    v_entry_id,
    NULL,
    jsonb_build_object(
      'type', p_type,
      'journal_no', p_journal_no,
      'voucher_no', p_voucher_no,
      'entry_date', p_entry_date,
      'debit_total', debit_total,
      'credit_total', credit_total
    )
  );

  RETURN v_entry_id;
END;
$$;


-- ============================================================================
-- Part 2: Corrected post_purchase_order_payment
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
  v_local_currency text;
  
  v_credit_code text;
  v_credit_name text;
  v_is_cash boolean := false;
  v_is_bank boolean := false;
  
  v_scope_type text;
  v_scope_key text;
  v_gl_ref text;
BEGIN
  SELECT * INTO v_order
  from purchase_orders
  WHERE id = p_purchase_order_id
    and deleted_at IS NULL;

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
  from countries
  WHERE id = v_order.country_id;

  v_currency := UPPER(TRIM(COALESCE(p_currency_code, v_order.currency_code, 'USD')));
  v_exchange_rate := CASE WHEN COALESCE(p_exchange_rate, 0) <= 0 THEN 1 ELSE p_exchange_rate END;
  
  -- Converted amount in final local currency
  v_base_amount := ROUND(COALESCE(p_amount, 0) * v_exchange_rate, 4);

  v_roz_type := CASE
    WHEN v_order.city_branch_id IS NOT NULL OR v_order.country_branch_id IS NOT NULL THEN 'branch'::roznamcha_type
    WHEN v_order.country_id IS NOT NULL THEN 'country'::roznamcha_type
    ELSE 'super_admin'::roznamcha_type
  END;

  -- Check if credit ledger is Cash or Bank to assign correct serials
  SELECT code, name INTO v_credit_code, v_credit_name
  from ledgers
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
    -- Business Roznamcha Counter
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'roznamcha', 'BUS');
  ELSIF v_is_cash THEN
    -- Cash Roznamcha Counter
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'payment', 'CSH');
  ELSIF v_is_bank THEN
    -- Bank Roznamcha Counter
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'loading', 'BNK');
  ELSE
    -- Fallback Business Roznamcha
    v_journal := next_entity_serial(v_scope_type, v_scope_key, 'roznamcha', 'BUS');
  END IF;

  -- 2. Generate independent Voucher Serial Number
  IF p_kind = 'booking' THEN
    -- Credit Voucher Counter
    v_voucher := next_entity_serial(v_scope_type, v_scope_key, 'purchase', 'CRV');
  ELSE
    -- Debit Voucher Counter
    v_voucher := next_entity_serial(v_scope_type, v_scope_key, 'journal', 'DRV');
  END IF;

  -- 3. Generate independent GL Transaction Reference
  v_gl_ref := next_entity_serial(v_scope_type, v_scope_key, 'general', 'GLR');
  v_reference_no := COALESCE(NULLIF(TRIM(p_reference_no), ''), v_gl_ref);

  -- Converted USD rate for roznamcha lines
  v_line_rate := CASE WHEN v_exchange_rate = 0 THEN 1 ELSE 1 / v_exchange_rate END;

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
    p_amount,
    v_currency,
    v_exchange_rate,
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
    v_local_currency,
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
