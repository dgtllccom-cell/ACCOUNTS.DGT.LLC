alter table companies
  add column if not exists owner_name text,
  add column if not exists business_type text,
  add column if not exists country_id uuid,
  add column if not exists state_province_id uuid,
  add column if not exists district_id uuid,
  add column if not exists city_id uuid,
  add column if not exists area_location_id uuid,
  add column if not exists country_name text,
  add column if not exists state_name text,
  add column if not exists district_name text,
  add column if not exists city_name text,
  add column if not exists area_name text,
  add column if not exists zip_code text,
  add column if not exists address text,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists registrations jsonb not null default '[]'::jsonb,
  add column if not exists owner_ids jsonb not null default '[]'::jsonb;

create index if not exists companies_country_id_idx on companies(country_id) where deleted_at is null;
create index if not exists companies_city_id_idx on companies(city_id) where deleted_at is null;
create index if not exists companies_owner_name_idx on companies(owner_name) where deleted_at is null;

