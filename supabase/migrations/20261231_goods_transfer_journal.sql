-- Goods Transfer Journal: permanent Lot identity, lot-level stock states, transfers, movement history,
-- and Inter-Country Trade. Additive only. Financial posting (Roznamcha/Ledger) stays on the existing
-- Local Purchase transfer; this layer only decides where the purchased goods physically go.
--
-- Invariants enforced in the database (not only in code):
--   * a lot's stock rows always sum to the quantity purchased (deferred constraint trigger)
--   * no negative stock (CHECK)
--   * movement history is append-only
--   * one transfer per (lot, idempotency key); one source sale + one destination purchase per trade

CREATE SEQUENCE IF NOT EXISTS public.purchase_lot_seq;
CREATE SEQUENCE IF NOT EXISTS public.goods_transfer_seq;
CREATE SEQUENCE IF NOT EXISTS public.inter_country_trade_seq;

-- 1. One permanent identity per purchased line --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_ref text NOT NULL UNIQUE,
  local_purchase_id uuid NOT NULL REFERENCES public.local_purchases(id) ON DELETE RESTRICT,
  line_key text NOT NULL,
  goods_id uuid REFERENCES public.goods(id) ON DELETE RESTRICT,
  goods_name text NOT NULL,
  brand text,
  size text,
  origin text,
  lot_no text,
  unit_name text NOT NULL DEFAULT 'Bags',
  country_id uuid REFERENCES public.countries(id),
  country_branch_id uuid REFERENCES public.country_branches(id),
  city_branch_id uuid REFERENCES public.city_branches(id),
  qty_purchased numeric(18,4) NOT NULL CHECK (qty_purchased > 0),
  net_weight_kg numeric(18,4) NOT NULL DEFAULT 0,
  gross_weight_kg numeric(18,4) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  exchange_rate numeric(18,8) NOT NULL DEFAULT 1,
  local_currency text,
  original_cost numeric(18,4) NOT NULL DEFAULT 0,      -- line amount in purchase currency
  landed_cost numeric(18,4) NOT NULL DEFAULT 0,        -- original_cost + allocated charges
  unit_cost numeric(18,6) NOT NULL DEFAULT 0,          -- landed_cost / qty_purchased
  roznamcha_entry_id uuid,
  purchase_ledger_id uuid,
  payable_ledger_id uuid,
  source_lot_id uuid REFERENCES public.purchase_lots(id),       -- set on a destination-country lot
  inter_country_trade_id uuid,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (local_purchase_id, line_key)
);
CREATE INDEX IF NOT EXISTS idx_purchase_lots_purchase ON public.purchase_lots(local_purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lots_goods ON public.purchase_lots(goods_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lots_scope ON public.purchase_lots(country_id, country_branch_id, city_branch_id);

-- A lot's quantity never changes after creation (corrections are movements, not edits).
CREATE OR REPLACE FUNCTION public.purchase_lots_immutable_qty() RETURNS trigger AS $$
BEGIN
  IF NEW.qty_purchased IS DISTINCT FROM OLD.qty_purchased OR NEW.local_purchase_id IS DISTINCT FROM OLD.local_purchase_id
     OR NEW.line_key IS DISTINCT FROM OLD.line_key OR NEW.goods_id IS DISTINCT FROM OLD.goods_id THEN
    RAISE EXCEPTION 'A purchase lot identity (purchase, line, goods, quantity) is permanent and cannot be changed.';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_purchase_lots_immutable ON public.purchase_lots;
CREATE TRIGGER trg_purchase_lots_immutable BEFORE UPDATE ON public.purchase_lots
  FOR EACH ROW EXECUTE FUNCTION public.purchase_lots_immutable_qty();

-- 2. Lot stock by explicit state / place ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lot_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.purchase_lots(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('available','reserved','loading','in_transit','sold','exported')),
  warehouse_id uuid REFERENCES public.warehouses(id),
  location_label text NOT NULL DEFAULT '',
  rack_bin text NOT NULL DEFAULT '',
  qty numeric(18,4) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  reference_id uuid,                                   -- the sale / transfer holding this quantity
  slot_key text GENERATED ALWAYS AS (
    state || '|' || coalesce(warehouse_id::text, '-') || '|' || rack_bin || '|' || location_label || '|' || coalesce(reference_id::text, '-')
  ) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lot_id, slot_key)
);
CREATE INDEX IF NOT EXISTS idx_lot_stock_lot ON public.lot_stock(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_stock_wh ON public.lot_stock(warehouse_id) WHERE warehouse_id IS NOT NULL;

-- Conservation: at commit, every touched lot's stock rows sum to what was purchased.
CREATE OR REPLACE FUNCTION public.lot_stock_conservation() RETURNS trigger AS $$
DECLARE
  v_lot uuid := COALESCE(NEW.lot_id, OLD.lot_id);
  v_sum numeric;
  v_buy numeric;
BEGIN
  SELECT COALESCE(SUM(qty), 0) INTO v_sum FROM public.lot_stock WHERE lot_id = v_lot;
  SELECT qty_purchased INTO v_buy FROM public.purchase_lots WHERE id = v_lot;
  IF v_buy IS NOT NULL AND abs(v_sum - v_buy) > 0.0001 THEN
    RAISE EXCEPTION 'Lot stock out of balance: lot % holds % but % was purchased.', v_lot, v_sum, v_buy;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lot_stock_conservation ON public.lot_stock;
CREATE CONSTRAINT TRIGGER trg_lot_stock_conservation AFTER INSERT OR UPDATE OR DELETE ON public.lot_stock
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.lot_stock_conservation();

-- 3. The Goods Transfer Journal (one row per decision about where goods go) ----------------------
CREATE TABLE IF NOT EXISTS public.goods_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_no text NOT NULL UNIQUE,
  local_purchase_id uuid NOT NULL REFERENCES public.local_purchases(id) ON DELETE RESTRICT,
  lot_id uuid NOT NULL REFERENCES public.purchase_lots(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('own_warehouse','dgt_warehouse','third_party_warehouse','local_sale','export_customer','export_dgt_branch','hold')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft','confirmed','in_transit','received','completed','cancelled','returned')),
  qty numeric(18,4) NOT NULL CHECK (qty > 0),
  source_warehouse_id uuid REFERENCES public.warehouses(id),
  source_location_label text NOT NULL DEFAULT '',
  source_rack_bin text NOT NULL DEFAULT '',
  dest_warehouse_id uuid REFERENCES public.warehouses(id),
  dest_rack_bin text NOT NULL DEFAULT '',
  dest_country_id uuid REFERENCES public.countries(id),
  dest_country_branch_id uuid REFERENCES public.country_branches(id),
  dest_city_branch_id uuid REFERENCES public.city_branches(id),
  -- third-party custody (stock stays DGT-owned; the provider account is for expenses only)
  provider_account_id uuid,
  provider_name text,
  provider_address text,
  provider_city text,
  contract_ref text,
  storage_charge numeric(18,4),
  charge_currency text,
  transport jsonb NOT NULL DEFAULT '{}'::jsonb,
  sales_order_id uuid,
  inter_country_trade_id uuid,
  idempotency_key text NOT NULL,
  notes text,
  cancel_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (lot_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_goods_transfers_purchase ON public.goods_transfers(local_purchase_id);
CREATE INDEX IF NOT EXISTS idx_goods_transfers_lot ON public.goods_transfers(lot_id);
CREATE INDEX IF NOT EXISTS idx_goods_transfers_sales_order ON public.goods_transfers(sales_order_id) WHERE sales_order_id IS NOT NULL;

-- 4. Immutable movement history ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lot_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.purchase_lots(id) ON DELETE RESTRICT,
  transfer_id uuid REFERENCES public.goods_transfers(id),
  movement_type text NOT NULL,
  from_state text,
  to_state text,
  qty numeric(18,4) NOT NULL CHECK (qty > 0),
  from_warehouse_id uuid REFERENCES public.warehouses(id),
  to_warehouse_id uuid REFERENCES public.warehouses(id),
  from_rack_bin text,
  to_rack_bin text,
  reference_type text,
  reference_id uuid,
  reference_no text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lot_movements_lot ON public.lot_movements(lot_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lot_movements_transfer ON public.lot_movements(transfer_id);

CREATE OR REPLACE FUNCTION public.lot_movements_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Lot movement history is append-only. Reverse a movement with a cancel/return entry instead.';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lot_movements_append_only ON public.lot_movements;
CREATE TRIGGER trg_lot_movements_append_only BEFORE UPDATE OR DELETE ON public.lot_movements
  FOR EACH ROW EXECUTE FUNCTION public.lot_movements_append_only();

-- 5. Inter-Country Trade: one reference shared by the source Sale and the destination Purchase ----
CREATE TABLE IF NOT EXISTS public.inter_country_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_ref text NOT NULL UNIQUE,
  goods_transfer_id uuid REFERENCES public.goods_transfers(id),
  source_lot_id uuid NOT NULL REFERENCES public.purchase_lots(id),
  source_purchase_id uuid NOT NULL REFERENCES public.local_purchases(id),
  qty numeric(18,4) NOT NULL CHECK (qty > 0),
  source_country_id uuid REFERENCES public.countries(id),
  source_country_branch_id uuid REFERENCES public.country_branches(id),
  source_city_branch_id uuid REFERENCES public.city_branches(id),
  dest_country_id uuid NOT NULL REFERENCES public.countries(id),
  dest_country_branch_id uuid NOT NULL REFERENCES public.country_branches(id),
  dest_city_branch_id uuid REFERENCES public.city_branches(id),
  dest_branch_code text,
  dest_warehouse_id uuid REFERENCES public.warehouses(id),
  source_currency text NOT NULL,
  dest_currency text NOT NULL,
  approved_exchange_rate numeric(18,8) NOT NULL CHECK (approved_exchange_rate > 0),
  sale_unit_rate numeric(18,6) NOT NULL DEFAULT 0,
  sale_amount_source numeric(18,4) NOT NULL DEFAULT 0,   -- in source currency
  sale_amount_dest numeric(18,4) NOT NULL DEFAULT 0,     -- converted ONCE with the approved rate
  cost_amount_source numeric(18,4) NOT NULL DEFAULT 0,
  source_receivable_ledger_id uuid,                       -- inter-country account (source side)
  source_sales_ledger_id uuid,
  source_inventory_ledger_id uuid,
  source_cogs_ledger_id uuid,
  dest_inventory_ledger_id uuid,
  dest_payable_ledger_id uuid,                            -- intercompany payable (destination side)
  source_sales_order_id uuid,
  destination_purchase_id uuid,
  source_roznamcha_entry_id uuid,
  source_cost_roznamcha_entry_id uuid,
  dest_roznamcha_entry_id uuid,
  transport jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft','confirmed','in_transit','received','cancelled')),
  received_at timestamptz,
  received_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- one source sale / one destination purchase per trade, and one trade per source lot transfer
CREATE UNIQUE INDEX IF NOT EXISTS uq_ict_transfer ON public.inter_country_trades(goods_transfer_id) WHERE goods_transfer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ict_dest_purchase ON public.inter_country_trades(destination_purchase_id) WHERE destination_purchase_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ict_source_sale ON public.inter_country_trades(source_sales_order_id) WHERE source_sales_order_id IS NOT NULL;

ALTER TABLE public.purchase_lots ADD CONSTRAINT purchase_lots_trade_fk
  FOREIGN KEY (inter_country_trade_id) REFERENCES public.inter_country_trades(id) NOT VALID;
ALTER TABLE public.goods_transfers ADD CONSTRAINT goods_transfers_trade_fk
  FOREIGN KEY (inter_country_trade_id) REFERENCES public.inter_country_trades(id) NOT VALID;

-- A destination Purchase that came from a trade is never created by hand.
ALTER TABLE public.local_purchases
  ADD COLUMN IF NOT EXISTS inter_country_trade_id uuid,
  ADD COLUMN IF NOT EXISTS source_lot_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_local_purchases_trade ON public.local_purchases(inter_country_trade_id) WHERE inter_country_trade_id IS NOT NULL;

-- Read model: quantities per lot by state, plus where it is now.
CREATE OR REPLACE VIEW public.purchase_lot_balance_v AS
SELECT l.id AS lot_id,
       l.lot_ref,
       l.local_purchase_id,
       l.qty_purchased,
       COALESCE(SUM(s.qty) FILTER (WHERE s.state = 'available'), 0) AS qty_available,
       COALESCE(SUM(s.qty) FILTER (WHERE s.state = 'reserved'), 0) AS qty_reserved,
       COALESCE(SUM(s.qty) FILTER (WHERE s.state = 'loading'), 0) AS qty_loading,
       COALESCE(SUM(s.qty) FILTER (WHERE s.state = 'in_transit'), 0) AS qty_in_transit,
       COALESCE(SUM(s.qty) FILTER (WHERE s.state = 'sold'), 0) AS qty_sold,
       COALESCE(SUM(s.qty) FILTER (WHERE s.state = 'exported'), 0) AS qty_exported,
       COALESCE(SUM(s.qty), 0) AS qty_accounted
FROM public.purchase_lots l
LEFT JOIN public.lot_stock s ON s.lot_id = l.id
GROUP BY l.id;

ALTER TABLE public.purchase_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_country_trades ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.purchase_lots IS 'Permanent identity of one purchased line (purchase + line + goods + lot). Never recreated by Warehouse, Sales or Export.';
COMMENT ON TABLE public.lot_stock IS 'Where each lot quantity is, by explicit state. Always sums to purchase_lots.qty_purchased.';
COMMENT ON TABLE public.goods_transfers IS 'Goods Transfer Journal: one row per physical-destination decision. Separate from the financial purchase posting.';
COMMENT ON TABLE public.lot_movements IS 'Append-only movement history for a lot.';
COMMENT ON TABLE public.inter_country_trades IS 'One permanent reference shared by the source-country Sale and the destination-country Purchase.';
