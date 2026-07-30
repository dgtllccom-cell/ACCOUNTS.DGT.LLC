-- Warehouses master table + relationships/indexes, and repair of the two
-- dangling warehouse_id references (product_warehouse_mapping,
-- product_inventory_balances) that existed without a warehouses table.
-- Non-destructive and idempotent.

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  state_province_id uuid references states_provinces(id),
  district_id uuid references districts(id),
  city_id uuid references cities(id),
  area_id uuid references areas_locations(id),
  owner_name text,
  warehouse_code text,
  warehouse_name text not null,
  warehouse_type text,                       -- e.g. general / bonded / transit
  full_address text,
  contact_number text,                       -- JSON-encoded contact list (from WarehouseForm)
  status text not null default 'Active',
  description text,
  -- Centralized multilingual columns (migration 0078 contract). Added here
  -- because the table did not exist when 0078 ran.
  name_en text,
  name_ur text,
  name_ar text,
  name_fa text,
  name_ps text,
  original_language_code text not null default 'en' references languages(code),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One warehouse name per country (soft-delete aware)
create unique index if not exists warehouses_name_unique_idx
  on warehouses (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(warehouse_name))
  where deleted_at is null;

-- Unique code (case-insensitive) when provided
create unique index if not exists warehouses_code_unique_idx
  on warehouses (upper(warehouse_code))
  where deleted_at is null and warehouse_code is not null;

-- Scope lookups (country/branch)
create index if not exists warehouses_scope_idx
  on warehouses (country_id, state_province_id, city_id)
  where deleted_at is null;

comment on table warehouses is 'Central ERP master table. Use one row with name_en/name_ur/name_ar/name_fa/name_ps; do not create module-specific duplicate masters.';

-- Repair dangling FKs. NOT VALID => the constraint is enforced for new/updated
-- rows but existing rows are not re-checked (avoids failing on legacy orphan
-- warehouse_id values). Run VALIDATE CONSTRAINT later once data is clean.
do $$
begin
  if to_regclass('public.product_warehouse_mapping') is not null
     and not exists (select 1 from pg_constraint where conname = 'product_warehouse_mapping_warehouse_fk') then
    alter table public.product_warehouse_mapping
      add constraint product_warehouse_mapping_warehouse_fk
      foreign key (warehouse_id) references public.warehouses(id) on delete set null not valid;
  end if;

  if to_regclass('public.product_inventory_balances') is not null
     and not exists (select 1 from pg_constraint where conname = 'product_inventory_balances_warehouse_fk') then
    alter table public.product_inventory_balances
      add constraint product_inventory_balances_warehouse_fk
      foreign key (warehouse_id) references public.warehouses(id) on delete set null not valid;
  end if;
end $$;

-- RLS on (service-role admin client used by ERP APIs bypasses RLS; this keeps
-- direct anon/authenticated access closed by default, consistent with masters).
alter table warehouses enable row level security;

notify pgrst, 'reload schema';
