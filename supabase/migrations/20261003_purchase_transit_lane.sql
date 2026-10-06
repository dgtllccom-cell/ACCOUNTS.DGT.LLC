-- =============================================================================
-- Purchase Transit & Lane
-- Migration: 20261003_purchase_transit_lane.sql
--
-- After a Purchase Booking / Local Purchase is LOADED, each load (container) enters the General Purchase Lane:
--   Loaded -> In Transit -> Arrived -> Transfer Pending -> Assigned -> Customs Pending -> Under Clearance
--   -> Customs Cleared -> Final Disposition Pending -> Completed
-- One row per physical load (unique per source record, so a load can never be duplicated or double-counted).
-- Every move is an audit event. Expenses stay linked Purchase -> Loading -> BL -> Container -> Lane -> Agent/Branch.
--
-- Non-destructive: 3 new tables + nullable operational columns on purchase_loading_records.
-- Nothing here posts to the ledger, creates revenue or touches stock by itself.
-- DEV first; Production DDL needs the owner's approval.
-- =============================================================================

BEGIN;

-- ── operational (cargo) fields on the loading record — NOT financial ──────────────────────────
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS bl_number      text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS gross_weight   numeric;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS tare_weight    numeric;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS net_weight     numeric;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS seal_number    text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS vessel_name    text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS voyage_no      text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS awb_number     text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS flight_details text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS rail_reference text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS origin_text    text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS destination_text text;
ALTER TABLE public.purchase_loading_records ADD COLUMN IF NOT EXISTS lot_name       text;
CREATE INDEX IF NOT EXISTS purchase_loading_records_bl_idx
  ON public.purchase_loading_records (bl_number) WHERE deleted_at IS NULL AND bl_number IS NOT NULL;

-- ── the lane: one row per physical load ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_lane_loads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type         text NOT NULL CHECK (source_type IN ('purchase_booking','local_purchase')),
  source_id           uuid NOT NULL,                       -- purchase_loading_records.id | local_purchases.id
  purchase_order_id   uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  local_purchase_id   uuid,
  purchase_ref_no     text,                                -- Purchase Booking no. / Local Purchase bill no.
  loading_record_no   text,
  supplier_name       text,
  goods_name          text,
  goods_id            uuid,
  bl_number           text,
  container_number    text,
  container_type      text,
  loaded_quantity     numeric NOT NULL DEFAULT 0,
  unit                text,
  gross_weight        numeric,
  tare_weight         numeric,
  net_weight          numeric,
  origin_text         text,
  destination_text    text,
  transport_mode      text,

  lane_status         text NOT NULL DEFAULT 'loaded'
                        CHECK (lane_status IN ('loaded','in_transit','arrived','transfer_pending','assigned',
                                               'customs_pending','under_clearance','customs_cleared',
                                               'final_disposition_pending','completed')),
  current_location    text,
  expected_location   text,
  leg_no              int NOT NULL DEFAULT 1,

  -- who holds the load now
  owner_type          text NOT NULL DEFAULT 'branch'
                        CHECK (owner_type IN ('branch','internal_agent','external_agent','user','self')),
  owner_country_id        uuid,
  owner_country_branch_id uuid,
  owner_city_branch_id    uuid,
  owner_agent_id      uuid,
  owner_agent_name    text,
  owner_user_id       uuid,
  owner_user_name     text,
  responsibility      text,

  -- stock in the lane (reduced exactly once, when a final disposition is confirmed)
  lane_stock_qty      numeric NOT NULL DEFAULT 0,

  -- final disposition
  disposition         text CHECK (disposition IN ('re_export','warehouse','sale_delivery','continue_transit','hold')),
  disposition_final   boolean NOT NULL DEFAULT false,      -- true for re_export / warehouse / sale_delivery
  disposition_at      timestamptz,
  disposition_by      uuid,
  disposition_warehouse_id uuid,
  disposition_note    text,
  stock_movement_id   uuid,

  -- origin scope = the loading record's own scope
  country_id          uuid,
  country_branch_id   uuid,
  city_branch_id      uuid,

  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- THE duplicate guard: a loading record / local purchase can have exactly one live lane row.
CREATE UNIQUE INDEX IF NOT EXISTS purchase_lane_loads_source_uidx
  ON public.purchase_lane_loads (source_type, source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS purchase_lane_loads_status_idx
  ON public.purchase_lane_loads (lane_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS purchase_lane_loads_po_idx
  ON public.purchase_lane_loads (purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS purchase_lane_loads_scope_idx
  ON public.purchase_lane_loads (country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS purchase_lane_loads_owner_idx
  ON public.purchase_lane_loads (owner_country_id, owner_country_branch_id, owner_city_branch_id) WHERE deleted_at IS NULL;

-- ── audit trail: every move is an event ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_lane_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_load_id   uuid NOT NULL REFERENCES public.purchase_lane_loads(id) ON DELETE CASCADE,
  purchase_order_id uuid,
  event_type     text NOT NULL,        -- loaded | status_changed | transferred | accepted | disposition | expense_* | completed | ...
  from_status    text,
  to_status      text,
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id       uuid,
  actor_name     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_lane_events_load_idx ON public.purchase_lane_events (lane_load_id, created_at DESC);

-- ── lane expenses: transport / port / customs / clearing / detention / handling / other ───────
CREATE TABLE IF NOT EXISTS public.purchase_lane_expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_load_id   uuid NOT NULL REFERENCES public.purchase_lane_loads(id) ON DELETE CASCADE,
  purchase_order_id uuid,
  source_type    text NOT NULL,
  source_id      uuid NOT NULL,
  bl_number      text,
  container_number text,
  expense_type   text NOT NULL CHECK (expense_type IN ('transport','port','customs','clearing','detention','handling','other')),
  description    text,
  amount         numeric NOT NULL CHECK (amount >= 0),
  currency       text NOT NULL,
  payee_type     text NOT NULL CHECK (payee_type IN ('external_agent','internal_branch','internal_agent','other')),
  payee_agent_id uuid,
  payee_name     text,
  payee_country_branch_id uuid,
  payee_city_branch_id    uuid,
  -- internal branch -> inter-branch settlement (NOT a sale); agent -> payable bill line, only after confirmation
  settlement     text NOT NULL CHECK (settlement IN ('inter_branch','agent_payable','none')),
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','confirmed','cancelled')),
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  confirmed_by   uuid,
  confirmed_at   timestamptz,
  bill_expense_line_id uuid,           -- set only for agent_payable, only after confirmation (unposted line in the Bill Expenses register)
  bill_expense_id      uuid,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX IF NOT EXISTS purchase_lane_expenses_load_idx ON public.purchase_lane_expenses (lane_load_id) WHERE deleted_at IS NULL;
-- the same expense can be confirmed into the register only once
CREATE UNIQUE INDEX IF NOT EXISTS purchase_lane_expenses_line_uidx
  ON public.purchase_lane_expenses (bill_expense_line_id) WHERE bill_expense_line_id IS NOT NULL;

-- Loading supports trains (rail reference) as a fourth transport mode.
ALTER TABLE public.purchase_loading_records DROP CONSTRAINT IF EXISTS purchase_loading_records_transport_mode_check;
ALTER TABLE public.purchase_loading_records
  ADD CONSTRAINT purchase_loading_records_transport_mode_check CHECK (transport_mode IS NULL OR transport_mode IN ('By Road', 'By Sea', 'By Air', 'By Rail'));

-- Server-side access only (service role), same convention as purchase_loading_records: RLS on, no client policies.
ALTER TABLE public.purchase_lane_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_lane_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_lane_expenses ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.purchase_lane_loads IS
  'General Purchase Lane: one row per physical load/container. Moving a load between lanes/branches/agents never creates stock, revenue or a second purchase record.';

COMMIT;
