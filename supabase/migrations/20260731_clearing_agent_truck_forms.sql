-- Clearing Agent — three truck-loading transactional forms.
-- Attachments reuse the existing erp_documents/attachments infrastructure
-- (entity_type = 'truck_loading' | 'import_truck_loading' | 'transit_truck_loading').
-- Country/branch scoped, soft-delete, audit columns. Idempotent.

-- 1) Truck Loading -----------------------------------------------------
create table if not exists truck_loadings (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  loading_date date not null default current_date,
  loading_serial text,
  truck_name text,
  truck_number text,
  driver_name text,
  driver_mobile_1 text,
  driver_mobile_2 text,
  cnic_passport text,
  truck_owner_name text,
  truck_owner_mobile text,
  vehicle_type text,
  goods_name text,
  quantity numeric(18, 4),
  unit text,
  net_weight numeric(18, 4),
  gross_weight numeric(18, 4),
  destination text,
  remarks text,
  status text not null default 'active',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists truck_loadings_serial_idx
  on truck_loadings (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(loading_serial))
  where deleted_at is null and loading_serial is not null;
create index if not exists truck_loadings_scope_idx
  on truck_loadings (country_id, country_branch_id, city_branch_id, loading_date)
  where deleted_at is null;
alter table truck_loadings enable row level security;

-- 2) Import Truck Loading ----------------------------------------------
create table if not exists import_truck_loadings (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  import_date date not null default current_date,
  import_bill_number text,
  import_serial text,
  importer_name text,
  supplier_name text,
  driver_name text,
  driver_mobile text,
  truck_number text,
  truck_type text,
  goods_name text,
  quantity numeric(18, 4),
  unit text,
  customs_office text,
  border_crossing text,
  country_of_origin text,
  destination_country text,
  clearing_agent text,
  remarks text,
  status text not null default 'active',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists import_truck_loadings_serial_idx
  on import_truck_loadings (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(import_serial))
  where deleted_at is null and import_serial is not null;
create index if not exists import_truck_loadings_scope_idx
  on import_truck_loadings (country_id, country_branch_id, city_branch_id, import_date)
  where deleted_at is null;
alter table import_truck_loadings enable row level security;

-- 3) Transit Truck Loading ---------------------------------------------
create table if not exists transit_truck_loadings (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  transit_date date not null default current_date,
  transit_serial text,
  transit_company text,
  truck_number text,
  driver_name text,
  driver_mobile text,
  goods_name text,
  quantity numeric(18, 4),
  unit text,
  transit_route text,
  border text,
  destination text,
  customs_information text,
  container_number text,
  seal_number text,
  remarks text,
  status text not null default 'active',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists transit_truck_loadings_serial_idx
  on transit_truck_loadings (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(transit_serial))
  where deleted_at is null and transit_serial is not null;
create index if not exists transit_truck_loadings_scope_idx
  on transit_truck_loadings (country_id, country_branch_id, city_branch_id, transit_date)
  where deleted_at is null;
alter table transit_truck_loadings enable row level security;

notify pgrst, 'reload schema';
