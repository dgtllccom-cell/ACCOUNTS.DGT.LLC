-- ====================================================================================
-- Migration: 20261013_central_route_location_hierarchy.sql
-- Description: Central Route & Location Master Hierarchy (5 tiers):
--   1. Country Master (countries + allowed branches + 5 languages)
--   2. Location Master (erp_locations: Sea Port, Border, Airport, Rail, Warehouse, Free Zone, Inland Depot)
--   3. Gate / Terminal Master (erp_location_terminals under each location)
--   4. Customs Office & Treatment (erp_customs_treatments under country/location/gate)
--   5. Route Leg Rules & Enrichments on clearing_customer_order_legs
-- Additive only, strictly non-destructive.
-- ====================================================================================

-- 1. Extend erp_locations check constraint to support 'free_zone' and 'inland_depot'
do $$
begin
  alter table public.erp_locations drop constraint if exists erp_locations_location_type_check;
  alter table public.erp_locations add constraint erp_locations_location_type_check check (
    location_type in (
      'seaport', 'airport', 'land_border', 'railway_terminal',
      'warehouse', 'cross_stuffing', 'city', 'state', 'country',
      'free_zone', 'inland_depot'
    )
  );
exception when others then
  null;
end $$;

-- 2. Create Gate / Terminal Master table (erp_location_terminals)
create table if not exists public.erp_location_terminals (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.erp_locations(id) on delete cascade,
  name text not null,
  code text,
  terminal_type text not null default 'gate' check (
    terminal_type in ('gate', 'terminal', 'berth', 'platform', 'depot_gate', 'other')
  ),
  status text not null default 'active' check (status in ('active', 'inactive')),
  description text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Unique index to prevent duplicates per location
create unique index if not exists idx_erp_location_terminals_unique_name
  on public.erp_location_terminals (location_id, lower(name))
  where deleted_at is null;

create unique index if not exists idx_erp_location_terminals_unique_code
  on public.erp_location_terminals (location_id, lower(code))
  where deleted_at is null and code is not null;

create index if not exists idx_erp_location_terminals_loc_status
  on public.erp_location_terminals (location_id, status)
  where deleted_at is null;

comment on table public.erp_location_terminals is
  'Gate and Terminal Master under each erp_location (e.g. Spin Boldak–Chaman Gate, Jebel Ali Terminal 1, Gate 4).';

alter table public.erp_location_terminals enable row level security;

-- 3. Create Customs Office / Treatment Master table (erp_customs_treatments)
create table if not exists public.erp_customs_treatments (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id),
  location_id uuid references public.erp_locations(id) on delete set null,
  gate_id uuid references public.erp_location_terminals(id) on delete set null,
  office_name text not null,
  office_code text,
  allowed_movements text[] not null default array['import', 'export', 'transit', 're_export']::text[],
  allowed_treatments text[] not null default array['import_duty_paid', 'export_clearance', 'transit_bonded', 're_export', 'free_zone', 'local_clearance', 'no_duty_exempt']::text[],
  status text not null default 'active' check (status in ('active', 'inactive')),
  description text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists idx_erp_customs_treatments_unique
  on public.erp_customs_treatments (country_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(office_name))
  where deleted_at is null;

create index if not exists idx_erp_customs_treatments_country_loc
  on public.erp_customs_treatments (country_id, location_id, status)
  where deleted_at is null;

comment on table public.erp_customs_treatments is
  'Customs Office and Treatment Master under country/location/gate (Import, Export, Transit, Re-export, Free Zone, Local Clearance, No Duty).';

alter table public.erp_customs_treatments enable row level security;

-- 4. Additive enrichment on clearing_customer_order_legs
alter table public.clearing_customer_order_legs
  add column if not exists from_gate_id uuid references public.erp_location_terminals(id),
  add column if not exists to_gate_id uuid references public.erp_location_terminals(id),
  add column if not exists customs_office_id uuid references public.erp_customs_treatments(id),
  add column if not exists customs_treatment text;

create index if not exists idx_clearing_customer_order_legs_from_gate
  on public.clearing_customer_order_legs (from_gate_id) where from_gate_id is not null;

create index if not exists idx_clearing_customer_order_legs_to_gate
  on public.clearing_customer_order_legs (to_gate_id) where to_gate_id is not null;

create index if not exists idx_clearing_customer_order_legs_customs_office
  on public.clearing_customer_order_legs (customs_office_id) where customs_office_id is not null;

-- 5. Seed initial standard Gates and Customs Stations for foundational locations
-- Chaman / Spin Boldak Border (PK)
do $$
declare
  v_loc_chm uuid;
  v_loc_spb uuid;
  v_loc_trk_pk uuid;
  v_loc_wgh_pk uuid;
  v_loc_jea uuid;
  v_loc_khi uuid;
  v_c_pk uuid;
  v_c_af uuid;
  v_c_ae uuid;
  v_gate_chm uuid;
  v_gate_spb uuid;
  v_gate_jea1 uuid;
  v_gate_jea4 uuid;
begin
  select id into v_c_pk from public.countries where iso2 = 'PK' limit 1;
  select id into v_c_af from public.countries where iso2 = 'AF' limit 1;
  select id into v_c_ae from public.countries where iso2 = 'AE' limit 1;

  select id into v_loc_chm from public.erp_locations where name ilike '%Chaman%Spin%' and location_type = 'land_border' limit 1;
  select id into v_loc_spb from public.erp_locations where name ilike '%Spin Boldak%' and location_type = 'land_border' limit 1;
  select id into v_loc_trk_pk from public.erp_locations where name ilike '%Torkham Border Terminal%' and location_type = 'land_border' limit 1;
  select id into v_loc_wgh_pk from public.erp_locations where name ilike '%Wagah%Attari%' and location_type = 'land_border' limit 1;
  select id into v_loc_jea from public.erp_locations where name ilike '%Jebel Ali Port%' and location_type = 'seaport' limit 1;
  select id into v_loc_khi from public.erp_locations where name ilike '%Karachi Port%' and location_type = 'seaport' limit 1;

  -- Chaman Gates
  if v_loc_chm is not null then
    insert into public.erp_location_terminals (location_id, name, code, terminal_type, status)
    values
      (v_loc_chm, 'Spin Boldak–Chaman Gate', 'PK-CHM-G1', 'gate', 'active'),
      (v_loc_chm, 'Friendship Gate Terminal', 'PK-CHM-T1', 'terminal', 'active')
    on conflict (location_id, lower(name)) where deleted_at is null do nothing;

    select id into v_gate_chm from public.erp_location_terminals where location_id = v_loc_chm and lower(name) = 'spin boldak–chaman gate' limit 1;

    if v_c_pk is not null then
      insert into public.erp_customs_treatments (country_id, location_id, gate_id, office_name, office_code, allowed_movements, allowed_treatments, status)
      values
        (v_c_pk, v_loc_chm, v_gate_chm, 'Chaman Customs Station (Collectorate of Customs Appraisement)', 'PK-CHM-CUST',
         array['import', 'export', 'transit', 're_export']::text[],
         array['import_duty_paid', 'export_clearance', 'transit_bonded', 're_export', 'no_duty_exempt']::text[],
         'active')
      on conflict (country_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(office_name)) where deleted_at is null do nothing;
    end if;
  end if;

  -- Spin Boldak Gates (AF)
  if v_loc_spb is not null then
    insert into public.erp_location_terminals (location_id, name, code, terminal_type, status)
    values
      (v_loc_spb, 'Spin Boldak Commercial Crossing Gate', 'AF-SPB-G1', 'gate', 'active'),
      (v_loc_spb, 'Spin Boldak Truck Holding Yard', 'AF-SPB-Y1', 'depot_gate', 'active')
    on conflict (location_id, lower(name)) where deleted_at is null do nothing;

    select id into v_gate_spb from public.erp_location_terminals where location_id = v_loc_spb and lower(name) = 'spin boldak commercial crossing gate' limit 1;

    if v_c_af is not null then
      insert into public.erp_customs_treatments (country_id, location_id, gate_id, office_name, office_code, allowed_movements, allowed_treatments, status)
      values
        (v_c_af, v_loc_spb, v_gate_spb, 'Spin Boldak Gumruk / Customs House', 'AF-SPB-CUST',
         array['import', 'export', 'transit', 're_export']::text[],
         array['import_duty_paid', 'transit_bonded', 'local_clearance', 'no_duty_exempt']::text[],
         'active')
      on conflict (country_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(office_name)) where deleted_at is null do nothing;
    end if;
  end if;

  -- Torkham Gates
  if v_loc_trk_pk is not null then
    insert into public.erp_location_terminals (location_id, name, code, terminal_type, status)
    values
      (v_loc_trk_pk, 'Torkham Zero Line Gate', 'PK-TRK-G1', 'gate', 'active'),
      (v_loc_trk_pk, 'Torkham NLC Freight Terminal', 'PK-TRK-T1', 'terminal', 'active')
    on conflict (location_id, lower(name)) where deleted_at is null do nothing;

    if v_c_pk is not null then
      insert into public.erp_customs_treatments (country_id, location_id, office_name, office_code, allowed_movements, allowed_treatments, status)
      values
        (v_c_pk, v_loc_trk_pk, 'Torkham Customs House (Collectorate of Customs Appraisement)', 'PK-TRK-CUST',
         array['import', 'export', 'transit', 're_export']::text[],
         array['import_duty_paid', 'export_clearance', 'transit_bonded', 're_export', 'no_duty_exempt']::text[],
         'active')
      on conflict (country_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(office_name)) where deleted_at is null do nothing;
    end if;
  end if;

  -- Wagah Gates
  if v_loc_wgh_pk is not null then
    insert into public.erp_location_terminals (location_id, name, code, terminal_type, status)
    values
      (v_loc_wgh_pk, 'Wagah Border Cargo Gate', 'PK-WGH-G1', 'gate', 'active'),
      (v_loc_wgh_pk, 'Wagah Railway Platform Terminal', 'PK-WGH-R1', 'platform', 'active')
    on conflict (location_id, lower(name)) where deleted_at is null do nothing;

    if v_c_pk is not null then
      insert into public.erp_customs_treatments (country_id, location_id, office_name, office_code, allowed_movements, allowed_treatments, status)
      values
        (v_c_pk, v_loc_wgh_pk, 'Wagah Land Customs Station (Lahore)', 'PK-WGH-CUST',
         array['import', 'export', 'transit', 're_export']::text[],
         array['import_duty_paid', 'export_clearance', 'transit_bonded', 're_export', 'no_duty_exempt']::text[],
         'active')
      on conflict (country_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(office_name)) where deleted_at is null do nothing;
    end if;
  end if;

  -- Jebel Ali Gates & Terminals
  if v_loc_jea is not null then
    insert into public.erp_location_terminals (location_id, name, code, terminal_type, status)
    values
      (v_loc_jea, 'DP World Container Terminal 1 (T1)', 'AE-JEA-T1', 'terminal', 'active'),
      (v_loc_jea, 'DP World Container Terminal 2 (T2)', 'AE-JEA-T2', 'terminal', 'active'),
      (v_loc_jea, 'DP World Container Terminal 3 (T3)', 'AE-JEA-T3', 'terminal', 'active'),
      (v_loc_jea, 'JAFZA Gate 4 (Commercial Cargo)', 'AE-JEA-G4', 'gate', 'active'),
      (v_loc_jea, 'JAFZA Gate 7 (Free Zone Transit)', 'AE-JEA-G7', 'gate', 'active')
    on conflict (location_id, lower(name)) where deleted_at is null do nothing;

    select id into v_gate_jea1 from public.erp_location_terminals where location_id = v_loc_jea and lower(name) = 'dp world container terminal 1 (t1)' limit 1;
    select id into v_gate_jea4 from public.erp_location_terminals where location_id = v_loc_jea and lower(name) = 'jafza gate 4 (commercial cargo)' limit 1;

    if v_c_ae is not null then
      insert into public.erp_customs_treatments (country_id, location_id, gate_id, office_name, office_code, allowed_movements, allowed_treatments, status)
      values
        (v_c_ae, v_loc_jea, v_gate_jea1, 'Dubai Customs - Jebel Ali Port Clearance Center', 'AE-JEA-CUST',
         array['import', 'export', 'transit', 're_export']::text[],
         array['import_duty_paid', 'export_clearance', 'transit_bonded', 're_export', 'local_clearance', 'no_duty_exempt']::text[],
         'active'),
        (v_c_ae, v_loc_jea, v_gate_jea4, 'Dubai Customs - JAFZA Free Zone Customs Center', 'AE-JAFZA-CUST',
         array['import', 'export', 'transit', 're_export']::text[],
         array['free_zone', 'transit_bonded', 're_export', 'local_clearance', 'no_duty_exempt']::text[],
         'active')
      on conflict (country_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(office_name)) where deleted_at is null do nothing;
    end if;
  end if;

  -- Karachi Port
  if v_loc_khi is not null then
    insert into public.erp_location_terminals (location_id, name, code, terminal_type, status)
    values
      (v_loc_khi, 'Karachi International Container Terminal (KICT)', 'PK-KPT-KICT', 'terminal', 'active'),
      (v_loc_khi, 'South Asia Pakistan Terminals (SAPT)', 'PK-KPT-SAPT', 'terminal', 'active'),
      (v_loc_khi, 'East Wharf Gate 1', 'PK-KPT-EW1', 'gate', 'active')
    on conflict (location_id, lower(name)) where deleted_at is null do nothing;

    if v_c_pk is not null then
      insert into public.erp_customs_treatments (country_id, location_id, office_name, office_code, allowed_movements, allowed_treatments, status)
      values
        (v_c_pk, v_loc_khi, 'Custom House Karachi (Appraisement East / West)', 'PK-KHI-CUST',
         array['import', 'export', 'transit', 're_export']::text[],
         array['import_duty_paid', 'export_clearance', 'transit_bonded', 're_export', 'local_clearance', 'no_duty_exempt']::text[],
         'active')
      on conflict (country_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(office_name)) where deleted_at is null do nothing;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
