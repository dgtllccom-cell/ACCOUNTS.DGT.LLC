-- Upgrade the EXISTING Shipping Customer Order (clearing_customer_orders) form:
-- RBAC scope columns, 4-level serials, load type, location granularity, pickup-source
-- detail, shipment-level goods quantity/weight, and a new multi-country route-leg
-- table (clearing_customer_order_legs) carrying per-leg transport/vessel/customs data.
-- Additive only — no existing column is renamed or dropped.

-- ── clearing_customer_orders: scope, serials, and new descriptive columns ──────────

alter table public.clearing_customer_orders
  add column if not exists country_id uuid references public.countries(id),
  add column if not exists country_branch_id uuid references public.country_branches(id),
  add column if not exists city_branch_id uuid references public.city_branches(id),
  add column if not exists clearing_agent_id uuid references public.clearing_agents(id),
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists super_admin_serial text,
  add column if not exists country_serial text,
  add column if not exists branch_serial text,
  add column if not exists entry_serial text,
  add column if not exists load_type text check (load_type in ('full_truck','partial_load','container_haulage')),
  add column if not exists loading_state_province_id uuid references public.states_provinces(id),
  add column if not exists loading_district_id uuid references public.districts(id),
  add column if not exists loading_city_id uuid references public.cities(id),
  add column if not exists loading_area_id uuid references public.areas_locations(id),
  add column if not exists receiving_state_province_id uuid references public.states_provinces(id),
  add column if not exists receiving_district_id uuid references public.districts(id),
  add column if not exists receiving_city_id uuid references public.cities(id),
  add column if not exists receiving_area_id uuid references public.areas_locations(id),
  add column if not exists loading_source_warehouse_id uuid references public.warehouses(id),
  add column if not exists loading_source_container_ref text,
  add column if not exists goods_quantity numeric,
  add column if not exists goods_unit text,
  add column if not exists goods_bags_cartons integer,
  add column if not exists goods_gross_weight numeric,
  add column if not exists goods_empty_weight numeric,
  add column if not exists goods_net_weight numeric;

create index if not exists idx_clearing_customer_orders_scope
  on public.clearing_customer_orders (country_id, country_branch_id, city_branch_id)
  where deleted_at is null;

create index if not exists idx_clearing_customer_orders_clearing_agent
  on public.clearing_customer_orders (clearing_agent_id)
  where deleted_at is null;

create index if not exists idx_clearing_customer_orders_created_by
  on public.clearing_customer_orders (created_by)
  where deleted_at is null;

-- Data hygiene: the old form emitted two overlapping transport-mode values for the
-- same real-world mode ("by_road" and "by_truck"); the redesigned UI only offers
-- by_sea/by_road/by_air/by_rail, so fold the legacy value into by_road.
update public.clearing_customer_orders set transport_mode = 'by_road' where transport_mode = 'by_truck';

-- ── clearing_customer_order_legs: one row per route leg (multi-country routing) ────

create table if not exists public.clearing_customer_order_legs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.clearing_customer_orders(id) on delete cascade,
  leg_no integer not null default 1,

  from_country_id uuid references public.countries(id),
  from_country_name text,
  to_country_id uuid references public.countries(id),
  to_country_name text,
  from_location_text text,
  to_location_text text,

  transport_mode text check (transport_mode in ('by_sea','by_road','by_air','by_rail')),

  responsible_country_branch_id uuid references public.country_branches(id),
  responsible_city_branch_id uuid references public.city_branches(id),
  responsible_clearing_agent_id uuid references public.clearing_agents(id),

  -- road leg
  truck_id uuid references public.trucks(id),
  truck_registration_type text check (truck_registration_type in ('registered','temporary')),
  truck_number text,
  truck_driver_name text,
  truck_driver_mobile text,

  -- sea leg — reuses the existing Shipping Line master; does not fork the B/L workflow
  shipping_line_id uuid references public.shipping_lines(id),
  vessel_name text,
  voyage_number text,
  container_number text,
  seal_number text,
  bl_number text,
  port_of_loading text,
  port_of_discharge text,
  etd timestamptz,
  eta timestamptz,

  -- customs — kept per-leg because clearance happens at a specific border/port
  customs_country_id uuid references public.countries(id),
  customs_point_text text,
  customs_clearing_agent_id uuid references public.clearing_agents(id),
  clearance_type text check (clearance_type in ('import','export','transit')),
  duty_treatment text check (duty_treatment in ('duty_payable','no_duty_exempt','transit_bonded','pending')),
  duty_amount numeric,
  duty_currency text,
  duty_payer text,
  customs_receipt_ref text,
  customs_clearance_date timestamptz,

  planned_departure timestamptz,
  actual_departure timestamptz,
  planned_arrival timestamptz,
  actual_arrival timestamptz,
  status text not null default 'pending' check (status in
    ('pending','pickup_assigned','loaded','in_transit','arrived','customs_pending','cleared','handed_over','completed')),
  handover_id uuid references public.business_shipping_handovers(id),

  remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_clearing_customer_order_legs_order
  on public.clearing_customer_order_legs (order_id, leg_no)
  where deleted_at is null;

create index if not exists idx_clearing_customer_order_legs_handover
  on public.clearing_customer_order_legs (handover_id)
  where deleted_at is null;

-- ── optional connective FKs: let the existing standalone customs/BL screens link
--    an entry back to the order/leg that generated it, without forking their workflows

alter table public.clearing_agent_custom_entries
  add column if not exists order_id uuid references public.clearing_customer_orders(id),
  add column if not exists leg_id uuid references public.clearing_customer_order_legs(id);

alter table public.clearing_payment_bills
  add column if not exists order_id uuid references public.clearing_customer_orders(id),
  add column if not exists leg_id uuid references public.clearing_customer_order_legs(id);

alter table public.shipping_bl_records
  add column if not exists order_id uuid references public.clearing_customer_orders(id),
  add column if not exists leg_id uuid references public.clearing_customer_order_legs(id);

alter table public.shipping_line_records
  add column if not exists order_id uuid references public.clearing_customer_orders(id),
  add column if not exists leg_id uuid references public.clearing_customer_order_legs(id);

-- ── register new free-text columns for the 5-language translation engine ──────────

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('clearing_customer_orders', 'remarks', 'translate'),
  ('clearing_customer_order_legs', 'from_location_text', 'transliterate'),
  ('clearing_customer_order_legs', 'to_location_text', 'transliterate'),
  ('clearing_customer_order_legs', 'customs_point_text', 'transliterate'),
  ('clearing_customer_order_legs', 'duty_payer', 'transliterate'),
  ('clearing_customer_order_legs', 'remarks', 'translate'),
  ('clearing_customer_order_legs', 'from_country_name', 'transliterate'),
  ('clearing_customer_order_legs', 'to_country_name', 'transliterate')
on conflict (table_name, field_name) do nothing;

select public.attach_translation_triggers();
