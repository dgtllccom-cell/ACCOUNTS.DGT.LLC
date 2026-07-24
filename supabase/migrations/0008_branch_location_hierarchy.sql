-- Enterprise ERP/FMS: Branch location alignment (foundation)
-- Store centralized location references on branches so forms don't duplicate location text.

alter table country_branches
  add column if not exists state_province_id uuid references states_provinces(id),
  add column if not exists city_id uuid references cities(id),
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text;

create index if not exists country_branches_state_idx
  on country_branches (state_province_id)
  where deleted_at is null;

create index if not exists country_branches_city_idx
  on country_branches (city_id)
  where deleted_at is null;

alter table city_branches
  add column if not exists state_province_id uuid references states_provinces(id),
  add column if not exists city_id uuid references cities(id),
  add column if not exists area_location_id uuid references areas_locations(id),
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text;

create index if not exists city_branches_state_idx
  on city_branches (state_province_id)
  where deleted_at is null;

create index if not exists city_branches_city_idx
  on city_branches (city_id)
  where deleted_at is null;

create index if not exists city_branches_area_idx
  on city_branches (area_location_id)
  where deleted_at is null;

