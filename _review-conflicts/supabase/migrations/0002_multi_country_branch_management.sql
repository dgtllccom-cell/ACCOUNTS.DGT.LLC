create type app_role as enum ('super_admin', 'country_admin', 'branch_admin', 'staff');
create type branch_status as enum ('active', 'inactive', 'closed');
create type transaction_status as enum ('draft', 'posted', 'cancelled');

create table countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  iso2 text,
  iso3 text,
  currency_code text not null,
  reporting_currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint countries_currency_chk check (char_length(currency_code) = 3),
  constraint countries_reporting_currency_chk check (reporting_currency = 'USD')
);

create unique index countries_name_idx on countries (lower(name)) where deleted_at is null;
create unique index countries_iso2_idx on countries (upper(iso2)) where iso2 is not null and deleted_at is null;
create unique index countries_iso3_idx on countries (upper(iso3)) where iso3 is not null and deleted_at is null;

create table country_branches (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  name text not null,
  code text not null,
  local_currency text not null,
  is_main boolean not null default true,
  status branch_status not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint country_branches_currency_chk check (char_length(local_currency) = 3),
  unique (id, country_id)
);

create unique index country_one_main_branch_idx
  on country_branches (country_id)
  where is_main = true and deleted_at is null;

create unique index country_branches_code_idx
  on country_branches (country_id, upper(code))
  where deleted_at is null;

create table city_branches (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  country_branch_id uuid not null,
  city_name text not null,
  name text not null,
  code text not null,
  local_currency text not null,
  status branch_status not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint city_branches_country_fk foreign key (country_branch_id, country_id)
    references country_branches(id, country_id),
  constraint city_branches_currency_chk check (char_length(local_currency) = 3)
);

create unique index city_branches_code_idx
  on city_branches (country_id, upper(code))
  where deleted_at is null;

create unique index city_branches_name_idx
  on city_branches (country_id, lower(city_name), lower(name))
  where deleted_at is null;

create table user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  role app_role not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint user_role_scope_chk check (
    (role = 'super_admin' and country_id is null and country_branch_id is null and city_branch_id is null)
    or (role = 'country_admin' and country_id is not null and city_branch_id is null)
    or (role = 'branch_admin' and country_id is not null and city_branch_id is not null)
    or (role = 'staff' and country_id is not null)
  )
);

create index user_role_assignments_user_idx on user_role_assignments (user_id, role)
  where is_active = true and deleted_at is null;

create table currency_rates (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  from_currency text not null,
  to_currency text not null default 'USD',
  rate numeric(18, 8) not null,
  effective_date date not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint currency_rates_positive_chk check (rate > 0),
  constraint currency_rates_to_usd_chk check (to_currency = 'USD')
);

create unique index currency_rates_day_idx
  on currency_rates (upper(from_currency), upper(to_currency), effective_date, coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;

create table transactions (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  city_branch_id uuid references city_branches(id),
  created_by uuid references profiles(id),
  transaction_no text not null,
  transaction_date date not null,
  description text,
  local_currency text not null,
  local_amount numeric(18, 4) not null,
  usd_rate numeric(18, 8) not null,
  usd_amount numeric(18, 4) generated always as (round(local_amount * usd_rate, 4)) stored,
  status transaction_status not null default 'draft',
  source_table text,
  source_id uuid,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_amount_chk check (local_amount >= 0 and usd_rate > 0)
);

create unique index transactions_country_no_idx
  on transactions (country_id, transaction_no)
  where deleted_at is null;

create index transactions_country_date_idx on transactions (country_id, transaction_date);
create index transactions_city_date_idx on transactions (city_branch_id, transaction_date);

create table reports (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  city_branch_id uuid references city_branches(id),
  report_type text not null,
  period_start date not null,
  period_end date not null,
  currency text not null default 'USD',
  totals jsonb not null default '{}'::jsonb,
  generated_by uuid references profiles(id),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reports_currency_usd_chk check (currency = 'USD'),
  constraint reports_period_chk check (period_end >= period_start)
);

create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.role = 'super_admin'
      and ura.is_active = true
      and ura.deleted_at is null
  );
$$;

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
        and ura.role in ('country_admin', 'branch_admin', 'staff')
        and ura.is_active = true
        and ura.deleted_at is null
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
          ura.role = 'country_admin'
          or (ura.role in ('branch_admin', 'staff') and ura.city_branch_id = target_city_branch_id)
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
        and ura.role = 'country_admin'
        and ura.is_active = true
        and ura.deleted_at is null
    );
$$;

create or replace function create_country(
  country_name text,
  country_iso2 text,
  country_iso3 text,
  country_currency_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function create_country_main_branch(
  target_country_id uuid,
  branch_name text,
  branch_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function create_city_branch(
  target_country_id uuid,
  target_country_branch_id uuid,
  city_name text,
  branch_name text,
  branch_code text,
  branch_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace view global_transaction_report_usd as
select
  c.id as country_id,
  c.name as country_name,
  date_trunc('month', t.transaction_date)::date as report_month,
  count(*) as transaction_count,
  sum(t.usd_amount) as total_usd_amount
from transactions t
join countries c on c.id = t.country_id
where t.status = 'posted'
  and t.deleted_at is null
  and c.deleted_at is null
group by c.id, c.name, date_trunc('month', t.transaction_date)::date;

insert into permissions (resource, action, description)
values
  ('countries', 'create', 'Create countries'),
  ('countries', 'read', 'View countries'),
  ('countries', 'update', 'Update countries'),
  ('country_branches', 'create', 'Create country main branches'),
  ('country_branches', 'read', 'View country main branches'),
  ('country_branches', 'update', 'Update country main branches'),
  ('city_branches', 'create', 'Create city branches'),
  ('city_branches', 'read', 'View city branches'),
  ('city_branches', 'update', 'Update city branches'),
  ('transactions', 'create', 'Create branch transactions'),
  ('transactions', 'read', 'View branch transactions'),
  ('transactions', 'post', 'Post branch transactions'),
  ('currency_rates', 'create', 'Create USD currency rates'),
  ('currency_rates', 'read', 'View USD currency rates'),
  ('reports', 'approve', 'Approve country reports')
on conflict (resource, action) do nothing;

alter table countries enable row level security;
alter table country_branches enable row level security;
alter table city_branches enable row level security;
alter table user_role_assignments enable row level security;
alter table currency_rates enable row level security;
alter table transactions enable row level security;
alter table reports enable row level security;

create policy countries_scope_read on countries
  for select using (is_super_admin() or can_access_country(id));

create policy countries_super_admin_write on countries
  for all using (is_super_admin())
  with check (is_super_admin());

create policy country_branches_scope_read on country_branches
  for select using (is_super_admin() or can_access_country(country_id));

create policy country_branches_super_admin_write on country_branches
  for all using (is_super_admin())
  with check (is_super_admin());

create policy city_branches_scope_read on city_branches
  for select using (is_super_admin() or can_access_country(country_id) or can_access_city_branch(id));

create policy city_branches_country_admin_write on city_branches
  for all using (can_manage_country(country_id))
  with check (can_manage_country(country_id));

create policy role_assignments_scope_read on user_role_assignments
  for select using (
    user_id = auth.uid()
    or is_super_admin()
    or (country_id is not null and can_manage_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy role_assignments_super_admin_write on user_role_assignments
  for all using (is_super_admin())
  with check (is_super_admin());

create policy currency_rates_scope_read on currency_rates
  for select using (is_super_admin() or country_id is null or can_access_country(country_id));

create policy currency_rates_admin_write on currency_rates
  for all using (is_super_admin() or (country_id is not null and can_manage_country(country_id)))
  with check (is_super_admin() or (country_id is not null and can_manage_country(country_id)));

create policy transactions_scope_read on transactions
  for select using (
    is_super_admin()
    or can_access_country(country_id)
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy transactions_branch_create on transactions
  for insert with check (
    is_super_admin()
    or can_manage_country(country_id)
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy reports_scope_read on reports
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );
