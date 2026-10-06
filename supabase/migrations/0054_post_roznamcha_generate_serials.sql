-- Fix: `post_roznamcha_entry` automatically generates transaction serials
-- This ensures that automated backend transactions (like Purchase Order Payments)
-- get valid `super_admin_serial_number`, `branch_transaction_serial_number`, etc.

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
begin
  ledger_scope_value := case
    when p_type = 'super_admin' then 'super_admin'::ledger_scope
    when p_type = 'country' then 'country'::ledger_scope
    when p_type = 'branch' and p_city_branch_id is null and p_country_branch_id is not null then 'main_branch'::ledger_scope
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

  -- Generate Prefixes
  if p_country_id is not null then
    select coalesce(nullif(iso2, ''), coalesce(nullif(iso3, ''), name))
    into v_country_prefix
    from countries where id = p_country_id;
    v_country_prefix := coalesce(regexp_replace(upper(v_country_prefix), '[^A-Z0-9]', '', 'g'), 'CNT');
  end if;

  if p_country_branch_id is not null then
    select coalesce(nullif(code, ''), name)
    into v_main_branch_prefix
    from country_branches where id = p_country_branch_id;
    v_main_branch_prefix := coalesce(regexp_replace(upper(v_main_branch_prefix), '[^A-Z0-9]', '', 'g'), 'MB');
  end if;

  if p_city_branch_id is not null then
    select coalesce(nullif(code, ''), name)
    into v_city_branch_prefix
    from city_branches where id = p_city_branch_id;
    v_city_branch_prefix := coalesce(regexp_replace(upper(v_city_branch_prefix), '[^A-Z0-9]', '', 'g'), 'CB');
  end if;

  -- Generate Transaction Serials
  v_super_admin_serial := next_transaction_serial('global', 'global', 'SA');
  v_entry_serial := next_transaction_serial('module_roznamcha', 'global', 'ROZ');
  
  if p_country_id is not null then
    v_country_serial := next_transaction_serial('country', p_country_id::text, v_country_prefix);
  end if;

  if coalesce(p_city_branch_id, p_country_branch_id) is not null then
    v_branch_serial := next_transaction_serial(
      'branch',
      coalesce(p_city_branch_id, p_country_branch_id)::text,
      case when p_city_branch_id is not null then v_city_branch_prefix else v_main_branch_prefix end
    );
  end if;

  if p_country_branch_id is not null then
    v_main_branch_serial := next_transaction_serial('main_branch', p_country_branch_id::text, v_main_branch_prefix);
  end if;

  if p_city_branch_id is not null then
    v_city_branch_serial := next_transaction_serial('city_branch', p_city_branch_id::text, v_city_branch_prefix);
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
    posted_at,
    super_admin_serial_number,
    country_transaction_serial_number,
    branch_transaction_serial_number
  )
  values (
    p_type,
    p_country_id,
    p_country_branch_id,
    p_city_branch_id,
    p_journal_no,
    p_voucher_no,
    p_entry_date,
    p_payment_method_id,
    nullif(trim(p_reference_no), ''),
    nullif(trim(p_narration), ''),
    'posted',
    auth.uid(),
    now(),
    v_super_admin_serial,
    v_country_serial,
    v_branch_serial
  )
  returning id into v_entry_id;

  for line_item in select * from jsonb_array_elements(p_lines)
  loop
    line_payment_type := coalesce(line_item ->> 'paymentEntryType', line_item ->> 'payment_entry_type')::payment_entry_type;
    line_ledger_id := (line_item ->> 'ledgerId')::uuid;
    line_description := nullif(trim(line_item ->> 'description'), '');
    line_debit := coalesce((line_item ->> 'debit')::numeric, 0);
    line_credit := coalesce((line_item ->> 'credit')::numeric, 0);
    line_currency := upper(trim(coalesce(line_item ->> 'currency', 'USD')));
    line_usd_rate := coalesce((coalesce(line_item ->> 'exchangeRate', line_item ->> 'usdRate'))::numeric, 1);

    if line_ledger_id is null then
      raise exception 'Roznamcha line must specify a ledger ID';
    end if;

    if not exists (
      select 1
      from ledgers l
      where l.id = line_ledger_id
        and l.deleted_at is null
        and (
          is_super_admin()
          or (l.country_id is not null and can_access_country(l.country_id))
          or (l.country_branch_id is not null and can_access_country_branch(l.country_branch_id))
          or (l.city_branch_id is not null and can_access_city_branch(l.city_branch_id))
        )
    ) then
      raise exception 'Ledger scope is not allowed';
    end if;

    select account_id into line_account_id
    from ledgers
    where id = line_ledger_id;

    insert into roznamcha_lines (
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
    values (
      v_entry_id,
      line_payment_type,
      line_account_id,
      line_ledger_id,
      line_description,
      line_debit,
      line_credit,
      line_currency,
      line_usd_rate,
      round((line_debit + line_credit) * line_usd_rate, 4),
      v_super_admin_serial,
      v_country_serial,
      v_branch_serial,
      v_main_branch_serial,
      v_city_branch_serial,
      v_entry_serial
    );
  end loop;

  return v_entry_id;
end;
$$;

insert into erp_schema_migrations(name, status, applied_at)
values ('0054_post_roznamcha_generate_serials', 'applied', now())
on conflict (name)
do update set status = excluded.status, applied_at = excluded.applied_at;
