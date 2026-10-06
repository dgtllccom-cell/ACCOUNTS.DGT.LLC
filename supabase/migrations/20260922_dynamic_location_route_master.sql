-- Dynamic Location & Route Management — Central Location Master + Route Templates.
-- Additive only: no existing table/column is renamed, dropped, or backfilled by
-- UPDATE. Extends the REAL, already-live multi-leg route system on
-- clearing_customer_order_legs (built in 20261120_shipping_customer_order_upgrade.sql,
-- extended by 20260912_shipping_order_multi_leg_organization.sql and
-- 20261126_shipping_clearing_pipeline.sql) rather than creating a second route/leg
-- model. Indexes and backfills the existing ports / warehouses / cities masters
-- rather than duplicating them.

-- ── erp_locations: central, typed location catalog ─────────────────────────────────
-- A thin index row per selectable location. Countries/states are intentionally NOT
-- bulk-backfilled here (the mode-based route rules never list them as selectable leg
-- endpoints — a leg's country is already from_country_id/to_country_id on the legs
-- table); a 'country'/'state' row can still be requested on demand via the same
-- approval flow if a future need appears.

create table if not exists public.erp_locations (
  id uuid primary key default gen_random_uuid(),

  location_type text not null check (location_type in (
    'seaport', 'airport', 'land_border', 'railway_terminal',
    'warehouse', 'cross_stuffing', 'city', 'state', 'country'
  )),
  name text not null,
  code text,

  country_id uuid not null references public.countries(id),
  state_province_id uuid references public.states_provinces(id),
  city_id uuid references public.cities(id),

  -- Ownership / permission scope. Null = global (usable across the ERP).
  country_branch_id uuid references public.country_branches(id),
  city_branch_id uuid references public.city_branches(id),

  -- Approval workflow — same status vocabulary as clearing_customer_orders.status
  -- (20261122_shipping_billing_receipts_approval.sql): pending_approval/approved-style
  -- states, here named to also cover deactivation without deleting history.
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'active', 'inactive', 'rejected')),
  requested_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejected_reason text,

  -- Historical mapping so old Country/Port values can be traced to the new master
  -- without altering the source rows.
  legacy_port_id uuid references public.ports(id),
  legacy_warehouse_id uuid references public.warehouses(id),

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Block duplicate free-text-style creation: one active/pending name per type+country.
-- A rejected request does not block re-requesting the same name.
create unique index if not exists erp_locations_no_duplicate_idx
  on public.erp_locations (location_type, country_id, lower(name))
  where deleted_at is null and status in ('pending_approval', 'active', 'inactive');

create index if not exists idx_erp_locations_type_country
  on public.erp_locations (location_type, country_id)
  where deleted_at is null;

create index if not exists idx_erp_locations_status
  on public.erp_locations (status)
  where deleted_at is null;

create index if not exists idx_erp_locations_legacy_port
  on public.erp_locations (legacy_port_id) where legacy_port_id is not null;

create index if not exists idx_erp_locations_legacy_warehouse
  on public.erp_locations (legacy_warehouse_id) where legacy_warehouse_id is not null;

comment on table public.erp_locations is
  'Central Location Master. Indexes the existing ports/warehouses/cities tables (legacy_port_id/legacy_warehouse_id) plus newly requested/approved locations. Does not replace ports or warehouses.';

alter table public.erp_locations enable row level security;

-- ── route_templates: reusable, ordered leg blueprints ───────────────────────────────
-- Blueprint only (from/to country+location, transport mode, clearance type per leg) —
-- actual-value fields (truck/vessel/customs specifics) stay on the real order leg,
-- filled in when a template is applied to an order.

create table if not exists public.route_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),

  country_branch_id uuid references public.country_branches(id),
  city_branch_id uuid references public.city_branches(id),

  legs jsonb not null default '[]'::jsonb,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_route_templates_status
  on public.route_templates (status) where deleted_at is null;

comment on table public.route_templates is
  'Reusable ordered-leg route blueprints (e.g. Tajikistan -> Afghanistan -> Pakistan -> Saudi Arabia). Applied client-side by seeding clearing_customer_order_legs from the blueprint; never a second leg/order model.';

alter table public.route_templates enable row level security;

-- ── clearing_customer_order_legs: additive enrichment only ──────────────────────────
-- The existing from_location_text/to_location_text/port_of_loading/port_of_discharge/
-- customs_point_text columns are untouched. New *_location_id columns are an optional
-- FK enrichment alongside them; historical legs with only free text remain valid.

alter table public.clearing_customer_order_legs
  add column if not exists from_location_id uuid references public.erp_locations(id),
  add column if not exists to_location_id uuid references public.erp_locations(id),
  add column if not exists customs_location_id uuid references public.erp_locations(id),
  add column if not exists route_template_id uuid references public.route_templates(id),

  -- By Air (transport_mode = 'by_air') — no dedicated fields existed before this.
  add column if not exists airline_name text,
  add column if not exists flight_number text,
  add column if not exists airway_bill_no text,

  -- By Train (transport_mode = 'by_rail') — no dedicated fields existed before this.
  add column if not exists railway_operator text,
  add column if not exists wagon_number text,
  add column if not exists rail_container_number text;

create index if not exists idx_clearing_customer_order_legs_from_location
  on public.clearing_customer_order_legs (from_location_id) where from_location_id is not null;

create index if not exists idx_clearing_customer_order_legs_to_location
  on public.clearing_customer_order_legs (to_location_id) where to_location_id is not null;

create index if not exists idx_clearing_customer_order_legs_route_template
  on public.clearing_customer_order_legs (route_template_id) where route_template_id is not null;

-- ── Backfill (insert-only — no source row is modified) ──────────────────────────────

insert into public.erp_locations
  (location_type, name, code, country_id, status, legacy_port_id, created_at, updated_at)
select
  case p.transport_type
    when 'sea' then 'seaport'
    when 'air' then 'airport'
    else 'land_border'
  end,
  p.port_name,
  p.port_code,
  p.country_id,
  'active',
  p.id,
  p.created_at,
  p.updated_at
from public.ports p
where p.deleted_at is null
  and p.is_active = true
  and p.country_id is not null
on conflict do nothing;

insert into public.erp_locations
  (location_type, name, code, country_id, state_province_id, city_id, status, legacy_warehouse_id, created_at, updated_at)
select
  'warehouse',
  w.warehouse_name,
  w.warehouse_code,
  w.country_id,
  w.state_province_id,
  w.city_id,
  'active',
  w.id,
  w.created_at,
  w.updated_at
from public.warehouses w
where w.deleted_at is null
  and w.is_active = true
  and w.country_id is not null
on conflict do nothing;

-- 'city' is a valid location_type (kept in the CHECK constraint above for schema
-- flexibility, e.g. a future on-demand request), but is deliberately NOT bulk-backfilled
-- here: the world `cities` table holds 600k+ rows (0064_world_location_master.sql), and
-- the existing GET /api/erp/locations/cities?countryId=...&q=... (locationsRepository,
-- already live) already serves exactly this data with search. The "By Road" mode picker
-- queries that existing endpoint directly for the City option instead of duplicating
-- 600k+ rows into this table.

notify pgrst, 'reload schema';
