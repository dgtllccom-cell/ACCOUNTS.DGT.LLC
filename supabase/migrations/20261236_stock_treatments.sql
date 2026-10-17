-- Stock Treatment Register (Stock Balance Report → Treatment Report)
--
-- ADDITIVE ONLY. The ERP had no goods-treatment workflow (only customs treatments). This is the minimal register the owner approved:
-- one row per treatment of a purchased lot entry. It is INFORMATION about stock that stays in its lot — it never creates, moves or
-- sells stock (so treated goods are never counted twice) and never posts accounting.
--   pending quantity = received for treatment − treated − loss
--   final quantity   = received for treatment − loss

CREATE TABLE IF NOT EXISTS public.stock_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_no text NOT NULL UNIQUE,
  bill_type text NOT NULL CHECK (bill_type IN ('booking', 'local')),
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  local_purchase_id uuid REFERENCES public.local_purchases(id) ON DELETE SET NULL,
  lot_no text NOT NULL,
  entry_key text NOT NULL,
  goods_name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  treatment_type text NOT NULL,
  treatment_date date NOT NULL DEFAULT CURRENT_DATE,
  qty_received numeric(18,4) NOT NULL CHECK (qty_received > 0),
  qty_treated numeric(18,4) NOT NULL DEFAULT 0 CHECK (qty_treated >= 0),
  qty_loss numeric(18,4) NOT NULL DEFAULT 0 CHECK (qty_loss >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  remarks text,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  idempotency_key text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT stock_treatments_one_bill CHECK ((purchase_order_id IS NOT NULL) <> (local_purchase_id IS NOT NULL)),
  CONSTRAINT stock_treatments_quantities CHECK (qty_treated + qty_loss <= qty_received + 0.0001)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_treatments_idem ON public.stock_treatments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_treatments_po ON public.stock_treatments(purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_treatments_lp ON public.stock_treatments(local_purchase_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_treatments_scope ON public.stock_treatments(country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.stock_treatments_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_stock_treatments_touch ON public.stock_treatments;
CREATE TRIGGER trg_stock_treatments_touch BEFORE UPDATE ON public.stock_treatments FOR EACH ROW EXECUTE FUNCTION public.stock_treatments_touch();

COMMENT ON TABLE public.stock_treatments IS
  'Treatment register for purchased lot entries (fumigation, cleaning, roasting, …). Information only: never creates / moves / sells stock and never posts accounting, so treated goods are not double-counted. Pending = received − treated − loss.';
