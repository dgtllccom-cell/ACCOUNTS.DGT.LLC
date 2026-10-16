-- Stock Journal integration (Purchase Booking / Local Purchase -> Loading -> Receiving & Customs -> Confirm Stock -> Sale / Export)
--
-- ADDITIVE ONLY. No data is rewritten, nothing is dropped.
--   1. journal_stock_transfers is the existing "stock confirmation" ledger. It was created by 20261015 but that migration was
--      never applied to Production, which made GET /api/erp/inventory/journal-stock fail on every call there (the real reason the
--      Stock Journal showed no Purchase Booking / Local Purchase stock). It is created here IF MISSING, then widened.
--   2. Confirmation lifecycle (confirmed -> issued | reversed), reservation flag, idempotency key, customer / sales-order /
--      document references, who + when for confirm / issue / reverse.
--   3. purchase_loading_records gets the receiving + customs facts the Stock Journal has to show (damage, shortage, customs).
-- Physical stock itself is NOT stored here: warehouse quantities keep living in product_inventory_balances + stock_movements
-- (written by the existing Destination Receiving route and by the confirm / issue service) — no parallel stock system.

CREATE TABLE IF NOT EXISTS public.journal_stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_no text NOT NULL UNIQUE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  local_purchase_id uuid REFERENCES public.local_purchases(id) ON DELETE SET NULL,
  loading_record_id uuid REFERENCES public.purchase_loading_records(id) ON DELETE SET NULL,
  source_stage text NOT NULL DEFAULT 'loading' CHECK (source_stage IN ('journal', 'loading')),
  destination_type text NOT NULL CHECK (destination_type IN ('warehouse', 'export', 'local_sales')),
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  goods_name text NOT NULL,
  goods_id uuid REFERENCES public.goods(id) ON DELETE SET NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'KG',
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_no text,
  remarks text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- destination: Warehouse Storage / Local Market ('local_sales') / Export / Direct Sale & Delivery
ALTER TABLE public.journal_stock_transfers DROP CONSTRAINT IF EXISTS journal_stock_transfers_destination_type_check;
ALTER TABLE public.journal_stock_transfers
  ADD CONSTRAINT journal_stock_transfers_destination_type_check
  CHECK (destination_type IN ('warehouse', 'export', 'local_sales', 'direct_sale'));

ALTER TABLE public.journal_stock_transfers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS line_key text,
  ADD COLUMN IF NOT EXISTS reserved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS sales_order_id uuid,
  ADD COLUMN IF NOT EXISTS sales_order_no text,
  ADD COLUMN IF NOT EXISTS document_ref text,
  ADD COLUMN IF NOT EXISTS source_warehouse_id uuid,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS confirm_stock_movement_id uuid,
  ADD COLUMN IF NOT EXISTS issue_type text,
  ADD COLUMN IF NOT EXISTS issue_ref text,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS issued_by uuid,
  ADD COLUMN IF NOT EXISTS issue_stock_movement_id uuid,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid,
  ADD COLUMN IF NOT EXISTS reverse_reason text;

ALTER TABLE public.journal_stock_transfers DROP CONSTRAINT IF EXISTS journal_stock_transfers_status_check;
ALTER TABLE public.journal_stock_transfers
  ADD CONSTRAINT journal_stock_transfers_status_check CHECK (status IN ('confirmed', 'issued', 'reversed'));

ALTER TABLE public.journal_stock_transfers DROP CONSTRAINT IF EXISTS journal_stock_transfers_issue_type_check;
ALTER TABLE public.journal_stock_transfers
  ADD CONSTRAINT journal_stock_transfers_issue_type_check
  CHECK (issue_type IS NULL OR issue_type IN ('goods_issue', 'dispatch', 'delivery'));

-- the same click / retry can never confirm twice
CREATE UNIQUE INDEX IF NOT EXISTS uq_jst_idempotency ON public.journal_stock_transfers(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jst_status ON public.journal_stock_transfers(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_sales_order ON public.journal_stock_transfers(sales_order_id) WHERE sales_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jst_purchase_order ON public.journal_stock_transfers(purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_local_purchase ON public.journal_stock_transfers(local_purchase_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_loading_record ON public.journal_stock_transfers(loading_record_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_warehouse ON public.journal_stock_transfers(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_destination ON public.journal_stock_transfers(destination_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jst_scope ON public.journal_stock_transfers(country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;

-- once issued / reversed the quantity facts of a confirmation are frozen; only the lifecycle columns may still change
CREATE OR REPLACE FUNCTION public.jst_guard_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('issued', 'reversed') AND (
       NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW.destination_type IS DISTINCT FROM OLD.destination_type
    OR NEW.warehouse_id IS DISTINCT FROM OLD.warehouse_id
    OR NEW.loading_record_id IS DISTINCT FROM OLD.loading_record_id
  ) THEN
    RAISE EXCEPTION 'A % stock confirmation can no longer be changed (%).', OLD.status, OLD.transfer_no;
  END IF;
  IF OLD.status = 'reversed' AND NEW.status IS DISTINCT FROM 'reversed' THEN
    RAISE EXCEPTION 'A reversed stock confirmation cannot be re-opened (%). Confirm the stock again instead.', OLD.transfer_no;
  END IF;
  IF OLD.status = 'issued' AND NEW.status = 'confirmed' THEN
    RAISE EXCEPTION 'An issued stock confirmation cannot go back to confirmed (%).', OLD.transfer_no;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jst_guard_update ON public.journal_stock_transfers;
CREATE TRIGGER trg_jst_guard_update BEFORE UPDATE ON public.journal_stock_transfers FOR EACH ROW EXECUTE FUNCTION public.jst_guard_update();

COMMENT ON TABLE public.journal_stock_transfers IS
  'Stock Journal confirmation ledger: one row per authorized allocation of received stock (warehouse / local market / export / direct sale). Physical quantities stay in product_inventory_balances + stock_movements; this row is the decision, its reservation and its issue/reversal. Never edited after issue/reversal.';

-- receiving + customs facts per loading record (container / truck)
ALTER TABLE public.purchase_loading_records
  ADD COLUMN IF NOT EXISTS damaged_quantity numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortage_quantity numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customs_status text,
  ADD COLUMN IF NOT EXISTS customs_reference text,
  ADD COLUMN IF NOT EXISTS customs_cleared_at timestamptz;

ALTER TABLE public.purchase_loading_records DROP CONSTRAINT IF EXISTS plr_customs_status_chk;
ALTER TABLE public.purchase_loading_records
  ADD CONSTRAINT plr_customs_status_chk CHECK (customs_status IS NULL OR customs_status IN ('pending', 'submitted', 'cleared', 'not_applicable'));

ALTER TABLE public.purchase_loading_records DROP CONSTRAINT IF EXISTS plr_receiving_total_chk;
ALTER TABLE public.purchase_loading_records
  ADD CONSTRAINT plr_receiving_total_chk
  CHECK (damaged_quantity >= 0 AND shortage_quantity >= 0
         AND COALESCE(received_quantity, 0) + damaged_quantity + shortage_quantity <= COALESCE(loaded_quantity, 0) + 0.0001);
