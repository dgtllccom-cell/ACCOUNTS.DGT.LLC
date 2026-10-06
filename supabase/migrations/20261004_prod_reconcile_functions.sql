-- Production schema reconciliation — function layer.
-- Brings production's accounting / scope / HR-payroll / serial / translation
-- functions to the verified DEV definitions. Every statement is CREATE OR REPLACE
-- (idempotent, reversible). No data touched. UAE-tax functions are intentionally
-- excluded (they ship with the separate UAE Tax module).
--
-- Source: DEV project csesvyxxjivnkkozgopt, captured 2026-08-29.

BEGIN;

-- apply_advance_loan_recovery(p_employee_id uuid, p_is_loan boolean, p_recovery_amount numeric)
CREATE OR REPLACE FUNCTION public.apply_advance_loan_recovery(p_employee_id uuid, p_is_loan boolean, p_recovery_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  remaining numeric := p_recovery_amount;
  rec record;
  to_deduct numeric;
  new_balance numeric;
begin
  if p_recovery_amount is null or p_recovery_amount <= 0 then
    return;
  end if;

  for rec in
    select id, remaining_balance from employee_advances_loans
    where employee_id = p_employee_id
      and status = 'Active'
      and deleted_at is null
      and (case when p_is_loan then type ilike '%loan%' else type not ilike '%loan%' end)
    order by payment_date asc
  loop
    exit when remaining <= 0;
    to_deduct := least(remaining, coalesce(rec.remaining_balance, 0));
    new_balance := coalesce(rec.remaining_balance, 0) - to_deduct;
    update employee_advances_loans
      set remaining_balance = new_balance,
          status = case when new_balance <= 0 then 'Completed' else 'Active' end
      where id = rec.id;
    remaining := remaining - to_deduct;
  end loop;
end;
$function$
;

-- assert_enterprise_scope_access(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid)
CREATE OR REPLACE FUNCTION public.assert_enterprise_scope_access(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    -- No Supabase Auth JWT in this session (temp-session bootstrap login). The calling
    -- API route already authorized this request via authorizeApiScope() using the app's
    -- real session/role data; do not re-deny here for lack of a Supabase auth context.
    return;
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
$function$
;

-- assert_financial_period_open(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_entry_date date)
CREATE OR REPLACE FUNCTION public.assert_financial_period_open(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_entry_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- attach_translation_triggers()
CREATE OR REPLACE FUNCTION public.attach_translation_triggers()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0;
begin
  perform public.provision_module_translation_tables();
  for r in select distinct table_name from public.translation_field_registry where is_active loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=r.table_name and table_type='BASE TABLE')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name=r.table_name and column_name='id') then
      execute format('drop trigger if exists trg_enroll_translations on public.%I', r.table_name);
      execute format('create trigger trg_enroll_translations after insert or update on public.%I for each row execute function public.tg_enroll_translations()', r.table_name);
      n := n + 1;
    end if;
  end loop;
  return n;
end $function$
;

-- backfill_record_translations(p_table text, p_field text)
CREATE OR REPLACE FUNCTION public.backfill_record_translations(p_table text, p_field text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer; has_deleted boolean; sql text;
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name=p_field) then return -2; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='id') then return -3; end if;
  has_deleted := exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='deleted_at');
  sql := format($f$
    insert into record_translations (record_table, record_id, field_name, original_text, original_language_code,
      english_text, urdu_text, arabic_text, persian_text, pashto_text, language_texts, source, translation_status,
      translated_by_engine, translated_at, created_at, updated_at)
    select %L, t.id, %L, t.%I::text, 'en', t.%I::text, t.%I::text, t.%I::text, t.%I::text, t.%I::text,
      jsonb_build_object('en',t.%I::text,'ur',t.%I::text,'ar',t.%I::text,'fa',t.%I::text,'ps',t.%I::text),
      'imported','pending','backfill_pending', now(), now(), now()
    from %I t
    where t.%I is not null and btrim(t.%I::text) <> '' %s
      and not exists (select 1 from record_translations r where r.record_table=%L and r.record_id=t.id and r.field_name=%L and r.deleted_at is null)
  $f$, p_table, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field,
       p_table, p_field, p_field, case when has_deleted then 'and t.deleted_at is null' else '' end, p_table, p_field);
  execute sql; get diagnostics n = row_count; return n;
exception when others then return -1;
end $function$
;

-- backfill_translation_keyset(p_table text, p_field text, p_after text, p_limit integer)
CREATE OR REPLACE FUNCTION public.backfill_translation_keyset(p_table text, p_field text, p_after text DEFAULT NULL::text, p_limit integer DEFAULT 50000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare has_deleted boolean; sql text; res jsonb;
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name=p_field) then return jsonb_build_object('error','field_missing'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='id') then return jsonb_build_object('error','no_id'); end if;
  has_deleted := exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='deleted_at');
  sql := format($f$
    with batch as (
      select t.id, t.%I::text as val from %I t
      where (%L::uuid is null or t.id > %L::uuid) and t.%I is not null and btrim(t.%I::text) <> '' %s
      order by t.id limit %s
    ), ins as (
      insert into record_translations (record_table, record_id, field_name, original_text, original_language_code,
        english_text, urdu_text, arabic_text, persian_text, pashto_text, language_texts, source, translation_status,
        translated_by_engine, translated_at, created_at, updated_at)
      select %L, b.id, %L, b.val, 'en', b.val, b.val, b.val, b.val, b.val,
        jsonb_build_object('en',b.val,'ur',b.val,'ar',b.val,'fa',b.val,'ps',b.val),
        'imported','pending','backfill_pending', now(), now(), now()
      from batch b on conflict (record_table, record_id, field_name) where deleted_at is null do nothing returning 1
    )
    select jsonb_build_object('scanned',(select count(*) from batch),'inserted',(select count(*) from ins),'last_id',(select id from batch order by id desc limit 1))
  $f$, p_field, p_table, p_after, p_after, p_field, p_field,
       case when has_deleted then 'and t.deleted_at is null' else '' end, p_limit, p_table, p_field);
  execute sql into res; return res;
exception when others then return jsonb_build_object('error', SQLERRM);
end $function$
;

-- can_access_city_branch(target_city_branch_id uuid)
CREATE OR REPLACE FUNCTION public.can_access_city_branch(target_city_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- can_access_clearing_agent(target_agent_id uuid)
CREATE OR REPLACE FUNCTION public.can_access_clearing_agent(target_agent_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select is_super_admin()
    or exists (
      select 1
      from user_role_assignments ura
      where ura.user_id = auth.uid()
        and ura.clearing_agent_id = target_agent_id
        and ura.is_active = true
        and ura.deleted_at is null
    );
$function$
;

-- can_access_country(target_country_id uuid)
CREATE OR REPLACE FUNCTION public.can_access_country(target_country_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- can_access_country_branch(target_country_branch_id uuid)
CREATE OR REPLACE FUNCTION public.can_access_country_branch(target_country_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- can_manage_country(target_country_id uuid)
CREATE OR REPLACE FUNCTION public.can_manage_country(target_country_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- create_account(target_company_id uuid, target_branch_id uuid, parent_account_id uuid, account_code text, account_name text, account_kind_value account_kind, account_currency text, is_control boolean)
CREATE OR REPLACE FUNCTION public.create_account(target_company_id uuid, target_branch_id uuid, parent_account_id uuid, account_code text, account_name text, account_kind_value account_kind, account_currency text, is_control boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_account_id uuid;
begin
  if not has_company_permission(target_company_id, 'accounts', 'create') then
    raise exception 'Missing permission to create accounts';
  end if;

  if trim(account_code) = '' or trim(account_name) = '' then
    raise exception 'Account code and name are required';
  end if;

  if target_branch_id is not null and not exists (
    select 1 from branches
    where id = target_branch_id
      and company_id = target_company_id
      and deleted_at is null
  ) then
    raise exception 'Branch does not belong to the target company';
  end if;

  if parent_account_id is not null and not exists (
    select 1 from accounts
    where id = parent_account_id
      and company_id = target_company_id
      and deleted_at is null
  ) then
    raise exception 'Parent account does not belong to the target company';
  end if;

  insert into accounts (
    company_id,
    branch_id,
    parent_id,
    code,
    name,
    kind,
    currency,
    is_control_account
  )
  values (
    target_company_id,
    target_branch_id,
    parent_account_id,
    trim(account_code),
    trim(account_name),
    account_kind_value,
    upper(trim(account_currency)),
    is_control
  )
  returning id into new_account_id;

  insert into audit_logs (company_id, actor_id, action, entity_table, entity_id, after)
  values (
    target_company_id,
    auth.uid(),
    'create',
    'accounts',
    new_account_id,
    jsonb_build_object('code', trim(account_code), 'name', trim(account_name), 'kind', account_kind_value)
  );

  return new_account_id;
end;
$function$
;

-- create_city_branch(target_country_id uuid, target_country_branch_id uuid, city_name text, branch_name text, branch_code text, branch_currency text)
CREATE OR REPLACE FUNCTION public.create_city_branch(target_country_id uuid, target_country_branch_id uuid, city_name text, branch_name text, branch_code text, branch_currency text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_city_branch_id uuid;
begin
  if not can_manage_country(target_country_id) then
    raise exception 'Only Super Admin or Country Admin can create city branches for this country';
  end if;

  if not exists (
    select 1 from country_branches
    where id = target_country_branch_id
      and country_id = target_country_id
      and deleted_at is null
  ) then
    raise exception 'Main branch does not belong to selected country';
  end if;

  insert into city_branches (
    country_id,
    country_branch_id,
    city_name,
    name,
    code,
    local_currency,
    created_by
  )
  values (
    target_country_id,
    target_country_branch_id,
    trim(city_name),
    trim(branch_name),
    upper(trim(branch_code)),
    upper(trim(branch_currency)),
    auth.uid()
  )
  returning id into new_city_branch_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, after)
  values (
    auth.uid(),
    'create',
    'city_branches',
    new_city_branch_id,
    jsonb_build_object(
      'country_id', target_country_id,
      'country_branch_id', target_country_branch_id,
      'city_name', trim(city_name),
      'name', trim(branch_name),
      'code', upper(trim(branch_code))
    )
  );

  return new_city_branch_id;
end;
$function$
;

-- create_company_workspace(company_name text, legal_name text, base_currency text, branch_name text, branch_code text, owner_full_name text)
CREATE OR REPLACE FUNCTION public.create_company_workspace(company_name text, legal_name text, base_currency text, branch_name text, branch_code text, owner_full_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_user_id uuid := auth.uid();
  new_company_id uuid;
  new_branch_id uuid;
  owner_role_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if trim(company_name) = '' or trim(branch_name) = '' or trim(branch_code) = '' then
    raise exception 'Company and branch details are required';
  end if;

  insert into companies (name, legal_name, base_currency)
  values (trim(company_name), nullif(trim(legal_name), ''), upper(trim(base_currency)))
  returning id into new_company_id;

  insert into branches (company_id, name, code)
  values (new_company_id, trim(branch_name), upper(trim(branch_code)))
  returning id into new_branch_id;

  insert into profiles (id, full_name, default_company_id)
  values (current_user_id, trim(owner_full_name), new_company_id)
  on conflict (id) do update
    set full_name = excluded.full_name,
        default_company_id = excluded.default_company_id,
        updated_at = now();

  insert into roles (company_id, name, description, is_system)
  values (new_company_id, 'Owner', 'Full company administration and posting access.', true)
  returning id into owner_role_id;

  insert into role_permissions (role_id, permission_id)
  select owner_role_id, id
  from permissions;

  insert into memberships (user_id, company_id, role_id, scope)
  values (current_user_id, new_company_id, owner_role_id, 'company');

  insert into accounts (company_id, code, name, kind, currency, is_control_account)
  values
    (new_company_id, '1000', 'Cash and bank', 'asset', upper(trim(base_currency)), true),
    (new_company_id, '1100', 'Accounts receivable', 'asset', upper(trim(base_currency)), true),
    (new_company_id, '1200', 'Inventory', 'asset', upper(trim(base_currency)), true),
    (new_company_id, '2000', 'Accounts payable', 'liability', upper(trim(base_currency)), true),
    (new_company_id, '3000', 'Owner equity', 'equity', upper(trim(base_currency)), true),
    (new_company_id, '4000', 'Sales revenue', 'income', upper(trim(base_currency)), true),
    (new_company_id, '5000', 'Cost of goods sold', 'expense', upper(trim(base_currency)), true);

  insert into audit_logs (company_id, actor_id, action, entity_table, entity_id, after)
  values (
    new_company_id,
    current_user_id,
    'create_workspace',
    'companies',
    new_company_id,
    jsonb_build_object('company_name', trim(company_name), 'branch_id', new_branch_id)
  );

  return new_company_id;
end;
$function$
;

-- create_country(country_name text, country_iso2 text, country_iso3 text, country_currency_code text)
CREATE OR REPLACE FUNCTION public.create_country(country_name text, country_iso2 text, country_iso3 text, country_currency_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_country_id uuid;
begin
  if not is_super_admin() then
    raise exception 'Only Super Admin can create countries';
  end if;

  if trim(country_name) = '' or trim(country_currency_code) = '' then
    raise exception 'Country name and currency are required';
  end if;

  insert into countries (name, iso2, iso3, currency_code)
  values (
    trim(country_name),
    nullif(upper(trim(country_iso2)), ''),
    nullif(upper(trim(country_iso3)), ''),
    upper(trim(country_currency_code))
  )
  returning id into new_country_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, after)
  values (
    auth.uid(),
    'create',
    'countries',
    new_country_id,
    jsonb_build_object('name', trim(country_name), 'currency_code', upper(trim(country_currency_code)))
  );

  return new_country_id;
end;
$function$
;

-- create_country_main_branch(target_country_id uuid, branch_name text, branch_code text)
CREATE OR REPLACE FUNCTION public.create_country_main_branch(target_country_id uuid, branch_name text, branch_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_branch_id uuid;
  country_currency text;
begin
  if not is_super_admin() then
    raise exception 'Only Super Admin can create country main branches';
  end if;

  select currency_code into country_currency
  from countries
  where id = target_country_id and deleted_at is null;

  if country_currency is null then
    raise exception 'Country not found';
  end if;

  insert into country_branches (country_id, name, code, local_currency, is_main, created_by)
  values (target_country_id, trim(branch_name), upper(trim(branch_code)), country_currency, true, auth.uid())
  returning id into new_branch_id;

  insert into audit_logs (actor_id, action, entity_table, entity_id, after)
  values (
    auth.uid(),
    'create',
    'country_branches',
    new_branch_id,
    jsonb_build_object('country_id', target_country_id, 'name', trim(branch_name), 'code', upper(trim(branch_code)))
  );

  return new_branch_id;
end;
$function$
;

-- create_customer(p_country_id uuid, p_state_province_id uuid, p_city_id uuid, p_area_location_id uuid, p_customer_name text, p_company_name text, p_contact_person text, p_mobile text, p_whatsapp text, p_email text, p_address text, p_notes text, p_original_language_code text)
CREATE OR REPLACE FUNCTION public.create_customer(p_country_id uuid, p_state_province_id uuid, p_city_id uuid, p_area_location_id uuid, p_customer_name text, p_company_name text, p_contact_person text, p_mobile text, p_whatsapp text, p_email text, p_address text, p_notes text, p_original_language_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_customer_id uuid;
begin
  if trim(coalesce(p_customer_name, '')) = '' then
    raise exception 'Customer name is required';
  end if;

  insert into customers (
    country_id,
    state_province_id,
    city_id,
    area_location_id,
    customer_name,
    company_name,
    contact_person,
    mobile,
    whatsapp,
    email,
    address,
    notes,
    original_language_code
  )
  values (
    p_country_id,
    p_state_province_id,
    p_city_id,
    p_area_location_id,
    trim(p_customer_name),
    nullif(trim(coalesce(p_company_name, '')), ''),
    nullif(trim(coalesce(p_contact_person, '')), ''),
    nullif(trim(coalesce(p_mobile, '')), ''),
    nullif(trim(coalesce(p_whatsapp, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(nullif(trim(p_original_language_code), ''), 'en')
  )
  returning id into new_customer_id;

  return new_customer_id;
end;
$function$
;

-- create_customer(p_country_id uuid, p_state_province_id uuid, p_district_id uuid, p_city_id uuid, p_area_location_id uuid, p_customer_name text, p_company_name text, p_contact_person text, p_mobile text, p_whatsapp text, p_email text, p_address text, p_notes text, p_original_language_code text)
CREATE OR REPLACE FUNCTION public.create_customer(p_country_id uuid, p_state_province_id uuid, p_district_id uuid, p_city_id uuid, p_area_location_id uuid, p_customer_name text, p_company_name text, p_contact_person text, p_mobile text, p_whatsapp text, p_email text, p_address text, p_notes text, p_original_language_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
      declare
        new_customer_id uuid;
      begin
        if trim(coalesce(p_customer_name, '')) = '' then
          raise exception 'Customer name is required';
        end if;

        insert into customers (
          country_id,
          state_province_id,
          district_id,
          city_id,
          area_location_id,
          customer_name,
          company_name,
          contact_person,
          mobile,
          whatsapp,
          email,
          address,
          notes,
          original_language_code
        )
        values (
          p_country_id,
          p_state_province_id,
          p_district_id,
          p_city_id,
          p_area_location_id,
          trim(p_customer_name),
          nullif(trim(coalesce(p_company_name, '')), ''),
          nullif(trim(coalesce(p_contact_person, '')), ''),
          nullif(trim(coalesce(p_mobile, '')), ''),
          nullif(trim(coalesce(p_whatsapp, '')), ''),
          nullif(lower(trim(coalesce(p_email, ''))), ''),
          nullif(trim(coalesce(p_address, '')), ''),
          nullif(trim(coalesce(p_notes, '')), ''),
          coalesce(nullif(trim(p_original_language_code), ''), 'en')
        )
        returning id into new_customer_id;

        return new_customer_id;
      end;
      $function$
;

-- create_employee(p_payload jsonb, p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.create_employee(p_payload jsonb, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_id uuid;
  rec employees;
  emp_count int;
  generated_code text;
begin
  if (p_payload->>'person_master_id') is null then
    raise exception 'person_master_id is required';
  end if;
  if (p_payload->>'category') is null then
    raise exception 'category is required';
  end if;

  rec := jsonb_populate_record(null::employees, p_payload);
  rec.id := coalesce(rec.id, gen_random_uuid());

  if rec.employee_code is null or rec.employee_code = '' then
    select count(*) into emp_count from employees;
    generated_code := 'EMP-' || lpad((coalesce(emp_count, 0) + 1)::text, 4, '0');
    rec.employee_code := generated_code;
  end if;

  insert into employees (
    id, person_master_id, employee_code, category, designation, department,
    country_id, country_branch_id, city_branch_id, reporting_manager_id,
    joining_date, probation_start_date, probation_end_date, employment_type,
    job_status, working_shift, duty_start_time, duty_end_time, weekly_off_day,
    contract_start_date, contract_end_date, status,
    salary_type, basic_salary, salary_currency, monthly_salary, daily_salary,
    hourly_salary, overtime_rate, allowance, accommodation_allowance,
    transport_allowance, food_allowance, mobile_allowance, other_allowance,
    deduction, advance_deduction, loan_deduction, tax_deduction, net_salary,
    salary_start_date, salary_payment_date, salary_payment_method, salary_schedule,
    salary_schedule_date, salary_expense_account_id, employee_payable_account_id,
    cash_account_id, bank_account_id, advance_salary_account_id, loan_account_id,
    deduction_account_id, created_by
  ) values (
    rec.id, rec.person_master_id, rec.employee_code, rec.category, rec.designation, rec.department,
    rec.country_id, rec.country_branch_id, rec.city_branch_id, rec.reporting_manager_id,
    rec.joining_date, rec.probation_start_date, rec.probation_end_date, rec.employment_type,
    rec.job_status, rec.working_shift, rec.duty_start_time, rec.duty_end_time, rec.weekly_off_day,
    rec.contract_start_date, rec.contract_end_date, coalesce(rec.status, 'Active'),
    rec.salary_type, coalesce(rec.basic_salary, 0), coalesce(rec.salary_currency, 'USD'), coalesce(rec.monthly_salary, 0), coalesce(rec.daily_salary, 0),
    coalesce(rec.hourly_salary, 0), coalesce(rec.overtime_rate, 0), coalesce(rec.allowance, 0), coalesce(rec.accommodation_allowance, 0),
    coalesce(rec.transport_allowance, 0), coalesce(rec.food_allowance, 0), coalesce(rec.mobile_allowance, 0), coalesce(rec.other_allowance, 0),
    coalesce(rec.deduction, 0), coalesce(rec.advance_deduction, 0), coalesce(rec.loan_deduction, 0), coalesce(rec.tax_deduction, 0), coalesce(rec.net_salary, 0),
    rec.salary_start_date, rec.salary_payment_date, rec.salary_payment_method, rec.salary_schedule,
    rec.salary_schedule_date, rec.salary_expense_account_id, rec.employee_payable_account_id,
    rec.cash_account_id, rec.bank_account_id, rec.advance_salary_account_id, rec.loan_account_id,
    rec.deduction_account_id, p_actor_id
  )
  returning id into new_id;

  return new_id;
end;
$function$
;

-- create_employee_advance_loan(p_payload jsonb, p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.create_employee_advance_loan(p_payload jsonb, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  emp employees;
  new_row employee_advances_loans;
  is_loan boolean;
  updated_deduction numeric;
  updated_advance_deduction numeric;
  updated_loan_deduction numeric;
  updated_net_salary numeric;
begin
  select * into emp from employees where id = (p_payload->>'employee_id')::uuid and deleted_at is null;
  if not found then
    raise exception 'employee not found';
  end if;

  is_loan := position('loan' in lower(p_payload->>'type')) > 0;

  insert into employee_advances_loans (
    employee_id, type, amount, currency, payment_date, payment_account_id,
    recovery_method, monthly_deduction, remaining_balance, start_month, remarks,
    status, journal_entry_id, created_by
  ) values (
    emp.id,
    p_payload->>'type',
    (p_payload->>'amount')::numeric,
    coalesce(p_payload->>'currency', 'USD'),
    (p_payload->>'payment_date')::date,
    nullif(p_payload->>'payment_account_id', '')::uuid,
    coalesce(p_payload->>'recovery_method', 'Monthly Salary Deduction'),
    coalesce((p_payload->>'monthly_deduction')::numeric, 0),
    (p_payload->>'amount')::numeric,
    nullif(p_payload->>'start_month', ''),
    p_payload->>'remarks',
    'Active',
    nullif(p_payload->>'journal_entry_id', '')::uuid,
    p_actor_id
  )
  returning * into new_row;

  updated_deduction := coalesce(emp.deduction, 0) + coalesce((p_payload->>'monthly_deduction')::numeric, 0);
  if is_loan then
    updated_loan_deduction := coalesce(emp.loan_deduction, 0) + coalesce((p_payload->>'monthly_deduction')::numeric, 0);
    updated_advance_deduction := emp.advance_deduction;
  else
    updated_advance_deduction := coalesce(emp.advance_deduction, 0) + coalesce((p_payload->>'monthly_deduction')::numeric, 0);
    updated_loan_deduction := emp.loan_deduction;
  end if;
  updated_net_salary := coalesce(emp.basic_salary, 0) + coalesce(emp.allowance, 0) - updated_deduction;

  update employees set
    deduction = updated_deduction,
    advance_deduction = updated_advance_deduction,
    loan_deduction = updated_loan_deduction,
    net_salary = updated_net_salary
  where id = emp.id;

  return to_jsonb(new_row);
end;
$function$
;

-- create_enterprise_account(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_parent_id uuid, p_code text, p_name text, p_kind account_kind, p_currency text, p_opening_balance numeric, p_is_control_account boolean)
CREATE OR REPLACE FUNCTION public.create_enterprise_account(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_parent_id uuid, p_code text, p_name text, p_kind account_kind, p_currency text, p_opening_balance numeric, p_is_control_account boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- create_enterprise_ledger(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_enterprise_account_id uuid, p_parent_ledger_id uuid, p_code text, p_name text, p_currency text, p_opening_balance numeric, p_normal_balance ledger_direction)
CREATE OR REPLACE FUNCTION public.create_enterprise_ledger(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_enterprise_account_id uuid, p_parent_ledger_id uuid, p_code text, p_name text, p_currency text, p_opening_balance numeric, p_normal_balance ledger_direction)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- create_financial_period(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_period_name text, p_start_date date, p_end_date date)
CREATE OR REPLACE FUNCTION public.create_financial_period(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_period_name text, p_start_date date, p_end_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- delete_employee(p_id uuid)
CREATE OR REPLACE FUNCTION public.delete_employee(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update employees set deleted_at = now() where id = p_id;
$function$
;

-- enterprise_scope_matches(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, row_scope ledger_scope, row_country_id uuid, row_country_branch_id uuid, row_city_branch_id uuid)
CREATE OR REPLACE FUNCTION public.enterprise_scope_matches(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, row_scope ledger_scope, row_country_id uuid, row_country_branch_id uuid, row_city_branch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select p_scope = row_scope
    and coalesce(p_country_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(row_country_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(p_country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(row_country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(p_city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(row_city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid);
$function$
;

-- finalize_salary_due_payment(p_id uuid, p_payload jsonb, p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.finalize_salary_due_payment(p_id uuid, p_payload jsonb, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  updated_row employee_salaries_due;
begin
  update employee_salaries_due set
    status = 'Paid',
    payment_method = coalesce(p_payload->>'payment_method', payment_method),
    payment_account_id = nullif(p_payload->>'payment_account_id', '')::uuid,
    exchange_rate = coalesce((p_payload->>'exchange_rate')::numeric, exchange_rate),
    local_currency_amount = coalesce((p_payload->>'local_currency_amount')::numeric, local_currency_amount),
    journal_entry_id = nullif(p_payload->>'journal_entry_id', '')::uuid,
    payment_journal_entry_id = nullif(p_payload->>'payment_journal_entry_id', '')::uuid,
    transfer_date = now(),
    posting_date = (p_payload->>'posting_date')::date,
    paid_date = (p_payload->>'paid_date')::date,
    transferred_by = p_actor_id
  where id = p_id and deleted_at is null
  returning * into updated_row;

  if not found then
    raise exception 'salary due record not found';
  end if;

  return to_jsonb(updated_row);
end;
$function$
;

-- get_branch_cash_summary(p_country_id uuid, p_country_branch_id uuid, p_date text)
CREATE OR REPLACE FUNCTION public.get_branch_cash_summary(p_country_id uuid, p_country_branch_id uuid DEFAULT NULL::uuid, p_date text DEFAULT NULL::text)
 RETURNS TABLE(total_debit numeric, total_credit numeric, balance numeric, entry_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_date date := coalesce(p_date::date, current_date);
begin
  return query
  select
    coalesce(sum(l.debit), 0)::numeric as total_debit,
    coalesce(sum(l.credit), 0)::numeric as total_credit,
    (coalesce(sum(l.credit), 0) - coalesce(sum(l.debit), 0))::numeric as balance,
    count(distinct e.id)::bigint as entry_count
  from public.roznamcha_entries e
  left join public.roznamcha_lines l on l.roznamcha_entry_id = e.id
  where e.deleted_at is null
    and e.country_id = p_country_id
    and (p_country_branch_id is null or e.country_branch_id = p_country_branch_id)
    and e.entry_date = v_date;
end;
$function$
;

-- get_daily_rate(p_country_id uuid, p_country_branch_id uuid, p_date text)
CREATE OR REPLACE FUNCTION public.get_daily_rate(p_country_id uuid, p_country_branch_id uuid DEFAULT NULL::uuid, p_date text DEFAULT NULL::text)
 RETURNS TABLE(rate_date text, buying_rate numeric, selling_rate numeric, credit_rate numeric, debit_rate numeric, is_exact_date boolean, is_branch_specific boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_date text := coalesce(p_date, to_char(now(), 'YYYY-MM-DD'));
begin
  return query
  select
    r.rate_date::text,
    r.buying_rate::numeric,
    r.selling_rate::numeric,
    r.credit_rate::numeric,
    r.debit_rate::numeric,
    (r.rate_date = v_date) as is_exact_date,
    (r.country_branch_id is not null) as is_branch_specific
  from public.daily_usd_rates r
  where r.deleted_at is null
    and r.country_id = p_country_id
    and (p_country_branch_id is null or r.country_branch_id = p_country_branch_id or r.country_branch_id is null)
    and r.rate_date <= v_date
  order by r.rate_date desc, (case when r.country_branch_id is not null then 1 else 0 end) desc
  limit 1;
end;
$function$
;

-- get_employee_with_relations(p_id uuid)
CREATE OR REPLACE FUNCTION public.get_employee_with_relations(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select to_jsonb(e) || jsonb_build_object(
    'person', case when p.id is null then null else to_jsonb(p) end,
    'country', case when c.id is null then null else to_jsonb(c) end,
    'country_branch', case when cb.id is null then null else to_jsonb(cb) end,
    'city_branch', case when cib.id is null then null else to_jsonb(cib) end
  )
  from employees e
  left join customers p on p.id = e.person_master_id
  left join countries c on c.id = e.country_id
  left join country_branches cb on cb.id = e.country_branch_id
  left join city_branches cib on cib.id = e.city_branch_id
  where e.id = p_id and e.deleted_at is null;
$function$
;

-- get_global_financial_consolidation(p_from_date date, p_to_date date)
CREATE OR REPLACE FUNCTION public.get_global_financial_consolidation(p_from_date date, p_to_date date)
 RETURNS TABLE(country_id uuid, country_name text, debit_usd numeric, credit_usd numeric, net_usd numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- get_ledger_statement(p_ledger_id uuid, p_from_date date, p_to_date date)
CREATE OR REPLACE FUNCTION public.get_ledger_statement(p_ledger_id uuid, p_from_date date, p_to_date date)
 RETURNS TABLE(entry_date date, source_table text, source_id uuid, reference_no text, description text, debit numeric, credit numeric, currency text, usd_rate numeric, usd_amount numeric, running_balance numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- get_salary_due_with_employee(p_id uuid)
CREATE OR REPLACE FUNCTION public.get_salary_due_with_employee(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select to_jsonb(sd) || jsonb_build_object(
    'employee', case when e.id is null then null else jsonb_build_object(
      'id', e.id,
      'employee_code', e.employee_code,
      'person', case when p.id is null then null else jsonb_build_object('customer_name', p.customer_name) end,
      'salary_expense_account_id', e.salary_expense_account_id,
      'employee_payable_account_id', e.employee_payable_account_id,
      'cash_account_id', e.cash_account_id,
      'bank_account_id', e.bank_account_id,
      'advance_salary_account_id', e.advance_salary_account_id,
      'loan_account_id', e.loan_account_id,
      'deduction', e.deduction,
      'tax_deduction', e.tax_deduction,
      'basic_salary', e.basic_salary,
      'allowance', e.allowance
    ) end
  )
  from employee_salaries_due sd
  left join employees e on e.id = sd.employee_id
  left join customers p on p.id = e.person_master_id
  where sd.id = p_id and sd.deleted_at is null;
$function$
;

-- get_trial_balance(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_as_of_date date)
CREATE OR REPLACE FUNCTION public.get_trial_balance(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_as_of_date date)
 RETURNS TABLE(ledger_id uuid, parent_ledger_id uuid, code text, name text, currency text, opening_balance numeric, debit_total numeric, credit_total numeric, balance numeric, debit_balance numeric, credit_balance numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- has_company_permission(target_company_id uuid, target_resource text, target_action permission_action)
CREATE OR REPLACE FUNCTION public.has_company_permission(target_company_id uuid, target_resource text, target_action permission_action)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from memberships m
    join role_permissions rp on rp.role_id = m.role_id
    join permissions p on p.id = rp.permission_id
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.deleted_at is null
      and p.resource = target_resource
      and p.action = target_action
  );
$function$
;

-- hr_seed_employee_checklist(p_employee_id uuid, p_phase text, p_actor uuid)
CREATE OR REPLACE FUNCTION public.hr_seed_employee_checklist(p_employee_id uuid, p_phase text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE v_n int; v_country uuid; v_city uuid;
BEGIN
  SELECT country_id, city_branch_id INTO v_country, v_city FROM public.employees WHERE id = p_employee_id;
  INSERT INTO public.hr_employee_checklist
    (employee_id, phase, category, task_name, responsible, is_mandatory, country_id, city_branch_id, created_by)
  SELECT p_employee_id, t.phase, t.category, t.task_name, t.responsible, t.is_mandatory, v_country, v_city, p_actor
  FROM public.hr_checklist_templates t
  WHERE t.deleted_at IS NULL AND t.is_active AND t.phase = p_phase
    AND (t.country_id IS NULL OR t.country_id = v_country)
  ON CONFLICT (employee_id, phase, lower(task_name)) WHERE deleted_at IS NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$
;

-- insert_salary_due(p_payload jsonb, p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.insert_salary_due(p_payload jsonb, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_id uuid;
begin
  insert into employee_salaries_due (
    employee_id, salary_month, due_date, basic_salary, allowances, overtime,
    deductions, advance_recovery, loan_recovery, net_salary, currency, status,
    country_id, branch_id, created_by
  ) values (
    (p_payload->>'employee_id')::uuid,
    p_payload->>'salary_month',
    (p_payload->>'due_date')::date,
    coalesce((p_payload->>'basic_salary')::numeric, 0),
    coalesce((p_payload->>'allowances')::numeric, 0),
    coalesce((p_payload->>'overtime')::numeric, 0),
    coalesce((p_payload->>'deductions')::numeric, 0),
    coalesce((p_payload->>'advance_recovery')::numeric, 0),
    coalesce((p_payload->>'loan_recovery')::numeric, 0),
    coalesce((p_payload->>'net_salary')::numeric, 0),
    coalesce(p_payload->>'currency', 'USD'),
    coalesce(p_payload->>'status', 'Due'),
    nullif(p_payload->>'country_id', '')::uuid,
    nullif(p_payload->>'branch_id', '')::uuid,
    p_actor_id
  )
  returning id into new_id;

  return new_id;
end;
$function$
;

-- is_company_member(target_company_id uuid)
CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from memberships
    where memberships.company_id = target_company_id
      and memberships.user_id = auth.uid()
      and memberships.is_active = true
      and memberships.deleted_at is null
  );
$function$
;

-- is_shipping_scoped_user()
CREATE OR REPLACE FUNCTION public.is_shipping_scoped_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    not is_super_admin()
    and not exists (
      select 1 from user_role_assignments f
      where f.user_id = auth.uid()
        and f.ledger_visibility = 'full'
        and f.is_active = true
        and f.deleted_at is null
    )
    and exists (
      select 1 from user_role_assignments s
      where s.user_id = auth.uid()
        and s.clearing_agent_id is not null
        and s.ledger_visibility = 'shipping_only'
        and s.is_active = true
        and s.deleted_at is null
    );
$function$
;

-- is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.role = 'super_admin'
      and ura.is_active = true
      and ura.deleted_at is null
  );
$function$
;

-- list_active_employees_in_scope(p_country_id uuid, p_branch_id uuid)
CREATE OR REPLACE FUNCTION public.list_active_employees_in_scope(p_country_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
  from employees e
  where e.status = 'Active' and e.deleted_at is null
    and (p_country_id is null or e.country_id = p_country_id)
    and (p_branch_id is null or e.country_branch_id = p_branch_id);
$function$
;

-- list_employee_advances_loans(p_employee_id uuid, p_status text)
CREATE OR REPLACE FUNCTION public.list_employee_advances_loans(p_employee_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(row_data order by row_data->>'payment_date' desc), '[]'::jsonb)
  from (
    select to_jsonb(al) || jsonb_build_object(
      'employee', case when e.id is null then null else jsonb_build_object(
        'id', e.id,
        'employee_code', e.employee_code,
        'person', case when p.id is null then null else jsonb_build_object('customer_name', p.customer_name) end
      ) end,
      'payment_ledger', case when l.id is null then null else jsonb_build_object('id', l.id, 'name', l.name, 'code', l.code) end
    ) as row_data
    from employee_advances_loans al
    left join employees e on e.id = al.employee_id
    left join customers p on p.id = e.person_master_id
    left join ledgers l on l.id = al.payment_account_id
    where al.deleted_at is null
      and (p_employee_id is null or al.employee_id = p_employee_id)
      and (p_status is null or al.status = p_status)
  ) sub;
$function$
;

-- list_salaries_due(p_month text, p_country_id uuid, p_branch_id uuid, p_status text)
CREATE OR REPLACE FUNCTION public.list_salaries_due(p_month text DEFAULT NULL::text, p_country_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(row_data order by row_data->>'due_date' desc), '[]'::jsonb)
  from (
    select to_jsonb(sd) || jsonb_build_object(
      'employee', case when e.id is null then null else jsonb_build_object(
        'id', e.id,
        'employee_code', e.employee_code,
        'category', e.category,
        'designation', e.designation,
        'basic_salary', e.basic_salary,
        'salary_currency', e.salary_currency,
        'salary_expense_account_id', e.salary_expense_account_id,
        'employee_payable_account_id', e.employee_payable_account_id,
        'cash_account_id', e.cash_account_id,
        'bank_account_id', e.bank_account_id,
        'person', case when p.id is null then null else jsonb_build_object('customer_name', p.customer_name, 'company_name', p.company_name) end
      ) end
    ) as row_data
    from employee_salaries_due sd
    left join employees e on e.id = sd.employee_id
    left join customers p on p.id = e.person_master_id
    where sd.deleted_at is null
      and (p_month is null or sd.salary_month = p_month)
      and (p_country_id is null or sd.country_id = p_country_id)
      and (p_branch_id is null or sd.branch_id = p_branch_id)
      and (p_status is null or sd.status = p_status)
  ) sub;
$function$
;

-- next_transaction_serial(p_scope_type text, p_scope_key text, p_prefix text)
CREATE OR REPLACE FUNCTION public.next_transaction_serial(p_scope_type text, p_scope_key text, p_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delegate to entity-aware version with default entity_type
  RETURN next_entity_serial(p_scope_type, p_scope_key, 'roznamcha', p_prefix);
END;
$function$
;

-- normalize_transaction_serial_prefix(p_scope_type text, p_scope_key text, p_prefix text)
CREATE OR REPLACE FUNCTION public.normalize_transaction_serial_prefix(p_scope_type text, p_scope_key text, p_prefix text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_raw text;
  v_candidate text;
  v_country record;
  v_branch record;
  v_parts text[];
  v_part text;
begin
  v_raw := upper(coalesce(nullif(trim(p_prefix), ''), 'TXN'));

  if p_scope_type = 'country' and p_scope_key is not null then
    select iso2, iso3, name into v_country
    from countries
    where id::text = p_scope_key
    limit 1;

    if found then
      if coalesce(v_country.name, '') ilike '%United Arab Emirates%' then
        v_candidate := 'UAE';
      else
        v_candidate := coalesce(nullif(v_country.iso3, ''), nullif(v_country.iso2, ''), v_country.name, v_raw);
      end if;
      v_raw := upper(v_candidate);
    end if;
  end if;

  if p_scope_type in ('branch', 'main_branch', 'city_branch') and p_scope_key is not null then
    select code, name into v_branch
    from city_branches
    where id::text = p_scope_key
    limit 1;

    if not found then
      select code, name into v_branch
      from country_branches
      where id::text = p_scope_key
      limit 1;
    end if;

    if found then
      -- Prefer a short branch label from the branch name (e.g. CH/01 -> CH).
      -- Otherwise fall back to branch code (e.g. PAK-QTA-002 -> QTA/PKBA).
      v_candidate := upper(coalesce(v_branch.name, ''));
      v_parts := array(
        select part
        from regexp_split_to_table(regexp_replace(v_candidate, '[^A-Z0-9]+', '-', 'g'), '-') as part
        where part <> '' and part !~ '^[0-9]+$' and part not in ('BR', 'BRANCH', 'CITY', 'COUNTRY')
      );

      if array_length(v_parts, 1) >= 1 and length(v_parts[1]) between 2 and 4 then
        v_raw := v_parts[1];
      else
        v_raw := upper(coalesce(nullif(v_branch.code, ''), v_branch.name, v_raw));
      end if;
    end if;
  end if;

  v_raw := regexp_replace(v_raw, '[^A-Z0-9]+', '-', 'g');
  v_raw := trim(both '-' from v_raw);

  if p_scope_type in ('branch', 'main_branch', 'city_branch') then
    v_parts := array(
      select part
      from regexp_split_to_table(v_raw, '-') as part
      where part <> ''
        and part !~ '^[0-9]+$'
        and part not in ('BR', 'BRANCH', 'CITY', 'COUNTRY')
    );

    if array_length(v_parts, 1) >= 2 and length(v_parts[1]) between 2 and 4 then
      return substring(v_parts[2] from 1 for 6);
    end if;

    if array_length(v_parts, 1) >= 1 then
      return substring(v_parts[1] from 1 for 6);
    end if;
  end if;

  v_raw := regexp_replace(v_raw, '[^A-Z0-9]', '', 'g');
  if v_raw = '' then
    v_raw := 'TXN';
  end if;

  return substring(v_raw from 1 for 6);
end;
$function$
;

-- post_enterprise_ledger_batch(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_entry_date date, p_reference_no text, p_narration text, p_lines jsonb)
CREATE OR REPLACE FUNCTION public.post_enterprise_ledger_batch(p_scope ledger_scope, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_entry_date date, p_reference_no text, p_narration text, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- post_journal_entry(target_journal_entry_id uuid)
CREATE OR REPLACE FUNCTION public.post_journal_entry(target_journal_entry_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  entry_record journal_entries%rowtype;
  debit_total numeric(18, 4);
  credit_total numeric(18, 4);
begin
  select * into entry_record
  from journal_entries
  where id = target_journal_entry_id
  for update;

  if not found then
    raise exception 'Journal entry not found';
  end if;

  if entry_record.status <> 'draft' then
    raise exception 'Only draft journal entries can be posted';
  end if;

  if not has_company_permission(entry_record.company_id, 'journal_entries', 'post') then
    raise exception 'Missing permission to post journal entries';
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into debit_total, credit_total
  from journal_lines
  where journal_entry_id = target_journal_entry_id;

  if debit_total <= 0 or debit_total <> credit_total then
    raise exception 'Journal entry is not balanced';
  end if;

  insert into ledger_entries (
    company_id,
    branch_id,
    journal_entry_id,
    journal_line_id,
    account_id,
    entry_date,
    direction,
    amount,
    currency,
    exchange_rate,
    base_amount
  )
  select
    entry_record.company_id,
    entry_record.branch_id,
    entry_record.id,
    jl.id,
    jl.account_id,
    entry_record.entry_date,
    case when jl.debit > 0 then 'debit'::ledger_direction else 'credit'::ledger_direction end,
    greatest(jl.debit, jl.credit),
    a.currency,
    1,
    greatest(jl.debit, jl.credit)
  from journal_lines jl
  join accounts a on a.id = jl.account_id
  where jl.journal_entry_id = target_journal_entry_id;

  update journal_entries
  set status = 'posted',
      posted_at = now(),
      posted_by = auth.uid(),
      updated_at = now()
  where id = target_journal_entry_id;

  insert into audit_logs (company_id, actor_id, action, entity_table, entity_id, after)
  values (
    entry_record.company_id,
    auth.uid(),
    'post',
    'journal_entries',
    target_journal_entry_id,
    jsonb_build_object('status', 'posted', 'debit_total', debit_total, 'credit_total', credit_total)
  );
end;
$function$
;

-- post_ledger_opening_balance(p_ledger_id uuid, p_financial_period_id uuid, p_opening_balance numeric, p_approval_request_id uuid)
CREATE OR REPLACE FUNCTION public.post_ledger_opening_balance(p_ledger_id uuid, p_financial_period_id uuid, p_opening_balance numeric, p_approval_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- post_purchase_booking_transfer(p_actor_id uuid, p_purchase_order_id uuid, p_kind purchase_order_payment_kind, p_entry_date date, p_amount numeric, p_currency_code text, p_exchange_rate numeric, p_debit_ledger_id uuid, p_credit_ledger_id uuid, p_reference_no text, p_narration text)
CREATE OR REPLACE FUNCTION public.post_purchase_booking_transfer(p_actor_id uuid, p_purchase_order_id uuid, p_kind purchase_order_payment_kind, p_entry_date date, p_amount numeric, p_currency_code text, p_exchange_rate numeric, p_debit_ledger_id uuid, p_credit_ledger_id uuid, p_reference_no text, p_narration text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result uuid;
begin
  -- Inject the actor into the JWT claims so all nested SECURITY DEFINER
  -- functions (assert_enterprise_scope_access, write_erp_audit_log, etc.)
  -- see a valid auth.uid() for the duration of this transaction.
  if p_actor_id is not null then
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_actor_id::text, 'role', 'authenticated')::text,
      true  -- is_local = true: only for this transaction
    );
  end if;

  -- Delegate to the existing posting function
  v_result := post_purchase_order_payment(
    p_purchase_order_id,
    p_kind,
    p_entry_date,
    p_amount,
    p_currency_code,
    p_exchange_rate,
    p_debit_ledger_id,
    p_credit_ledger_id,
    p_reference_no,
    p_narration
  );

  return v_result;
end;
$function$
;

-- post_roznamcha_entry(p_type roznamcha_type, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_journal_no text, p_voucher_no text, p_entry_date date, p_payment_method_id uuid, p_reference_no text, p_narration text, p_lines jsonb)
CREATE OR REPLACE FUNCTION public.post_roznamcha_entry(p_type roznamcha_type, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_journal_no text, p_voucher_no text, p_entry_date date, p_payment_method_id uuid, p_reference_no text, p_narration text, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- post_roznamcha_entry(p_type roznamcha_type, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_journal_no text, p_voucher_no text, p_entry_date date, p_payment_method_id uuid, p_reference_no text, p_narration text, p_lines jsonb, p_bypass_ledger_scope boolean)
CREATE OR REPLACE FUNCTION public.post_roznamcha_entry(p_type roznamcha_type, p_country_id uuid, p_country_branch_id uuid, p_city_branch_id uuid, p_journal_no text, p_voucher_no text, p_entry_date date, p_payment_method_id uuid, p_reference_no text, p_narration text, p_lines jsonb, p_bypass_ledger_scope boolean DEFAULT false)
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
$function$
;

-- post_sales_booking_transfer(p_actor_id uuid, p_sales_order_id uuid, p_payment_kind text, p_entry_date date, p_amount numeric, p_currency_code text, p_exchange_rate numeric, p_debit_ledger_id uuid, p_credit_ledger_id uuid, p_reference_no text, p_narration text)
CREATE OR REPLACE FUNCTION public.post_sales_booking_transfer(p_actor_id uuid, p_sales_order_id uuid, p_payment_kind text, p_entry_date date, p_amount numeric, p_currency_code text, p_exchange_rate numeric, p_debit_ledger_id uuid, p_credit_ledger_id uuid, p_reference_no text, p_narration text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result uuid;
begin
  -- Inject the actor into the JWT claims
  if p_actor_id is not null then
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_actor_id::text, 'role', 'authenticated')::text,
      true  -- only for this transaction
    );
  end if;

  v_result := post_sales_order_payment(
    p_sales_order_id,
    p_payment_kind,
    p_entry_date,
    p_amount,
    p_currency_code,
    p_exchange_rate,
    p_debit_ledger_id,
    p_credit_ledger_id,
    p_reference_no,
    p_narration
  );

  return v_result;
end;
$function$
;

-- recalc_sales_order_payment_totals(p_sales_order_id uuid)
CREATE OR REPLACE FUNCTION public.recalc_sales_order_payment_totals(p_sales_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total numeric(18,2);
  v_paid numeric(18,2);
  v_rem numeric(18,2);
  v_status text;
begin
  select coalesce(order_total,0) into v_total
  from sales_orders
  where id = p_sales_order_id
    and deleted_at is null;

  select coalesce(sum(amount),0) into v_paid
  from sales_order_payments
  where sales_order_id = p_sales_order_id
    and deleted_at is null
    and status = 'posted';

  v_rem := greatest(v_total - v_paid, 0);

  if v_total <= 0 then
    v_status := 'pending';
  elsif v_rem = 0 then
    v_status := 'paid';
  elsif v_paid > 0 then
    v_status := 'partially_paid';
  else
    v_status := 'pending';
  end if;

  update sales_orders
  set paid_amount = v_paid,
      remaining_amount = v_rem,
      payment_status = v_status,
      updated_at = now()
  where id = p_sales_order_id;
end $function$
;

-- recompute_employee_active_deductions(p_employee_id uuid)
CREATE OR REPLACE FUNCTION public.recompute_employee_active_deductions(p_employee_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  emp employees;
  active_loan_ded numeric := 0;
  active_adv_ded numeric := 0;
  total_deds numeric;
  next_net numeric;
begin
  select * into emp from employees where id = p_employee_id;
  if not found then
    return;
  end if;

  select
    coalesce(sum(monthly_deduction) filter (where type ilike '%loan%'), 0),
    coalesce(sum(monthly_deduction) filter (where type not ilike '%loan%'), 0)
  into active_loan_ded, active_adv_ded
  from employee_advances_loans
  where employee_id = p_employee_id and status = 'Active' and deleted_at is null;

  total_deds := coalesce(emp.deduction, 0) + coalesce(emp.tax_deduction, 0);
  next_net := greatest(0, coalesce(emp.basic_salary, 0) + coalesce(emp.allowance, 0) - total_deds - active_adv_ded - active_loan_ded);

  update employees set
    advance_deduction = active_adv_ded,
    loan_deduction = active_loan_ded,
    net_salary = next_net
  where id = p_employee_id;
end;
$function$
;

-- reverse_enterprise_ledger_batch(p_original_batch_id uuid, p_reason text, p_approval_request_id uuid)
CREATE OR REPLACE FUNCTION public.reverse_enterprise_ledger_batch(p_original_batch_id uuid, p_reason text, p_approval_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- reverse_roznamcha_entry(p_original_entry_id uuid, p_reason text, p_approval_request_id uuid)
CREATE OR REPLACE FUNCTION public.reverse_roznamcha_entry(p_original_entry_id uuid, p_reason text, p_approval_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- rls_auto_enable()
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

-- salary_due_exists(p_employee_id uuid, p_salary_month text)
CREATE OR REPLACE FUNCTION public.salary_due_exists(p_employee_id uuid, p_salary_month text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from employee_salaries_due
    where employee_id = p_employee_id and salary_month = p_salary_month and deleted_at is null
  );
$function$
;

-- search_record_translations(p_language_code text, p_query text, p_record_table text)
CREATE OR REPLACE FUNCTION public.search_record_translations(p_language_code text, p_query text, p_record_table text DEFAULT NULL::text)
 RETURNS TABLE(record_table text, record_id uuid, field_name text, resolved_text text)
 LANGUAGE sql
 STABLE
AS $function$
  select
    rt.record_table,
    rt.record_id,
    rt.field_name,
    coalesce(
      case p_language_code
        when 'ur' then rt.urdu_text
        when 'ps' then rt.pashto_text
        when 'ar' then rt.arabic_text
        when 'fa' then rt.persian_text
        else rt.english_text
      end,
      rt.english_text,
      rt.original_text
    ) as resolved_text
  from record_translations rt
  where rt.deleted_at is null
    and (p_record_table is null or rt.record_table = p_record_table)
    and (
      rt.original_text ilike '%' || p_query || '%'
      or rt.english_text ilike '%' || p_query || '%'
      or rt.urdu_text ilike '%' || p_query || '%'
      or rt.pashto_text ilike '%' || p_query || '%'
      or rt.arabic_text ilike '%' || p_query || '%'
      or rt.persian_text ilike '%' || p_query || '%'
    )
  order by rt.updated_at desc;
$function$
;

-- search_record_translations_v2(p_language_code text, p_query text, p_record_table text)
CREATE OR REPLACE FUNCTION public.search_record_translations_v2(p_language_code text, p_query text, p_record_table text DEFAULT NULL::text)
 RETURNS TABLE(record_table text, record_id uuid, field_name text, resolved_text text)
 LANGUAGE sql
 STABLE
AS $function$
  select
    rt.record_table,
    rt.record_id,
    rt.field_name,
    coalesce(
      rt.language_texts ->> p_language_code,
      case p_language_code
        when 'ur' then rt.urdu_text
        when 'ps' then rt.pashto_text
        when 'ar' then rt.arabic_text
        when 'fa' then rt.persian_text
        else rt.english_text
      end,
      rt.english_text,
      rt.original_text
    ) as resolved_text
  from record_translations rt
  where rt.deleted_at is null
    and (p_record_table is null or rt.record_table = p_record_table)
    and (
      rt.original_text ilike '%' || p_query || '%'
      or rt.english_text ilike '%' || p_query || '%'
      or rt.urdu_text ilike '%' || p_query || '%'
      or rt.pashto_text ilike '%' || p_query || '%'
      or rt.arabic_text ilike '%' || p_query || '%'
      or rt.persian_text ilike '%' || p_query || '%'
      or rt.language_texts::text ilike '%' || p_query || '%'
    )
  order by rt.updated_at desc;
$function$
;

-- sync_account_reference_columns()
CREATE OR REPLACE FUNCTION public.sync_account_reference_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  account_record record;
begin
  if new.enterprise_account_id is not null then
    select
      account_number,
      manual_reference_number,
      customer_number,
      country_serial_number,
      branch_serial_number
    into account_record
    from enterprise_accounts
    where id = new.enterprise_account_id;

    new.account_number := coalesce(new.account_number, account_record.account_number);
    new.manual_reference_number := coalesce(new.manual_reference_number, account_record.manual_reference_number);
    new.customer_number := coalesce(new.customer_number, account_record.customer_number);
    new.country_serial_number := coalesce(new.country_serial_number, account_record.country_serial_number);
    new.branch_serial_number := coalesce(new.branch_serial_number, account_record.branch_serial_number);
  end if;

  return new;
end;
$function$
;

-- sync_product_scope_mappings()
CREATE OR REPLACE FUNCTION public.sync_product_scope_mappings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into product_country_mapping (product_id, country_id, created_by)
  values (new.id, new.country_id, new.created_by)
  on conflict do nothing;

  if new.city_id is not null then
    insert into product_city_mapping (product_id, country_id, state_province_id, city_id, created_by)
    values (new.id, new.country_id, new.state_province_id, new.city_id, new.created_by)
    on conflict do nothing;
  end if;

  if new.country_branch_id is not null then
    insert into product_branch_mapping (product_id, country_id, country_branch_id, created_by)
    values (new.id, new.country_id, new.country_branch_id, new.created_by)
    on conflict do nothing;
  end if;

  if new.city_branch_id is not null then
    insert into product_branch_mapping (product_id, country_id, city_branch_id, created_by)
    values (new.id, new.country_id, new.city_branch_id, new.created_by)
    on conflict do nothing;
  end if;

  return new;
end;
$function$
;

-- tg_enroll_translations()
CREATE OR REPLACE FUNCTION public.tg_enroll_translations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_val text; v_id_text text; v_id uuid;
begin
  begin execute 'select ($1).id::text' into v_id_text using NEW; exception when others then return NEW; end;
  if v_id_text is null then return NEW; end if;
  begin v_id := v_id_text::uuid; exception when others then return NEW; end;
  for r in select field_name from public.translation_field_registry where table_name = TG_TABLE_NAME and is_active loop
    begin
      execute format('select ($1).%I::text', r.field_name) into v_val using NEW;
      if v_val is not null and btrim(v_val) <> '' then
        perform public.upsert_record_translation(TG_TABLE_NAME, v_id, r.field_name, v_val, 'en',
          v_val, v_val, v_val, v_val, v_val,
          jsonb_build_object('en',v_val,'ur',v_val,'ar',v_val,'fa',v_val,'ps',v_val),
          'imported','complete','trigger_enroll', null);
      end if;
    exception when others then null;
    end;
  end loop;
  return NEW;
end $function$
;

-- update_employee(p_id uuid, p_payload jsonb)
CREATE OR REPLACE FUNCTION public.update_employee(p_id uuid, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  rec employees;
begin
  select * into rec from employees where id = p_id and deleted_at is null;
  if not found then
    raise exception 'employee not found';
  end if;

  rec := jsonb_populate_record(rec, p_payload);

  update employees set
    person_master_id = rec.person_master_id,
    category = rec.category,
    designation = rec.designation,
    department = rec.department,
    country_id = rec.country_id,
    country_branch_id = rec.country_branch_id,
    city_branch_id = rec.city_branch_id,
    reporting_manager_id = rec.reporting_manager_id,
    joining_date = rec.joining_date,
    probation_start_date = rec.probation_start_date,
    probation_end_date = rec.probation_end_date,
    employment_type = rec.employment_type,
    job_status = rec.job_status,
    working_shift = rec.working_shift,
    duty_start_time = rec.duty_start_time,
    duty_end_time = rec.duty_end_time,
    weekly_off_day = rec.weekly_off_day,
    contract_start_date = rec.contract_start_date,
    contract_end_date = rec.contract_end_date,
    status = coalesce(rec.status, 'Active'),
    salary_type = rec.salary_type,
    basic_salary = coalesce(rec.basic_salary, 0),
    salary_currency = coalesce(rec.salary_currency, 'USD'),
    monthly_salary = coalesce(rec.monthly_salary, 0),
    daily_salary = coalesce(rec.daily_salary, 0),
    hourly_salary = coalesce(rec.hourly_salary, 0),
    overtime_rate = coalesce(rec.overtime_rate, 0),
    allowance = coalesce(rec.allowance, 0),
    accommodation_allowance = coalesce(rec.accommodation_allowance, 0),
    transport_allowance = coalesce(rec.transport_allowance, 0),
    food_allowance = coalesce(rec.food_allowance, 0),
    mobile_allowance = coalesce(rec.mobile_allowance, 0),
    other_allowance = coalesce(rec.other_allowance, 0),
    deduction = coalesce(rec.deduction, 0),
    advance_deduction = coalesce(rec.advance_deduction, 0),
    loan_deduction = coalesce(rec.loan_deduction, 0),
    tax_deduction = coalesce(rec.tax_deduction, 0),
    net_salary = coalesce(rec.net_salary, 0),
    salary_start_date = rec.salary_start_date,
    salary_payment_date = rec.salary_payment_date,
    salary_payment_method = rec.salary_payment_method,
    salary_schedule = rec.salary_schedule,
    salary_schedule_date = rec.salary_schedule_date,
    salary_expense_account_id = rec.salary_expense_account_id,
    employee_payable_account_id = rec.employee_payable_account_id,
    cash_account_id = rec.cash_account_id,
    bank_account_id = rec.bank_account_id,
    advance_salary_account_id = rec.advance_salary_account_id,
    loan_account_id = rec.loan_account_id,
    deduction_account_id = rec.deduction_account_id,
    updated_at = now()
  where id = p_id and deleted_at is null;

  return p_id;
end;
$function$
;

-- upsert_record_translation(p_record_table text, p_record_id uuid, p_field_name text, p_original_text text, p_original_language_code text, p_english text, p_urdu text, p_arabic text, p_persian text, p_pashto text, p_language_texts jsonb, p_source text, p_translation_status text, p_translated_by_engine text, p_actor_id uuid)
CREATE OR REPLACE FUNCTION public.upsert_record_translation(p_record_table text, p_record_id uuid, p_field_name text, p_original_text text, p_original_language_code text, p_english text, p_urdu text, p_arabic text, p_persian text, p_pashto text, p_language_texts jsonb, p_source text, p_translation_status text, p_translated_by_engine text, p_actor_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_source public.translation_source := coalesce(nullif(p_source, ''), 'auto')::public.translation_source;
  v_english text := coalesce(nullif(p_english, ''), p_original_text, '');
  v_urdu text := coalesce(nullif(p_urdu, ''), p_original_text, '');
  v_arabic text := coalesce(nullif(p_arabic, ''), p_original_text, '');
  v_persian text := coalesce(nullif(p_persian, ''), p_original_text, '');
  v_pashto text := coalesce(nullif(p_pashto, ''), p_original_text, '');
begin
  insert into public.translations_english (
    record_table, record_id, field_name, text, original_text, original_language_code,
    source, translation_status, translated_by_engine, corrected_by, corrected_at,
    created_at, updated_at, translated_at, deleted_at
  )
  values (
    p_record_table, p_record_id, p_field_name, v_english, coalesce(nullif(p_original_text, ''), ''),
    coalesce(nullif(p_original_language_code, ''), 'en'), v_source,
    coalesce(nullif(p_translation_status, ''), 'complete'),
    coalesce(nullif(p_translated_by_engine, ''), 'local_dictionary'),
    case when v_source = 'manual' then p_actor_id else null end,
    case when v_source = 'manual' then now() else null end,
    now(), now(), now(), null
  )
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set
    text = excluded.text,
    original_text = excluded.original_text,
    original_language_code = excluded.original_language_code,
    source = excluded.source,
    translation_status = excluded.translation_status,
    translated_by_engine = excluded.translated_by_engine,
    corrected_by = excluded.corrected_by,
    corrected_at = excluded.corrected_at,
    translated_at = now(),
    updated_at = now()
  returning id into v_id;

  insert into public.translations_urdu (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
  values (p_record_table, p_record_id, p_field_name, v_urdu, now(), now(), null)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_arabic (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
  values (p_record_table, p_record_id, p_field_name, v_arabic, now(), now(), null)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_persian (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
  values (p_record_table, p_record_id, p_field_name, v_persian, now(), now(), null)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_pashto (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
  values (p_record_table, p_record_id, p_field_name, v_pashto, now(), now(), null)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  return v_id;
end
$function$
;

-- write_erp_audit_log(p_action text, p_entity_table text, p_entity_id uuid, p_before jsonb, p_after jsonb, p_company_id uuid, p_ip_address text)
CREATE OR REPLACE FUNCTION public.write_erp_audit_log(p_action text, p_entity_table text, p_entity_id uuid DEFAULT NULL::uuid, p_before jsonb DEFAULT NULL::jsonb, p_after jsonb DEFAULT NULL::jsonb, p_company_id uuid DEFAULT NULL::uuid, p_ip_address text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  audit_id uuid;
begin
  insert into audit_logs (company_id, actor_id, action, entity_table, entity_id, before, after, ip_address)
  values (p_company_id, auth.uid(), p_action, p_entity_table, p_entity_id, p_before, p_after, p_ip_address)
  returning id into audit_id;

  return audit_id;
exception when others then
  -- Never let a pure audit-logging failure abort the caller's real business
  -- transaction (ledger post, roznamcha entry, account creation, etc.).
  return null;
end;
$function$
;

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261004_prod_reconcile_functions', 'applied')
ON CONFLICT (name) DO UPDATE SET status='applied', applied_at=NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
