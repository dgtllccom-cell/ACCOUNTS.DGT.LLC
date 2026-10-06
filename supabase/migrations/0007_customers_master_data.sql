-- Enterprise ERP/FMS: Centralized Customers Master Data
-- - One-time customer entry, reusable across modules
-- - Location references use centralized location tables (countries/states/cities/areas)
-- - Multilingual text is stored via record_translations (per field) when needed

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  state_province_id uuid references states_provinces(id),
  city_id uuid references cities(id),
  area_location_id uuid references areas_locations(id),
  customer_name text not null,
  company_name text,
  contact_person text,
  mobile text,
  whatsapp text,
  email text,
  address text,
  notes text,
  original_language_code text not null default 'en' references languages(code),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists customers_country_idx
  on customers (country_id)
  where deleted_at is null;

create index if not exists customers_email_idx
  on customers (lower(email))
  where email is not null and deleted_at is null;

create index if not exists customers_mobile_idx
  on customers (mobile)
  where mobile is not null and deleted_at is null;

create index if not exists customers_name_search_idx
  on customers (country_id, lower(customer_name))
  where deleted_at is null;

create index if not exists customers_company_search_idx
  on customers (country_id, lower(company_name))
  where company_name is not null and deleted_at is null;

create table if not exists customer_registrations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  registration_type text not null,
  registration_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists customer_registrations_customer_idx
  on customer_registrations (customer_id)
  where deleted_at is null;

create table if not exists customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  contact_type text not null,
  contact_value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists customer_contacts_customer_idx
  on customer_contacts (customer_id)
  where deleted_at is null;

create or replace function create_customer(
  p_country_id uuid,
  p_state_province_id uuid,
  p_city_id uuid,
  p_area_location_id uuid,
  p_customer_name text,
  p_company_name text,
  p_contact_person text,
  p_mobile text,
  p_whatsapp text,
  p_email text,
  p_address text,
  p_notes text,
  p_original_language_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

alter table customers enable row level security;
alter table customer_contacts enable row level security;
alter table customer_registrations enable row level security;

-- Read access: super admin, or users assigned to the customer's country.
create policy customers_scope_read on customers
  for select
  using (can_access_country(country_id));

create policy customer_contacts_scope_read on customer_contacts
  for select
  using (exists (
    select 1
    from customers c
    where c.id = customer_contacts.customer_id
      and c.deleted_at is null
      and can_access_country(c.country_id)
  ));

create policy customer_registrations_scope_read on customer_registrations
  for select
  using (exists (
    select 1
    from customers c
    where c.id = customer_registrations.customer_id
      and c.deleted_at is null
      and can_access_country(c.country_id)
  ));

