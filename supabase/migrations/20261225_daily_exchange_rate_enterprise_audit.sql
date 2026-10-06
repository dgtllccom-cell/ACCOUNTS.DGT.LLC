-- Migration: 20261225_daily_exchange_rate_enterprise_audit.sql
-- Description: Strengthen and unify Daily Exchange Rate system ERP-wide:
-- 1. Add audit columns (old/new credit & debit rates, user_name) and RLS to exchange_rate_history.
-- 2. Update get_daily_rate to strictly match target date and prevent silent historical rate fallback.
-- 3. Fix post_roznamcha_entry USD conversion calculation (local amount / rate when rate >= 1) to eliminate double conversion and inverted calculation.

BEGIN;

-- 1. exchange_rate_history audit columns
ALTER TABLE public.exchange_rate_history
  ADD COLUMN IF NOT EXISTS old_credit_rate numeric(18, 8),
  ADD COLUMN IF NOT EXISTS old_debit_rate numeric(18, 8),
  ADD COLUMN IF NOT EXISTS new_credit_rate numeric(18, 8),
  ADD COLUMN IF NOT EXISTS new_debit_rate numeric(18, 8),
  ADD COLUMN IF NOT EXISTS user_name text;

ALTER TABLE public.exchange_rate_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchange_rate_history_scope_read ON public.exchange_rate_history;
CREATE POLICY exchange_rate_history_scope_read ON public.exchange_rate_history
  FOR SELECT TO public
  USING (is_super_admin() OR can_access_country(country_id));

DROP POLICY IF EXISTS exchange_rate_history_admin_write ON public.exchange_rate_history;
CREATE POLICY exchange_rate_history_admin_write ON public.exchange_rate_history
  FOR ALL TO public
  USING (is_super_admin() OR can_manage_country(country_id))
  WITH CHECK (is_super_admin() OR can_manage_country(country_id));

-- 2. get_daily_rate function (strictly target date, country-wide allocation)
CREATE OR REPLACE FUNCTION public.get_daily_rate(
  p_country_id uuid,
  p_country_branch_id uuid DEFAULT NULL::uuid,
  p_date text DEFAULT NULL::text,
  p_at timestamptz DEFAULT NULL::timestamptz
)
RETURNS TABLE(
  rate_date text,
  buying_rate numeric,
  selling_rate numeric,
  credit_rate numeric,
  debit_rate numeric,
  is_exact_date boolean,
  is_branch_specific boolean,
  effective_from timestamptz,
  currency_code text
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_target_date text;
BEGIN
  v_target_date := COALESCE(p_date, to_char(COALESCE(p_at, now()), 'YYYY-MM-DD'));

  RETURN QUERY
  SELECT
    r.rate_date::text,
    r.buying_rate::numeric,
    r.selling_rate::numeric,
    r.credit_rate::numeric,
    r.debit_rate::numeric,
    true AS is_exact_date,
    (r.country_branch_id IS NOT NULL) AS is_branch_specific,
    r.effective_from,
    r.currency_code
  FROM public.daily_usd_rates r
  WHERE r.deleted_at IS NULL
    AND r.country_id = p_country_id
    AND r.rate_date = v_target_date::date
    AND (p_country_branch_id IS NULL OR r.country_branch_id = p_country_branch_id OR r.country_branch_id IS NULL)
  ORDER BY
    (CASE WHEN r.country_branch_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
    r.effective_from DESC
  LIMIT 1;
END;
$function$;

-- 3. post_roznamcha_entry with accurate USD calculation
CREATE OR REPLACE FUNCTION public.post_roznamcha_entry(
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
  p_bypass_ledger_scope boolean DEFAULT false
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  line_usd_amount numeric(18, 4);
  v_debit_total numeric(18, 4) := 0;
  v_credit_total numeric(18, 4) := 0;

  v_country_prefix text := 'CNT';
  v_main_branch_prefix text := 'MB';
  v_city_branch_prefix text := 'CB';
  
  -- Header serials
  v_super_admin_serial text;
  v_country_serial text;
  v_branch_serial text;
  v_main_branch_serial text;
  v_city_branch_serial text;
  v_entry_serial text;

  -- Per-line scoped serials
  line_super_admin_serial text;
  line_country_serial text;
  line_branch_serial text;
  line_main_branch_serial text;
  line_city_branch_serial text;
  line_entry_serial text;

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

  -- Generate Header Serials
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

  -- Process lines, generate distinct 4-level serials per line, and update balances
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

    -- Allocate distinct 4-level scoped serials for this line
    line_super_admin_serial := next_transaction_serial('global', 'global', 'SA');
    line_entry_serial := next_transaction_serial('module_roznamcha', 'global', 'ROZ');

    IF p_country_id IS NOT NULL THEN
      line_country_serial := next_transaction_serial('country', p_country_id::text, v_country_prefix);
    ELSE
      line_country_serial := NULL;
    END IF;

    IF COALESCE(p_city_branch_id, p_country_branch_id) IS NOT NULL THEN
      line_branch_serial := next_transaction_serial(
        'branch',
        COALESCE(p_city_branch_id, p_country_branch_id)::text,
        CASE WHEN p_city_branch_id IS NOT NULL THEN v_city_branch_prefix ELSE v_main_branch_prefix END
      );
    ELSE
      line_branch_serial := NULL;
    END IF;

    IF p_country_branch_id IS NOT NULL THEN
      line_main_branch_serial := next_transaction_serial('main_branch', p_country_branch_id::text, v_main_branch_prefix);
    ELSE
      line_main_branch_serial := NULL;
    END IF;

    IF p_city_branch_id IS NOT NULL THEN
      line_city_branch_serial := next_transaction_serial('city_branch', p_city_branch_id::text, v_city_branch_prefix);
    ELSE
      line_city_branch_serial := NULL;
    END IF;

    -- Compute correct USD amount (NEVER invert: local amount / rate when rate >= 1)
    line_usd_amount := CASE
      WHEN line_currency = 'USD' THEN (line_debit + line_credit)
      WHEN line_usd_rate >= 1 THEN ROUND((line_debit + line_credit) / line_usd_rate, 4)
      WHEN line_usd_rate > 0 THEN ROUND((line_debit + line_credit) * line_usd_rate, 4)
      ELSE (line_debit + line_credit)
    END;

    -- Insert Roznamcha line with its own distinct 4 serials
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
      line_usd_amount,
      line_super_admin_serial,
      line_country_serial,
      line_branch_serial,
      line_main_branch_serial,
      line_city_branch_serial,
      line_entry_serial
    );

    -- Update Ledger Totals and Current Balance with explicit ledgers. prefix
    UPDATE ledgers
    SET debit_total = ledgers.debit_total + line_debit,
        credit_total = ledgers.credit_total + line_credit,
        current_balance = ledgers.current_balance + line_debit - line_credit,
        updated_at = NOW()
    WHERE id = line_ledger_id;

    -- Update Enterprise Account balances if linked
    IF line_account_id IS NOT NULL THEN
      UPDATE enterprise_accounts
      SET debit_total = enterprise_accounts.debit_total + line_debit,
          credit_total = enterprise_accounts.credit_total + line_credit,
          current_balance = enterprise_accounts.current_balance + line_debit - line_credit,
          updated_at = NOW()
      WHERE id = line_account_id;
    END IF;
  END LOOP;

  RETURN v_entry_id;
END;
$function$;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20261225_daily_exchange_rate_enterprise_audit', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
