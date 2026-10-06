do $$
begin
  create type financial_period_status as enum ('open', 'locked', 'closed');
exception
  when duplicate_object then null;
end $$;

create table if not exists enterprise_accounts (
  id uuid primary key default gen_random_uuid(),
  scope ledger_scope not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  parent_id uuid references enterprise_accounts(id),
  code text not null,
  name text not null,
  kind account_kind not null,
  currency text not null,
  opening_balance numeric(18, 4) not null default 0,
  current_balance numeric(18, 4) not null default 0,
  status account_status not null default 'active',
  is_control_account boolean not null default false,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approval_request_id uuid references approval_requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint enterprise_accounts_currency_chk check (char_length(currency) = 3),
  constraint enterprise_accounts_scope_chk check (
    (scope = 'super_admin' and country_id is null and country_branch_id is null and city_branch_id is null)
    or (scope = 'country' and country_id is not null and country_branch_id is null and city_branch_id is null)
    or (scope = 'main_branch' and country_branch_id is not null and city_branch_id is null)
    or (scope = 'city_branch' and city_branch_id is not null)
  )
);

create unique index if not exists enterprise_accounts_scope_code_idx
  on enterprise_accounts (
    scope,
    coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code
  )
  where deleted_at is null;

create index if not exists enterprise_accounts_parent_idx on enterprise_accounts(parent_id);

alter table ledgers
  add column if not exists enterprise_account_id uuid references enterprise_accounts(id),
  add column if not exists parent_ledger_id uuid references ledgers(id),
  add column if not exists normal_balance ledger_direction not null default 'debit';

create index if not exists ledgers_parent_idx on ledgers(parent_ledger_id);
create index if not exists ledgers_enterprise_account_idx on ledgers(enterprise_account_id);

alter table ledger_posting_lines
  add column if not exists enterprise_account_id uuid references enterprise_accounts(id);

alter table roznamcha_lines
  add column if not exists enterprise_account_id uuid references enterprise_accounts(id);

create table if not exists financial_periods (
  id uuid primary key default gen_random_uuid(),
  scope ledger_scope not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  period_name text not null,
  start_date date not null,
  end_date date not null,
  status financial_period_status not null default 'open',
  locked_by uuid references profiles(id),
  locked_at timestamptz,
  lock_reason text,
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  created_by uuid references profiles(id),
  approval_request_id uuid references approval_requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint financial_periods_date_chk check (end_date >= start_date),
  constraint financial_periods_scope_chk check (
    (scope = 'super_admin' and country_id is null and country_branch_id is null and city_branch_id is null)
    or (scope = 'country' and country_id is not null and country_branch_id is null and city_branch_id is null)
    or (scope = 'main_branch' and country_branch_id is not null and city_branch_id is null)
    or (scope = 'city_branch' and city_branch_id is not null)
  )
);

create unique index if not exists financial_periods_scope_name_idx
  on financial_periods (
    scope,
    coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_name
  )
  where deleted_at is null;

create table if not exists ledger_opening_balances (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id),
  financial_period_id uuid not null references financial_periods(id),
  opening_balance numeric(18, 4) not null default 0,
  currency text not null,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approval_request_id uuid references approval_requests(id),
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists ledger_opening_balances_ledger_period_idx
  on ledger_opening_balances(ledger_id, financial_period_id)
  where deleted_at is null;

create table if not exists enterprise_ledger_reversals (
  id uuid primary key default gen_random_uuid(),
  original_batch_id uuid not null references ledger_posting_batches(id),
  reversal_batch_id uuid not null references ledger_posting_batches(id),
  reason text not null,
  approval_request_id uuid references approval_requests(id),
  reversed_by uuid references profiles(id),
  reversed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists enterprise_ledger_reversals_original_idx
  on enterprise_ledger_reversals(original_batch_id);

create table if not exists roznamcha_reversals (
  id uuid primary key default gen_random_uuid(),
  original_roznamcha_entry_id uuid not null references roznamcha_entries(id),
  reversal_roznamcha_entry_id uuid not null references roznamcha_entries(id),
  reason text not null,
  approval_request_id uuid references approval_requests(id),
  reversed_by uuid references profiles(id),
  reversed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists roznamcha_reversals_original_idx
  on roznamcha_reversals(original_roznamcha_entry_id);

alter table enterprise_accounts enable row level security;
alter table financial_periods enable row level security;
alter table ledger_opening_balances enable row level security;
alter table enterprise_ledger_reversals enable row level security;
alter table roznamcha_reversals enable row level security;

drop policy if exists enterprise_accounts_scope_read on enterprise_accounts;
create policy enterprise_accounts_scope_read on enterprise_accounts
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

drop policy if exists financial_periods_scope_read on financial_periods;
create policy financial_periods_scope_read on financial_periods
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

drop policy if exists ledger_opening_balances_scope_read on ledger_opening_balances;
create policy ledger_opening_balances_scope_read on ledger_opening_balances
  for select using (
    exists (
      select 1
      from ledgers l
      where l.id = ledger_opening_balances.ledger_id
        and (
          is_super_admin()
          or (l.country_id is not null and can_access_country(l.country_id))
          or (l.country_branch_id is not null and can_access_country_branch(l.country_branch_id))
          or (l.city_branch_id is not null and can_access_city_branch(l.city_branch_id))
        )
    )
  );

drop policy if exists enterprise_ledger_reversals_scope_read on enterprise_ledger_reversals;
create policy enterprise_ledger_reversals_scope_read on enterprise_ledger_reversals
  for select using (
    exists (
      select 1
      from ledger_posting_batches b
      where b.id = enterprise_ledger_reversals.original_batch_id
        and (
          is_super_admin()
          or (b.country_id is not null and can_access_country(b.country_id))
          or (b.country_branch_id is not null and can_access_country_branch(b.country_branch_id))
          or (b.city_branch_id is not null and can_access_city_branch(b.city_branch_id))
        )
    )
  );

drop policy if exists roznamcha_reversals_scope_read on roznamcha_reversals;
create policy roznamcha_reversals_scope_read on roznamcha_reversals
  for select using (
    exists (
      select 1
      from roznamcha_entries r
      where r.id = roznamcha_reversals.original_roznamcha_entry_id
        and (
          is_super_admin()
          or (r.country_id is not null and can_access_country(r.country_id))
          or (r.country_branch_id is not null and can_access_country_branch(r.country_branch_id))
          or (r.city_branch_id is not null and can_access_city_branch(r.city_branch_id))
        )
    )
  );

create or replace function enterprise_scope_matches(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  row_scope ledger_scope,
  row_country_id uuid,
  row_country_branch_id uuid,
  row_city_branch_id uuid
)
returns boolean
language sql
immutable
as $$
  select p_scope = row_scope
    and coalesce(p_country_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(row_country_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(p_country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(row_country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(p_city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(row_city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
$$;

create or replace function assert_financial_period_open(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  p_entry_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  period_record financial_periods%rowtype;
begin
  select *
  into period_record
  from financial_periods fp
  where fp.scope = p_scope
    and coalesce(fp.country_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_country_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(fp.country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(fp.city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(p_city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and p_entry_date between fp.start_date and fp.end_date
    and fp.deleted_at is null
  order by fp.start_date desc
  limit 1;

  if found and period_record.status <> 'open' then
    raise exception 'Financial period % is % and cannot accept postings', period_record.period_name, period_record.status;
  end if;
end;
$$;

create or replace function create_enterprise_account(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  p_parent_id uuid,
  p_code text,
  p_name text,
  p_kind account_kind,
  p_currency text,
  p_opening_balance numeric,
  p_is_control_account boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid;
  parent_record enterprise_accounts%rowtype;
begin
  perform assert_enterprise_scope_access(p_scope, p_country_id, p_country_branch_id, p_city_branch_id);

  if trim(p_code) = '' or trim(p_name) = '' then
    raise exception 'Account code and name are required';
  end if;

  if p_parent_id is not null then
    select * into parent_record
    from enterprise_accounts
    where id = p_parent_id
      and deleted_at is null;

    if not found then
      raise exception 'Parent account was not found';
    end if;

    if not enterprise_scope_matches(
      p_scope,
      p_country_id,
      p_country_branch_id,
      p_city_branch_id,
      parent_record.scope,
      parent_record.country_id,
      parent_record.country_branch_id,
      parent_record.city_branch_id
    ) then
      raise exception 'Parent account belongs to a different financial scope';
    end if;
  end if;

  insert into enterprise_accounts (
    scope,
    country_id,
    country_branch_id,
    city_branch_id,
    parent_id,
    code,
    name,
    kind,
    currency,
    opening_balance,
    current_balance,
    is_control_account,
    created_by
  )
  values (
    p_scope,
    p_country_id,
    p_country_branch_id,
    p_city_branch_id,
    p_parent_id,
    trim(p_code),
    trim(p_name),
    p_kind,
    upper(trim(p_currency)),
    coalesce(p_opening_balance, 0),
    coalesce(p_opening_balance, 0),
    coalesce(p_is_control_account, false),
    auth.uid()
  )
  returning id into account_id;

  perform write_erp_audit_log(
    'enterprise_account.create',
    'enterprise_accounts',
    account_id,
    null,
    jsonb_build_object('scope', p_scope, 'code', trim(p_code), 'name', trim(p_name), 'kind', p_kind)
  );

  return account_id;
end;
$$;

create or replace function create_enterprise_ledger(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  p_enterprise_account_id uuid,
  p_parent_ledger_id uuid,
  p_code text,
  p_name text,
  p_currency text,
  p_opening_balance numeric,
  p_normal_balance ledger_direction
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ledger_id uuid;
  account_record enterprise_accounts%rowtype;
  parent_record ledgers%rowtype;
begin
  perform assert_enterprise_scope_access(p_scope, p_country_id, p_country_branch_id, p_city_branch_id);

  if trim(p_code) = '' or trim(p_name) = '' then
    raise exception 'Ledger code and name are required';
  end if;

  if p_enterprise_account_id is not null then
    select * into account_record
    from enterprise_accounts
    where id = p_enterprise_account_id
      and deleted_at is null;

    if not found then
      raise exception 'Enterprise account was not found';
    end if;

    if not enterprise_scope_matches(
      p_scope,
      p_country_id,
      p_country_branch_id,
      p_city_branch_id,
      account_record.scope,
      account_record.country_id,
      account_record.country_branch_id,
      account_record.city_branch_id
    ) then
      raise exception 'Enterprise account belongs to a different financial scope';
    end if;
  end if;

  if p_parent_ledger_id is not null then
    select * into parent_record
    from ledgers
    where id = p_parent_ledger_id
      and deleted_at is null;

    if not found then
      raise exception 'Parent ledger was not found';
    end if;

    if not enterprise_scope_matches(
      p_scope,
      p_country_id,
      p_country_branch_id,
      p_city_branch_id,
      parent_record.scope,
      parent_record.country_id,
      parent_record.country_branch_id,
      parent_record.city_branch_id
    ) then
      raise exception 'Parent ledger belongs to a different financial scope';
    end if;
  end if;

  insert into ledgers (
    scope,
    country_id,
    country_branch_id,
    city_branch_id,
    enterprise_account_id,
    parent_ledger_id,
    code,
    name,
    currency,
    opening_balance,
    current_balance,
    normal_balance,
    created_by
  )
  values (
    p_scope,
    p_country_id,
    p_country_branch_id,
    p_city_branch_id,
    p_enterprise_account_id,
    p_parent_ledger_id,
    trim(p_code),
    trim(p_name),
    upper(trim(p_currency)),
    coalesce(p_opening_balance, 0),
    coalesce(p_opening_balance, 0),
    coalesce(p_normal_balance, 'debit'),
    auth.uid()
  )
  returning id into new_ledger_id;

  perform write_erp_audit_log(
    'ledger.create',
    'ledgers',
    new_ledger_id,
    null,
    jsonb_build_object('scope', p_scope, 'code', trim(p_code), 'name', trim(p_name), 'opening_balance', coalesce(p_opening_balance, 0))
  );

  return new_ledger_id;
end;
$$;

create or replace function post_ledger_opening_balance(
  p_ledger_id uuid,
  p_financial_period_id uuid,
  p_opening_balance numeric,
  p_approval_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ledger_record ledgers%rowtype;
  period_record financial_periods%rowtype;
  opening_id uuid;
begin
  select * into ledger_record
  from ledgers
  where id = p_ledger_id
    and deleted_at is null;

  if not found then
    raise exception 'Ledger was not found';
  end if;

  perform assert_enterprise_scope_access(
    ledger_record.scope,
    ledger_record.country_id,
    ledger_record.country_branch_id,
    ledger_record.city_branch_id
  );

  select * into period_record
  from financial_periods
  where id = p_financial_period_id
    and deleted_at is null;

  if not found then
    raise exception 'Financial period was not found';
  end if;

  if period_record.status <> 'open' then
    raise exception 'Financial period is not open';
  end if;

  if not enterprise_scope_matches(
    ledger_record.scope,
    ledger_record.country_id,
    ledger_record.country_branch_id,
    ledger_record.city_branch_id,
    period_record.scope,
    period_record.country_id,
    period_record.country_branch_id,
    period_record.city_branch_id
  ) then
    raise exception 'Ledger and financial period scope do not match';
  end if;

  insert into ledger_opening_balances (
    ledger_id,
    financial_period_id,
    opening_balance,
    currency,
    created_by,
    approval_request_id
  )
  values (
    p_ledger_id,
    p_financial_period_id,
    coalesce(p_opening_balance, 0),
    ledger_record.currency,
    auth.uid(),
    p_approval_request_id
  )
  on conflict (ledger_id, financial_period_id) where deleted_at is null do update
    set opening_balance = excluded.opening_balance,
        approval_request_id = excluded.approval_request_id,
        posted_at = now()
  returning id into opening_id;

  update ledgers
  set opening_balance = coalesce(p_opening_balance, 0),
      current_balance = coalesce(p_opening_balance, 0) + debit_total - credit_total,
      updated_at = now()
  where id = p_ledger_id;

  perform write_erp_audit_log(
    'ledger.opening_balance.post',
    'ledger_opening_balances',
    opening_id,
    null,
    jsonb_build_object('ledger_id', p_ledger_id, 'financial_period_id', p_financial_period_id, 'opening_balance', coalesce(p_opening_balance, 0))
  );

  return opening_id;
end;
$$;

create or replace function post_enterprise_ledger_batch(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  p_entry_date date,
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
  batch_id uuid;
  line_item jsonb;
  line_account_id uuid;
  line_enterprise_account_id uuid;
  line_ledger_id uuid;
  line_description text;
  line_debit numeric(18, 4);
  line_credit numeric(18, 4);
  line_currency text;
  line_usd_rate numeric(18, 8);
  debit_total numeric(18, 4) := 0;
  credit_total numeric(18, 4) := 0;
  ledger_record ledgers%rowtype;
begin
  perform assert_enterprise_scope_access(p_scope, p_country_id, p_country_branch_id, p_city_branch_id);
  perform assert_financial_period_open(p_scope, p_country_id, p_country_branch_id, p_city_branch_id, p_entry_date);

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'At least two ledger lines are required';
  end if;

  for line_item in select * from jsonb_array_elements(p_lines)
  loop
    line_debit := coalesce((line_item ->> 'debit')::numeric, 0);
    line_credit := coalesce((line_item ->> 'credit')::numeric, 0);
    line_usd_rate := coalesce((coalesce(line_item ->> 'exchangeRate', line_item ->> 'usdRate'))::numeric, 1);

    if (line_debit > 0 and line_credit > 0) or (line_debit = 0 and line_credit = 0) then
      raise exception 'Each ledger line must contain either debit or credit';
    end if;

    if line_debit < 0 or line_credit < 0 or line_usd_rate <= 0 then
      raise exception 'Ledger amounts and USD rate must be valid';
    end if;

    debit_total := debit_total + line_debit;
    credit_total := credit_total + line_credit;
  end loop;

  if round(debit_total, 4) <> round(credit_total, 4) or debit_total <= 0 then
    raise exception 'Debit total must equal credit total';
  end if;

  insert into ledger_posting_batches (
    scope,
    country_id,
    country_branch_id,
    city_branch_id,
    entry_date,
    reference_no,
    narration,
    created_by
  )
  values (
    p_scope,
    p_country_id,
    p_country_branch_id,
    p_city_branch_id,
    p_entry_date,
    nullif(trim(coalesce(p_reference_no, '')), ''),
    nullif(trim(coalesce(p_narration, '')), ''),
    auth.uid()
  )
  returning id into batch_id;

  for line_item in select * from jsonb_array_elements(p_lines)
  loop
    line_account_id := nullif(coalesce(line_item ->> 'accountId', line_item ->> 'account_id'), '')::uuid;
    line_enterprise_account_id := nullif(coalesce(line_item ->> 'enterpriseAccountId', line_item ->> 'enterprise_account_id'), '')::uuid;
    line_ledger_id := nullif(coalesce(line_item ->> 'ledgerId', line_item ->> 'ledger_id'), '')::uuid;
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
      p_scope,
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

    if line_enterprise_account_id is not null
      and ledger_record.enterprise_account_id is not null
      and line_enterprise_account_id <> ledger_record.enterprise_account_id then
      raise exception 'Ledger and enterprise account do not match';
    end if;

    insert into ledger_posting_lines (
      batch_id,
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
      batch_id,
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
    set debit_total = debit_total + line_debit,
        credit_total = credit_total + line_credit,
        current_balance = current_balance + line_debit - line_credit,
        updated_at = now()
    where id = line_ledger_id;

    if coalesce(line_enterprise_account_id, ledger_record.enterprise_account_id) is not null then
      update enterprise_accounts
      set current_balance = current_balance + line_debit - line_credit,
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
    'ledger_posting_batches',
    batch_id,
    null,
    jsonb_build_object(
      'scope', p_scope,
      'entry_date', p_entry_date,
      'debit_total', debit_total,
      'credit_total', credit_total
    )
  );

  return batch_id;
end;
$$;

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
    set debit_total = debit_total + line_debit,
        credit_total = credit_total + line_credit,
        current_balance = current_balance + line_debit - line_credit,
        updated_at = now()
    where id = line_ledger_id;

    if coalesce(line_enterprise_account_id, ledger_record.enterprise_account_id) is not null then
      update enterprise_accounts
      set current_balance = current_balance + line_debit - line_credit,
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

create or replace function create_financial_period(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  p_period_name text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  period_id uuid;
begin
  perform assert_enterprise_scope_access(p_scope, p_country_id, p_country_branch_id, p_city_branch_id);

  if trim(p_period_name) = '' then
    raise exception 'Period name is required';
  end if;

  if p_end_date < p_start_date then
    raise exception 'Period end date must be after start date';
  end if;

  insert into financial_periods (
    scope,
    country_id,
    country_branch_id,
    city_branch_id,
    period_name,
    start_date,
    end_date,
    created_by
  )
  values (
    p_scope,
    p_country_id,
    p_country_branch_id,
    p_city_branch_id,
    trim(p_period_name),
    p_start_date,
    p_end_date,
    auth.uid()
  )
  returning id into period_id;

  perform write_erp_audit_log(
    'financial_period.create',
    'financial_periods',
    period_id,
    null,
    jsonb_build_object('scope', p_scope, 'period_name', trim(p_period_name), 'start_date', p_start_date, 'end_date', p_end_date)
  );

  return period_id;
end;
$$;

create or replace function reverse_enterprise_ledger_batch(
  p_original_batch_id uuid,
  p_reason text,
  p_approval_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  original_batch ledger_posting_batches%rowtype;
  reversal_batch_id uuid;
  line_record ledger_posting_lines%rowtype;
begin
  select * into original_batch
  from ledger_posting_batches
  where id = p_original_batch_id
    and deleted_at is null;

  if not found then
    raise exception 'Original ledger batch was not found';
  end if;

  if exists (select 1 from enterprise_ledger_reversals where original_batch_id = p_original_batch_id) then
    raise exception 'Ledger batch already has a reversal';
  end if;

  perform assert_enterprise_scope_access(
    original_batch.scope,
    original_batch.country_id,
    original_batch.country_branch_id,
    original_batch.city_branch_id
  );
  perform assert_financial_period_open(
    original_batch.scope,
    original_batch.country_id,
    original_batch.country_branch_id,
    original_batch.city_branch_id,
    current_date
  );

  insert into ledger_posting_batches (
    scope,
    country_id,
    country_branch_id,
    city_branch_id,
    entry_date,
    reference_no,
    narration,
    created_by
  )
  values (
    original_batch.scope,
    original_batch.country_id,
    original_batch.country_branch_id,
    original_batch.city_branch_id,
    current_date,
    concat('REV-', coalesce(original_batch.reference_no, original_batch.id::text)),
    concat('Reversal: ', p_reason),
    auth.uid()
  )
  returning id into reversal_batch_id;

  for line_record in
    select * from ledger_posting_lines where batch_id = p_original_batch_id
  loop
    insert into ledger_posting_lines (
      batch_id,
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
      reversal_batch_id,
      line_record.account_id,
      line_record.enterprise_account_id,
      line_record.ledger_id,
      concat('Reversal: ', coalesce(line_record.description, '')),
      line_record.credit,
      line_record.debit,
      line_record.currency,
      line_record.usd_rate,
      line_record.usd_amount
    );

    update ledgers
    set debit_total = debit_total + line_record.credit,
        credit_total = credit_total + line_record.debit,
        current_balance = current_balance + line_record.credit - line_record.debit,
        updated_at = now()
    where id = line_record.ledger_id;

    if line_record.enterprise_account_id is not null then
      update enterprise_accounts
      set current_balance = current_balance + line_record.credit - line_record.debit,
          updated_at = now()
      where id = line_record.enterprise_account_id;
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
      line_record.ledger_id,
      current_date,
      0,
      line_record.credit,
      line_record.debit,
      line_record.credit - line_record.debit
    )
    on conflict (ledger_id, balance_date) do update
      set debit_total = ledger_balances.debit_total + excluded.debit_total,
          credit_total = ledger_balances.credit_total + excluded.credit_total,
          closing_balance = ledger_balances.closing_balance + excluded.closing_balance,
          updated_at = now();
  end loop;

  insert into enterprise_ledger_reversals (
    original_batch_id,
    reversal_batch_id,
    reason,
    approval_request_id,
    reversed_by
  )
  values (
    p_original_batch_id,
    reversal_batch_id,
    p_reason,
    p_approval_request_id,
    auth.uid()
  );

  update ledger_posting_batches
  set status = 'cancelled',
      updated_at = now()
  where id = p_original_batch_id;

  perform write_erp_audit_log(
    'ledger.reverse',
    'ledger_posting_batches',
    reversal_batch_id,
    jsonb_build_object('original_batch_id', p_original_batch_id),
    jsonb_build_object('reversal_batch_id', reversal_batch_id, 'reason', p_reason)
  );

  return reversal_batch_id;
end;
$$;

create or replace function reverse_roznamcha_entry(
  p_original_entry_id uuid,
  p_reason text,
  p_approval_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  original_entry roznamcha_entries%rowtype;
  reversal_entry_id uuid;
  line_record roznamcha_lines%rowtype;
begin
  select * into original_entry
  from roznamcha_entries
  where id = p_original_entry_id
    and deleted_at is null;

  if not found then
    raise exception 'Original Roznamcha entry was not found';
  end if;

  if exists (select 1 from roznamcha_reversals where original_roznamcha_entry_id = p_original_entry_id) then
    raise exception 'Roznamcha entry already has a reversal';
  end if;

  perform assert_enterprise_scope_access(
    case
      when original_entry.type = 'super_admin' then 'super_admin'::ledger_scope
      when original_entry.type = 'country' then 'country'::ledger_scope
      else 'city_branch'::ledger_scope
    end,
    original_entry.country_id,
    original_entry.country_branch_id,
    original_entry.city_branch_id
  );

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
    original_entry.type,
    original_entry.country_id,
    original_entry.country_branch_id,
    original_entry.city_branch_id,
    concat('REV-', original_entry.journal_no),
    concat('REV-', original_entry.voucher_no),
    current_date,
    original_entry.payment_method_id,
    original_entry.reference_no,
    concat('Reversal: ', p_reason),
    'posted',
    auth.uid(),
    now()
  )
  returning id into reversal_entry_id;

  for line_record in
    select * from roznamcha_lines where roznamcha_entry_id = p_original_entry_id
  loop
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
      reversal_entry_id,
      line_record.payment_entry_type,
      line_record.account_id,
      line_record.enterprise_account_id,
      line_record.ledger_id,
      concat('Reversal: ', coalesce(line_record.description, '')),
      line_record.credit,
      line_record.debit,
      line_record.currency,
      line_record.usd_rate,
      line_record.usd_amount
    );

    update ledgers
    set debit_total = debit_total + line_record.credit,
        credit_total = credit_total + line_record.debit,
        current_balance = current_balance + line_record.credit - line_record.debit,
        updated_at = now()
    where id = line_record.ledger_id;

    if line_record.enterprise_account_id is not null then
      update enterprise_accounts
      set current_balance = current_balance + line_record.credit - line_record.debit,
          updated_at = now()
      where id = line_record.enterprise_account_id;
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
      line_record.ledger_id,
      current_date,
      0,
      line_record.credit,
      line_record.debit,
      line_record.credit - line_record.debit
    )
    on conflict (ledger_id, balance_date) do update
      set debit_total = ledger_balances.debit_total + excluded.debit_total,
          credit_total = ledger_balances.credit_total + excluded.credit_total,
          closing_balance = ledger_balances.closing_balance + excluded.closing_balance,
          updated_at = now();
  end loop;

  insert into roznamcha_reversals (
    original_roznamcha_entry_id,
    reversal_roznamcha_entry_id,
    reason,
    approval_request_id,
    reversed_by
  )
  values (
    p_original_entry_id,
    reversal_entry_id,
    p_reason,
    p_approval_request_id,
    auth.uid()
  );

  update roznamcha_entries
  set status = 'cancelled',
      updated_at = now()
  where id = p_original_entry_id;

  perform write_erp_audit_log(
    'roznamcha.reverse',
    'roznamcha_entries',
    reversal_entry_id,
    jsonb_build_object('original_roznamcha_entry_id', p_original_entry_id),
    jsonb_build_object('reversal_roznamcha_entry_id', reversal_entry_id, 'reason', p_reason)
  );

  return reversal_entry_id;
end;
$$;

create or replace function get_ledger_statement(
  p_ledger_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  entry_date date,
  source_table text,
  source_id uuid,
  reference_no text,
  description text,
  debit numeric,
  credit numeric,
  currency text,
  usd_rate numeric,
  usd_amount numeric,
  running_balance numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with ledger_scope_check as (
    select l.*
    from ledgers l
    where l.id = p_ledger_id
      and l.deleted_at is null
      and (
        is_super_admin()
        or (l.country_id is not null and can_access_country(l.country_id))
        or (l.country_branch_id is not null and can_access_country_branch(l.country_branch_id))
        or (l.city_branch_id is not null and can_access_city_branch(l.city_branch_id))
      )
  ),
  statement_lines as (
    select
      b.entry_date,
      'ledger_posting_batches'::text as source_table,
      b.id as source_id,
      b.reference_no,
      lpl.description,
      lpl.debit,
      lpl.credit,
      lpl.currency,
      lpl.usd_rate,
      lpl.usd_amount,
      lpl.created_at
    from ledger_posting_lines lpl
    join ledger_posting_batches b on b.id = lpl.batch_id
    where lpl.ledger_id = p_ledger_id
      and b.deleted_at is null
      and b.entry_date between p_from_date and p_to_date

    union all

    select
      r.entry_date,
      'roznamcha_entries'::text as source_table,
      r.id as source_id,
      r.voucher_no as reference_no,
      rl.description,
      rl.debit,
      rl.credit,
      rl.currency,
      rl.usd_rate,
      rl.usd_amount,
      r.created_at
    from roznamcha_lines rl
    join roznamcha_entries r on r.id = rl.roznamcha_entry_id
    where rl.ledger_id = p_ledger_id
      and r.deleted_at is null
      and r.entry_date between p_from_date and p_to_date
  )
  select
    sl.entry_date,
    sl.source_table,
    sl.source_id,
    sl.reference_no,
    sl.description,
    sl.debit,
    sl.credit,
    sl.currency,
    sl.usd_rate,
    sl.usd_amount,
    (select opening_balance from ledger_scope_check)
      + sum(sl.debit - sl.credit) over (order by sl.entry_date, sl.created_at, sl.source_id) as running_balance
  from statement_lines sl
  where exists (select 1 from ledger_scope_check)
  order by sl.entry_date, sl.created_at, sl.source_id;
$$;

create or replace function get_trial_balance(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  p_as_of_date date
)
returns table (
  ledger_id uuid,
  parent_ledger_id uuid,
  code text,
  name text,
  currency text,
  opening_balance numeric,
  debit_total numeric,
  credit_total numeric,
  balance numeric,
  debit_balance numeric,
  credit_balance numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with allowed as (
    select assert_enterprise_scope_access(p_scope, p_country_id, p_country_branch_id, p_city_branch_id)
  ),
  scoped_ledgers as (
    select l.*
    from ledgers l
    where l.deleted_at is null
      and enterprise_scope_matches(
        p_scope,
        p_country_id,
        p_country_branch_id,
        p_city_branch_id,
        l.scope,
        l.country_id,
        l.country_branch_id,
        l.city_branch_id
      )
  ),
  balance_totals as (
    select
      lb.ledger_id,
      sum(lb.debit_total) as debit_total,
      sum(lb.credit_total) as credit_total,
      sum(lb.closing_balance) as movement
    from ledger_balances lb
    where lb.balance_date <= p_as_of_date
    group by lb.ledger_id
  )
  select
    sl.id,
    sl.parent_ledger_id,
    sl.code,
    sl.name,
    sl.currency,
    sl.opening_balance,
    coalesce(bt.debit_total, 0) as debit_total,
    coalesce(bt.credit_total, 0) as credit_total,
    sl.opening_balance + coalesce(bt.movement, 0) as balance,
    greatest(sl.opening_balance + coalesce(bt.movement, 0), 0) as debit_balance,
    greatest((sl.opening_balance + coalesce(bt.movement, 0)) * -1, 0) as credit_balance
  from scoped_ledgers sl
  cross join allowed
  left join balance_totals bt on bt.ledger_id = sl.id
  order by sl.code;
$$;

create or replace function get_global_financial_consolidation(
  p_from_date date,
  p_to_date date
)
returns table (
  country_id uuid,
  country_name text,
  debit_usd numeric,
  credit_usd numeric,
  net_usd numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with allowed as (
    select is_super_admin() as ok
  ),
  movement as (
    select
      b.country_id,
      sum(case when lpl.debit > 0 then lpl.usd_amount else 0 end) as debit_usd,
      sum(case when lpl.credit > 0 then lpl.usd_amount else 0 end) as credit_usd
    from ledger_posting_lines lpl
    join ledger_posting_batches b on b.id = lpl.batch_id
    where b.entry_date between p_from_date and p_to_date
      and b.deleted_at is null
      and b.country_id is not null
    group by b.country_id

    union all

    select
      r.country_id,
      sum(case when rl.debit > 0 then rl.usd_amount else 0 end) as debit_usd,
      sum(case when rl.credit > 0 then rl.usd_amount else 0 end) as credit_usd
    from roznamcha_lines rl
    join roznamcha_entries r on r.id = rl.roznamcha_entry_id
    where r.entry_date between p_from_date and p_to_date
      and r.deleted_at is null
      and r.country_id is not null
    group by r.country_id
  )
  select
    c.id,
    c.name,
    coalesce(sum(m.debit_usd), 0) as debit_usd,
    coalesce(sum(m.credit_usd), 0) as credit_usd,
    coalesce(sum(m.debit_usd), 0) - coalesce(sum(m.credit_usd), 0) as net_usd
  from countries c
  cross join allowed
  left join movement m on m.country_id = c.id
  where c.deleted_at is null
    and allowed.ok = true
  group by c.id, c.name
  order by c.name;
$$;

grant execute on function create_enterprise_account(ledger_scope, uuid, uuid, uuid, uuid, text, text, account_kind, text, numeric, boolean) to authenticated;
grant execute on function create_enterprise_ledger(ledger_scope, uuid, uuid, uuid, uuid, uuid, text, text, text, numeric, ledger_direction) to authenticated;
grant execute on function post_ledger_opening_balance(uuid, uuid, numeric, uuid) to authenticated;
grant execute on function create_financial_period(ledger_scope, uuid, uuid, uuid, text, date, date) to authenticated;
grant execute on function reverse_enterprise_ledger_batch(uuid, text, uuid) to authenticated;
grant execute on function reverse_roznamcha_entry(uuid, text, uuid) to authenticated;
grant execute on function get_ledger_statement(uuid, date, date) to authenticated;
grant execute on function get_trial_balance(ledger_scope, uuid, uuid, uuid, date) to authenticated;
grant execute on function get_global_financial_consolidation(date, date) to authenticated;
