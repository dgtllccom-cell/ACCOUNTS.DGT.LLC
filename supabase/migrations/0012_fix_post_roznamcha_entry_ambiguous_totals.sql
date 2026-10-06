-- Fix: `post_roznamcha_entry` had ambiguous references to `debit_total` / `credit_total`
-- because the function defines variables with the same names as ledger columns.
-- Qualify column references to avoid ambiguity.

create or replace function post_roznamcha_entry(
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
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_id uuid;
  ledger_scope_value ledger_scope;
  line_item jsonb;
  line_account_id uuid;
  line_enterprise_account_id uuid;
  line_ledger_id uuid;
  line_payment_type payment_entry_type;
  line_description text;
  line_debit numeric(18, 4);
  line_credit numeric(18, 4);
  line_currency text;
  line_usd_rate numeric(18, 8);
  debit_total numeric(18, 4) := 0;
  credit_total numeric(18, 4) := 0;
  ledger_record ledgers%rowtype;
begin
  ledger_scope_value := case
    when p_type = 'super_admin' then 'super_admin'::ledger_scope
    when p_type = 'country' then 'country'::ledger_scope
    else 'city_branch'::ledger_scope
  end;

  perform assert_enterprise_scope_access(ledger_scope_value, p_country_id, p_country_branch_id, p_city_branch_id);
  perform assert_financial_period_open(ledger_scope_value, p_country_id, p_country_branch_id, p_city_branch_id, p_entry_date);

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'At least two Roznamcha lines are required';
  end if;

  for line_item in select * from jsonb_array_elements(p_lines)
  loop
    line_debit := coalesce((line_item ->> 'debit')::numeric, 0);
    line_credit := coalesce((line_item ->> 'credit')::numeric, 0);
    line_usd_rate := coalesce((coalesce(line_item ->> 'exchangeRate', line_item ->> 'usdRate'))::numeric, 1);

    if (line_debit > 0 and line_credit > 0) or (line_debit = 0 and line_credit = 0) then
      raise exception 'Each Roznamcha line must contain either debit or credit';
    end if;

    if line_debit < 0 or line_credit < 0 or line_usd_rate <= 0 then
      raise exception 'Roznamcha amounts and USD rate must be valid';
    end if;

    debit_total := debit_total + line_debit;
    credit_total := credit_total + line_credit;
  end loop;

  if round(debit_total, 4) <> round(credit_total, 4) or debit_total <= 0 then
    raise exception 'Debit total must equal credit total';
  end if;

  insert into roznamcha_entries (
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
    posted_at
  )
  values (
    p_type,
    p_country_id,
    p_country_branch_id,
    p_city_branch_id,
    trim(p_journal_no),
    trim(p_voucher_no),
    p_entry_date,
    p_payment_method_id,
    nullif(trim(coalesce(p_reference_no, '')), ''),
    nullif(trim(coalesce(p_narration, '')), ''),
    'posted',
    auth.uid(),
    now()
  )
  returning id into entry_id;

  for line_item in select * from jsonb_array_elements(p_lines)
  loop
    line_account_id := nullif(coalesce(line_item ->> 'accountId', line_item ->> 'account_id'), '')::uuid;
    line_enterprise_account_id := nullif(coalesce(line_item ->> 'enterpriseAccountId', line_item ->> 'enterprise_account_id'), '')::uuid;
    line_ledger_id := nullif(coalesce(line_item ->> 'ledgerId', line_item ->> 'ledger_id'), '')::uuid;
    line_payment_type := coalesce(line_item ->> 'paymentEntryType', line_item ->> 'payment_entry_type')::payment_entry_type;
    line_description := nullif(trim(coalesce(line_item ->> 'description', '')), '');
    line_debit := coalesce((line_item ->> 'debit')::numeric, 0);
    line_credit := coalesce((line_item ->> 'credit')::numeric, 0);
    line_currency := upper(trim(coalesce(line_item ->> 'currency', 'USD')));
    line_usd_rate := coalesce((coalesce(line_item ->> 'exchangeRate', line_item ->> 'usdRate'))::numeric, 1);

    if line_ledger_id is null then
      raise exception 'ledgerId is required for posting';
    end if;

    select * into ledger_record
    from ledgers
    where id = line_ledger_id
      and deleted_at is null
      and is_active = true;

    if not found then
      raise exception 'Ledger was not found or inactive';
    end if;

    if not enterprise_scope_matches(
      ledger_scope_value,
      p_country_id,
      p_country_branch_id,
      p_city_branch_id,
      ledger_record.scope,
      ledger_record.country_id,
      ledger_record.country_branch_id,
      ledger_record.city_branch_id
    ) then
      raise exception 'Ledger belongs to a different financial scope';
    end if;

    insert into roznamcha_lines (
      roznamcha_entry_id,
      payment_entry_type,
      account_id,
      enterprise_account_id,
      ledger_id,
      description,
      debit,
      credit,
      currency,
      usd_rate,
      usd_amount
    )
    values (
      entry_id,
      line_payment_type,
      line_account_id,
      coalesce(line_enterprise_account_id, ledger_record.enterprise_account_id),
      line_ledger_id,
      line_description,
      line_debit,
      line_credit,
      line_currency,
      line_usd_rate,
      round((line_debit + line_credit) * line_usd_rate, 4)
    );

    update ledgers
    set debit_total = ledgers.debit_total + line_debit,
        credit_total = ledgers.credit_total + line_credit,
        current_balance = ledgers.current_balance + line_debit - line_credit,
        updated_at = now()
    where id = line_ledger_id;

    if coalesce(line_enterprise_account_id, ledger_record.enterprise_account_id) is not null then
      update enterprise_accounts
      set current_balance = enterprise_accounts.current_balance + line_debit - line_credit,
          updated_at = now()
      where id = coalesce(line_enterprise_account_id, ledger_record.enterprise_account_id);
    end if;

    insert into ledger_balances (
      ledger_id,
      balance_date,
      opening_balance,
      debit_total,
      credit_total,
      closing_balance
    )
    values (
      line_ledger_id,
      p_entry_date,
      0,
      line_debit,
      line_credit,
      line_debit - line_credit
    )
    on conflict (ledger_id, balance_date) do update
      set debit_total = ledger_balances.debit_total + excluded.debit_total,
          credit_total = ledger_balances.credit_total + excluded.credit_total,
          closing_balance = ledger_balances.closing_balance + excluded.closing_balance,
          updated_at = now();
  end loop;

  perform write_erp_audit_log(
    'post',
    'roznamcha_entries',
    entry_id,
    null,
    jsonb_build_object(
      'type', p_type,
      'journal_no', p_journal_no,
      'voucher_no', p_voucher_no,
      'entry_date', p_entry_date,
      'debit_total', debit_total,
      'credit_total', credit_total
    )
  );

  return entry_id;
end;
$$;

