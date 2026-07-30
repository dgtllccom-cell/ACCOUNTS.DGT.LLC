-- Truck Registration master (Settings -> Truck Management).
-- One centralized truck master reused by all loading forms (truck_id FK).
-- Loading forms keep snapshot text columns to preserve historical values.
-- Attachments (photo, registration card, insurance, driver docs) reuse
-- erp_documents (entity_type = 'truck'). Idempotent.

create table if not exists trucks (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  truck_serial text,
  truck_number text not null,
  registration_number text,
  registration_country_id uuid references countries(id),
  truck_type text,
  make text,
  model text,
  manufacturing_year integer,
  color text,
  chassis_number text,
  engine_number text,
  capacity text,
  owner_name text,
  owner_mobile text,
  transport_company text,
  driver_name text,
  driver_mobile text,
  driver_cnic_passport text,
  registration_expiry_date date,
  insurance_expiry_date date,
  driver_docs_expiry_date date,
  status text not null default 'active'
    constraint trucks_status_chk check (status in ('active','inactive','suspended','expired')),
  notes text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists trucks_number_unique_idx
  on trucks (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(truck_number))
  where deleted_at is null;
create unique index if not exists trucks_serial_idx
  on trucks (lower(truck_serial))
  where deleted_at is null and truck_serial is not null;
create index if not exists trucks_scope_idx
  on trucks (country_id, country_branch_id, city_branch_id, status)
  where deleted_at is null;
create index if not exists trucks_expiry_idx
  on trucks (registration_expiry_date, insurance_expiry_date)
  where deleted_at is null;

alter table trucks enable row level security;
comment on table trucks is 'Central Truck Registration master. Reused by all loading forms via truck_id; do not duplicate truck records elsewhere.';

-- Link the three loading forms to the truck master (additive; snapshot columns stay).
do $$
begin
  if to_regclass('public.truck_loadings') is not null then
    alter table public.truck_loadings add column if not exists truck_id uuid references public.trucks(id);
    create index if not exists truck_loadings_truck_idx on public.truck_loadings (truck_id) where deleted_at is null;
  end if;
  if to_regclass('public.import_truck_loadings') is not null then
    alter table public.import_truck_loadings add column if not exists truck_id uuid references public.trucks(id);
    create index if not exists import_truck_loadings_truck_idx on public.import_truck_loadings (truck_id) where deleted_at is null;
  end if;
  if to_regclass('public.transit_truck_loadings') is not null then
    alter table public.transit_truck_loadings add column if not exists truck_id uuid references public.trucks(id);
    create index if not exists transit_truck_loadings_truck_idx on public.transit_truck_loadings (truck_id) where deleted_at is null;
  end if;
end $$;

notify pgrst, 'reload schema';
