-- Enterprise ERP/FMS: multi-company and document branding foundation.
-- One parent business group can own unlimited country company profiles.

create table if not exists parent_business_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  logo_url text,
  brand_primary_color text,
  brand_secondary_color text,
  address text,
  contact_information jsonb not null default '{}'::jsonb,
  website text,
  email text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists parent_business_groups_default_idx
  on parent_business_groups (is_default)
  where is_default = true and deleted_at is null;

create unique index if not exists parent_business_groups_name_idx
  on parent_business_groups (lower(name))
  where deleted_at is null;

create table if not exists country_company_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_business_group_id uuid references parent_business_groups(id),
  country_id uuid not null references countries(id) on delete cascade,
  company_name text not null,
  legal_name text,
  company_logo_url text,
  company_address text,
  contact_information jsonb not null default '{}'::jsonb,
  registration_number text,
  tax_information jsonb not null default '{}'::jsonb,
  banking_information jsonb not null default '{}'::jsonb,
  email_information jsonb not null default '{}'::jsonb,
  website_information jsonb not null default '{}'::jsonb,
  base_currency text not null,
  document_header_template jsonb not null default '{}'::jsonb,
  document_footer_template jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint country_company_profiles_currency_chk check (char_length(base_currency) = 3)
);

create unique index if not exists country_company_profiles_country_active_idx
  on country_company_profiles (country_id)
  where is_active = true and deleted_at is null;

alter table countries
  add column if not exists parent_business_group_id uuid references parent_business_groups(id),
  add column if not exists default_company_profile_id uuid references country_company_profiles(id);

insert into parent_business_groups (name, legal_name, is_default, is_active)
values ('Damaan Business Group', 'Damaan Business Group', true, true)
on conflict do nothing;

insert into country_company_profiles (
  parent_business_group_id,
  country_id,
  company_name,
  legal_name,
  base_currency,
  is_active
)
select
  pbg.id,
  c.id,
  case
    when lower(c.name) like '%uae%' then 'Damaan UAE'
    else 'Damaan ' || c.name
  end,
  case
    when lower(c.name) like '%uae%' then 'Damaan UAE'
    else 'Damaan ' || c.name
  end,
  c.currency_code,
  true
from countries c
cross join lateral (
  select id from parent_business_groups
  where is_default = true and deleted_at is null
  limit 1
) pbg
where c.deleted_at is null
  and not exists (
    select 1 from country_company_profiles ccp
    where ccp.country_id = c.id
      and ccp.deleted_at is null
  );

update countries c
set parent_business_group_id = ccp.parent_business_group_id,
    default_company_profile_id = ccp.id,
    updated_at = now()
from country_company_profiles ccp
where ccp.country_id = c.id
  and ccp.is_active = true
  and ccp.deleted_at is null
  and (c.parent_business_group_id is null or c.default_company_profile_id is null);

insert into permissions (resource, action, description)
values
  ('business_groups', 'create', 'Create parent business group branding'),
  ('business_groups', 'read', 'View parent business group branding'),
  ('business_groups', 'update', 'Update parent business group branding'),
  ('country_company_profiles', 'create', 'Create country company profile and branding'),
  ('country_company_profiles', 'read', 'View country company profile and branding'),
  ('country_company_profiles', 'update', 'Update country company profile and branding')
on conflict (resource, action) do nothing;

alter table parent_business_groups enable row level security;
alter table country_company_profiles enable row level security;

create policy parent_business_groups_read_all
  on parent_business_groups for select
  using (is_active = true and deleted_at is null);

create policy parent_business_groups_super_admin_write
  on parent_business_groups for all
  using (is_super_admin())
  with check (is_super_admin());

create policy country_company_profiles_read_scope
  on country_company_profiles for select
  using (
    is_super_admin()
    or can_access_country(country_id)
  );

create policy country_company_profiles_super_admin_write
  on country_company_profiles for all
  using (is_super_admin())
  with check (is_super_admin());
