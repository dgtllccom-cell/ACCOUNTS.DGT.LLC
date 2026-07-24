create or replace function can_access_country(target_country_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_super_admin()
    or exists (
      select 1
      from user_role_assignments ura
      where ura.user_id = auth.uid()
        and ura.country_id = target_country_id
        and ura.role::text in (
          'country_admin',
          'main_branch_admin',
          'city_branch_admin',
          'accountant',
          'cashier',
          'agent_user',
          'staff_user',
          'auditor_viewer',
          'branch_admin',
          'staff'
        )
        and ura.is_active = true
        and ura.deleted_at is null
    );
$$;

create or replace function can_access_country_branch(target_country_branch_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_super_admin()
    or exists (
      select 1
      from country_branches cb
      join user_role_assignments ura on ura.country_id = cb.country_id
      where cb.id = target_country_branch_id
        and ura.user_id = auth.uid()
        and ura.is_active = true
        and ura.deleted_at is null
        and (
          ura.role::text in ('country_admin', 'main_branch_admin', 'accountant', 'auditor_viewer')
          or ura.country_branch_id = target_country_branch_id
        )
    );
$$;

create or replace function can_access_city_branch(target_city_branch_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_super_admin()
    or exists (
      select 1
      from city_branches cb
      join user_role_assignments ura on ura.country_id = cb.country_id
      where cb.id = target_city_branch_id
        and ura.user_id = auth.uid()
        and ura.is_active = true
        and ura.deleted_at is null
        and (
          ura.role::text in ('country_admin', 'main_branch_admin')
          or (
            ura.role::text in (
              'city_branch_admin',
              'accountant',
              'cashier',
              'agent_user',
              'staff_user',
              'auditor_viewer',
              'branch_admin',
              'staff'
            )
            and ura.city_branch_id = target_city_branch_id
          )
        )
    );
$$;

create or replace function can_manage_country(target_country_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_super_admin()
    or exists (
      select 1
      from user_role_assignments ura
      where ura.user_id = auth.uid()
        and ura.country_id = target_country_id
        and ura.role::text in ('country_admin', 'main_branch_admin')
        and ura.is_active = true
        and ura.deleted_at is null
    );
$$;

create table if not exists ledger_posting_batches (
  id uuid primary key default gen_random_uuid(),
  scope ledger_scope not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  entry_date date not null,
  reference_no text,
  narration text,
  status document_status not null default 'posted',
  created_by uuid references profiles(id),
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ledger_posting_batches_scope_chk check (
    (scope = 'super_admin' and country_id is null and city_branch_id is null)
    or (scope = 'country' and country_id is not null)
    or (scope = 'main_branch' and country_branch_id is not null)
    or (scope = 'city_branch' and city_branch_id is not null)
  )
);

create table if not exists ledger_posting_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references ledger_posting_batches(id) on delete cascade,
  account_id uuid references accounts(id),
  ledger_id uuid not null references ledgers(id),
  description text,
  debit numeric(18, 4) not null default 0,
  credit numeric(18, 4) not null default 0,
  currency text not null,
  usd_rate numeric(18, 8) not null default 1,
  usd_amount numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  constraint ledger_posting_lines_one_side_chk check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

alter table ledger_posting_batches enable row level security;
alter table ledger_posting_lines enable row level security;

drop policy if exists ledger_posting_batches_scope_read on ledger_posting_batches;
create policy ledger_posting_batches_scope_read on ledger_posting_batches
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

drop policy if exists ledger_posting_lines_scope_read on ledger_posting_lines;
create policy ledger_posting_lines_scope_read on ledger_posting_lines
  for select using (
    exists (
      select 1
      from ledger_posting_batches b
      where b.id = ledger_posting_lines.batch_id
        and (
          is_super_admin()
          or (b.country_id is not null and can_access_country(b.country_id))
          or (b.country_branch_id is not null and can_access_country_branch(b.country_branch_id))
          or (b.city_branch_id is not null and can_access_city_branch(b.city_branch_id))
        )
    )
  );

drop policy if exists record_translations_authenticated_read on record_translations;
create policy record_translations_authenticated_read on record_translations
  for select using (auth.uid() is not null);

drop policy if exists record_translations_authenticated_insert on record_translations;
create policy record_translations_authenticated_insert on record_translations
  for insert with check (auth.uid() is not null);

drop policy if exists record_translations_authenticated_update on record_translations;
create policy record_translations_authenticated_update on record_translations
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists translation_audit_logs_actor_insert on translation_audit_logs;
create policy translation_audit_logs_actor_insert on translation_audit_logs
  for insert with check (actor_id = auth.uid() or is_super_admin());

drop policy if exists approval_status_history_scope_read on approval_status_history;
create policy approval_status_history_scope_read on approval_status_history
  for select using (
    exists (
      select 1
      from approval_requests ar
      where ar.id = approval_status_history.approval_request_id
        and (
          is_super_admin()
          or ar.requested_by = auth.uid()
          or (ar.country_id is not null and can_access_country(ar.country_id))
          or (ar.city_branch_id is not null and can_access_city_branch(ar.city_branch_id))
        )
    )
  );

drop policy if exists approval_status_history_actor_insert on approval_status_history;
create policy approval_status_history_actor_insert on approval_status_history
  for insert with check (actor_id = auth.uid() or is_super_admin());

drop policy if exists record_locks_scope_read on record_locks;
create policy record_locks_scope_read on record_locks
  for select using (
    is_super_admin()
    or locked_by = auth.uid()
    or unlocked_by = auth.uid()
    or exists (
      select 1
      from approval_requests ar
      where ar.id = record_locks.approval_request_id
        and (
          ar.requested_by = auth.uid()
          or (ar.country_id is not null and can_access_country(ar.country_id))
          or (ar.city_branch_id is not null and can_access_city_branch(ar.city_branch_id))
        )
    )
  );

drop policy if exists record_locks_actor_insert on record_locks;
create policy record_locks_actor_insert on record_locks
  for insert with check (locked_by = auth.uid() or is_super_admin());

drop policy if exists record_locks_actor_update on record_locks;
create policy record_locks_actor_update on record_locks
  for update using (is_super_admin() or locked_by = auth.uid())
  with check (is_super_admin() or unlocked_by = auth.uid() or locked_by = auth.uid());

create or replace function write_erp_audit_log(
  p_action text,
  p_entity_table text,
  p_entity_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_company_id uuid default null,
  p_ip_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  insert into audit_logs (company_id, actor_id, action, entity_table, entity_id, before, after, ip_address)
  values (p_company_id, auth.uid(), p_action, p_entity_table, p_entity_id, p_before, p_after, p_ip_address)
  returning id into audit_id;

  return audit_id;
end;
$$;

create or replace function assert_enterprise_scope_access(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if p_scope = 'super_admin' then
    if p_country_id is not null or p_city_branch_id is not null then
      raise exception 'Super Admin scope must not include country or city branch';
    end if;

    if not is_super_admin() then
      raise exception 'Only Super Admin can post global ledger entries';
    end if;
  elsif p_scope = 'country' then
    if p_country_id is null then
      raise exception 'Country scope requires country';
    end if;

    if not can_access_country(p_country_id) then
      raise exception 'Country scope is not allowed';
    end if;
  elsif p_scope = 'main_branch' then
    if p_country_branch_id is null then
      raise exception 'Main branch scope requires country branch';
    end if;

    if not can_access_country_branch(p_country_branch_id) then
      raise exception 'Main branch scope is not allowed';
    end if;
  elsif p_scope = 'city_branch' then
    if p_city_branch_id is null then
      raise exception 'City branch scope requires city branch';
    end if;

    if not can_access_city_branch(p_city_branch_id) then
      raise exception 'City branch scope is not allowed';
    end if;
  end if;
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
  line_ledger_id uuid;
  line_description text;
  line_debit numeric(18, 4);
  line_credit numeric(18, 4);
  line_currency text;
  line_usd_rate numeric(18, 8);
  debit_total numeric(18, 4) := 0;
  credit_total numeric(18, 4) := 0;
begin
  perform assert_enterprise_scope_access(p_scope, p_country_id, p_country_branch_id, p_city_branch_id);

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
    line_ledger_id := nullif(coalesce(line_item ->> 'ledgerId', line_item ->> 'ledger_id'), '')::uuid;
    line_description := nullif(trim(coalesce(line_item ->> 'description', '')), '');
    line_debit := coalesce((line_item ->> 'debit')::numeric, 0);
    line_credit := coalesce((line_item ->> 'credit')::numeric, 0);
    line_currency := upper(trim(coalesce(line_item ->> 'currency', 'USD')));
    line_usd_rate := coalesce((coalesce(line_item ->> 'exchangeRate', line_item ->> 'usdRate'))::numeric, 1);

    if line_ledger_id is null then
      raise exception 'ledgerId is required for posting';
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

    insert into ledger_posting_lines (
      batch_id,
      account_id,
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
  line_ledger_id uuid;
  line_payment_type payment_entry_type;
  line_description text;
  line_debit numeric(18, 4);
  line_credit numeric(18, 4);
  line_currency text;
  line_usd_rate numeric(18, 8);
  debit_total numeric(18, 4) := 0;
  credit_total numeric(18, 4) := 0;
begin
  ledger_scope_value := case
    when p_type = 'super_admin' then 'super_admin'::ledger_scope
    when p_type = 'country' then 'country'::ledger_scope
    else 'city_branch'::ledger_scope
  end;

  perform assert_enterprise_scope_access(ledger_scope_value, p_country_id, p_country_branch_id, p_city_branch_id);

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
      usd_amount
    )
    values (
      entry_id,
      line_payment_type,
      line_account_id,
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

grant execute on function write_erp_audit_log(text, text, uuid, jsonb, jsonb, uuid, text) to authenticated;
grant execute on function post_enterprise_ledger_batch(ledger_scope, uuid, uuid, uuid, date, text, text, jsonb) to authenticated;
grant execute on function post_roznamcha_entry(roznamcha_type, uuid, uuid, uuid, text, text, date, uuid, text, text, jsonb) to authenticated;
