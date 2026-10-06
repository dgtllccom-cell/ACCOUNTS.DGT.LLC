-- Fix: post_roznamcha_entry column reference "debit_total" is ambiguous
-- Rename local variables debit_total / credit_total to v_debit_total / v_credit_total
-- and qualify column references ledgers.debit_total explicitly.

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
  v_debit_total numeric(18, 4) := 0;
  v_credit_total numeric(18, 4) := 0;

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

    v_debit_total := v_debit_total + line_debit;
    v_credit_total := v_credit_total + line_credit;
  END LOOP;

  IF ROUND(v_debit_total, 4) <> ROUND(v_credit_total, 4) OR v_debit_total <= 0 THEN
    RAISE EXCEPTION 'Debit total must equal credit total';
  END IF;

  -- Generate Prefixes
  IF p_country_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(iso2, ''), COALESCE(NULLIF(iso3, ''), name))
    INTO v_country_prefix
    FROM countries WHERE id = p_country_id;
    v_country_prefix := COALESCE(regexp_replace(UPPER(v_country_prefix), '[^A-Z0-9]', '', 'g'), 'CNT');
  END IF;

  IF p_country_branch_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(code, ''), name)
    INTO v_main_branch_prefix
    FROM country_branches WHERE id = p_country_branch_id;
    v_main_branch_prefix := COALESCE(regexp_replace(UPPER(v_main_branch_prefix), '[^A-Z0-9]', '', 'g'), 'MB');
  END IF;

  IF p_city_branch_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(code, ''), name)
    INTO v_city_branch_prefix
    FROM city_branches WHERE id = p_city_branch_id;
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
        FROM ledgers l
        WHERE l.id = line_ledger_id
          AND l.deleted_at IS NULL
          AND (
            is_super_admin()
            OR (l.country_id IS NOT NULL AND can_access_country(l.country_id))
            OR (l.country_branch_id IS NOT NULL AND can_access_country_branch(l.country_branch_id))
            OR (l.city_branch_id IS NOT NULL AND can_access_city_branch(l.city_branch_id))
          )
      ) THEN
        RAISE EXCEPTION 'Ledger scope is not allowed';
      END IF;
    END IF;

    SELECT * INTO ledger_record
    FROM ledgers
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

    -- Update Ledger Totals and Current Balance with explicit ledgers. prefix
    UPDATE ledgers
    SET debit_total = ledgers.debit_total + line_debit,
        credit_total = ledgers.credit_total + line_credit,
        current_balance = ledgers.current_balance + line_debit - line_credit,
        updated_at = NOW()
    WHERE id = line_ledger_id;

    -- Update Enterprise Account Balance
    IF COALESCE(line_account_id, ledger_record.enterprise_account_id) IS NOT NULL THEN
      UPDATE enterprise_accounts
      SET current_balance = enterprise_accounts.current_balance + line_debit - line_credit,
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
      'debit_total', v_debit_total,
      'credit_total', v_credit_total
    )
  );

  RETURN v_entry_id;
END;
$$;
