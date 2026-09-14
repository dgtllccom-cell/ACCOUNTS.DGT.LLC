-- Phase 2: Shipping / Clearing pipeline integration — ADDITIVE ONLY.
--
-- Reuses the existing clearing_customer_orders / clearing_customer_order_legs
-- model (the real Customer Order + per-leg truck/customs/shipping-line data
-- already built) and the Phase 1 canonical Transfer & Handover Center
-- (inter_country_transfers, widened in 20261125_transfer_handover_center.sql).
-- Nothing here creates a second Customer Order, a second handover table, or a
-- second task system:
--   - Truck-task assignment reuses the EXISTING user_tasks work-order engine
--     (clearing_customer_order_legs.current_task_id already pointed at it —
--     this migration does not touch that column, only adds a place to record
--     which handoff is currently open for a leg).
--   - Cross-branch/cross-country handoff reuses the EXISTING
--     inter_country_transfers table via a new nullable link column —
--     business_shipping_handovers (a DIFFERENT, narrower mechanism: the
--     Business -> Shipping domain-crossing control, see
--     lib/services/business-shipping-handover-service.ts) is untouched.
--   - Goods Verification is a genuinely new operational step with no existing
--     home; it gets one small additive table, an audit trail alongside the
--     order's original booked values (never overwriting them).

alter table public.clearing_customer_order_legs
  add column if not exists stage text not null default 'booking',
  add column if not exists transfer_center_id uuid references public.inter_country_transfers(id),
  add column if not exists stage_updated_at timestamptz not null default now();

alter table public.clearing_customer_order_legs
  drop constraint if exists clearing_customer_order_legs_stage_check;
alter table public.clearing_customer_order_legs
  add constraint clearing_customer_order_legs_stage_check
  check (stage in (
    'booking', 'truck_assignment', 'goods_verification', 'loading',
    'customs_clearing', 'shipment_bl', 'handover', 'destination_review',
    'completed'
  ));

create index if not exists clearing_customer_order_legs_stage_idx
  on public.clearing_customer_order_legs (stage, order_id)
  where deleted_at is null;

create index if not exists clearing_customer_order_legs_transfer_center_idx
  on public.clearing_customer_order_legs (transfer_center_id)
  where deleted_at is null and transfer_center_id is not null;

-- Order-level mirror of "where is this shipment right now" for list/dashboard
-- display without joining every leg. Updated by the workflow service whenever
-- the active leg's stage changes; the per-leg stage remains authoritative.
alter table public.clearing_customer_orders
  add column if not exists current_stage text not null default 'booking',
  add column if not exists current_leg_id uuid references public.clearing_customer_order_legs(id);

alter table public.clearing_customer_orders
  drop constraint if exists clearing_customer_orders_current_stage_check;
alter table public.clearing_customer_orders
  add constraint clearing_customer_orders_current_stage_check
  check (current_stage in (
    'booking', 'truck_assignment', 'goods_verification', 'loading',
    'customs_clearing', 'shipment_bl', 'handover', 'destination_review',
    'completed'
  ));

create index if not exists clearing_customer_orders_current_stage_idx
  on public.clearing_customer_orders (current_stage)
  where deleted_at is null;

-- Goods Verification — compares actual received/loaded goods against the
-- order's originally booked quantity/weight/cartons. A discrepancy is
-- recorded here; the original booked values on clearing_customer_orders are
-- NEVER overwritten by this step (full audit trail, not a silent correction).
create table if not exists public.clearing_customer_order_goods_verifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.clearing_customer_orders(id),
  leg_id uuid references public.clearing_customer_order_legs(id),

  booked_quantity numeric,
  booked_unit text,
  booked_cartons integer,
  booked_gross_weight numeric,
  booked_net_weight numeric,

  verified_quantity numeric,
  verified_unit text,
  verified_cartons integer,
  verified_gross_weight numeric,
  verified_net_weight numeric,

  warehouse_id uuid references public.warehouses(id),
  loading_source_text text,
  supporting_document text,

  result text not null default 'pending' check (result in ('pending', 'verified', 'discrepancy', 'returned')),
  discrepancy_notes text,

  verified_by uuid references public.profiles(id),
  verified_at timestamptz,

  country_id uuid references public.countries(id),
  country_branch_id uuid references public.country_branches(id),
  city_branch_id uuid references public.city_branches(id),

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ccogv_order_idx
  on public.clearing_customer_order_goods_verifications (order_id, created_at desc)
  where deleted_at is null;
create index if not exists ccogv_leg_idx
  on public.clearing_customer_order_goods_verifications (leg_id)
  where deleted_at is null and leg_id is not null;

alter table public.clearing_customer_order_goods_verifications enable row level security;
drop policy if exists ccogv_read on public.clearing_customer_order_goods_verifications;
create policy ccogv_read on public.clearing_customer_order_goods_verifications for select using (true);
drop policy if exists ccogv_write on public.clearing_customer_order_goods_verifications;
create policy ccogv_write on public.clearing_customer_order_goods_verifications for all using (true);

comment on table public.clearing_customer_order_goods_verifications is
  'Phase 2 Goods Verification: actual vs booked comparison per order/leg, with a discrepancy audit trail. Never overwrites the order''s original booked values.';
comment on column public.clearing_customer_order_legs.transfer_center_id is
  'The currently-open Transfer & Handover Center row (inter_country_transfers) for this leg, if a cross-branch/country handoff is in progress. Distinct from handover_id (business_shipping_handovers), which records the Business->Shipping domain-crossing lineage, not workflow handoffs.';
