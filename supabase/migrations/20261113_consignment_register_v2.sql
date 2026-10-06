-- ============================================================================
-- 20261113 — Consignment Stock & Sales Register — v2 fields
--
-- Additive & idempotent. Completes the register per the owner spec:
--   * head: Tender / Contract No, Loading Date From / To, Reference Value
--   * container: Reference Rate / Value, sales-fulfilment status (pending/partial/sold)
--   * expense: the owner's expense-type list (customs / cold_store / loading_unloading …)
--   * sale: link to the Customer master, carton qty, weight
--
-- Still TRACKING ONLY. Nothing here (and no trigger) posts to purchase_orders /
-- sales_orders / roznamcha_* / ledger_* / journal_*. "Transfer / Confirm to
-- Main ERP" flips `accounting_status` on explicit user action only.
-- ============================================================================

BEGIN;

-- ── head ────────────────────────────────────────────────────────────────────
ALTER TABLE public.consignment
  ADD COLUMN IF NOT EXISTS tender_no          text,
  ADD COLUMN IF NOT EXISTS loading_from_date  date,
  ADD COLUMN IF NOT EXISTS loading_to_date    date,
  ADD COLUMN IF NOT EXISTS reference_value    numeric;

-- ── container: reference rate/value + sales fulfilment status ────────────────
ALTER TABLE public.consignment_container
  ADD COLUMN IF NOT EXISTS reference_rate  numeric,
  ADD COLUMN IF NOT EXISTS reference_value numeric,
  ADD COLUMN IF NOT EXISTS sale_status     text NOT NULL DEFAULT 'pending';

DO $$ BEGIN
  ALTER TABLE public.consignment_container
    ADD CONSTRAINT consignment_container_sale_status_check
    CHECK (sale_status IN ('pending','partial','sold'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── expense: align the type list with the owner spec (keep old values too) ───
ALTER TABLE public.consignment_expense
  DROP CONSTRAINT IF EXISTS consignment_expense_expense_type_check;
ALTER TABLE public.consignment_expense
  ADD CONSTRAINT consignment_expense_expense_type_check
  CHECK (expense_type IN (
    -- owner spec
    'customs','commission','cold_store','transport','loading_unloading','other',
    -- pre-existing values kept for existing rows
    'freight','clearing','labour','storage','duty'
  ));

-- ── sale: Customer-master link + carton qty + weight ────────────────────────
ALTER TABLE public.consignment_sale
  ADD COLUMN IF NOT EXISTS buyer_customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS cartons           numeric,
  ADD COLUMN IF NOT EXISTS net_weight        numeric;

CREATE INDEX IF NOT EXISTS idx_cnt_sale_buyer
  ON public.consignment_sale (buyer_customer_id) WHERE deleted_at IS NULL;

-- ── keep container.sale_status in step with sold vs received qty ────────────
-- Received qty for a container = Σ its goods-line quantity.
-- Sold qty for a container     = Σ consignment_sale.quantity linked to it.
-- (Container-less sales don't move any single container's status.)
CREATE OR REPLACE FUNCTION public.consignment_recalc_container_sale_status(p_container_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_received numeric := 0;
  v_sold     numeric := 0;
  v_status   text;
BEGIN
  IF p_container_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(quantity),0) INTO v_received
    FROM public.consignment_container_good
    WHERE container_id = p_container_id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(quantity),0) INTO v_sold
    FROM public.consignment_sale
    WHERE container_id = p_container_id AND deleted_at IS NULL;
  IF v_sold <= 0 THEN
    v_status := 'pending';
  ELSIF v_received > 0 AND v_sold >= v_received THEN
    v_status := 'sold';
  ELSE
    v_status := 'partial';
  END IF;
  UPDATE public.consignment_container
    SET sale_status = v_status
    WHERE id = p_container_id AND sale_status IS DISTINCT FROM v_status;
END; $$;

CREATE OR REPLACE FUNCTION public.consignment_sale_status_trg() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.consignment_recalc_container_sale_status(OLD.container_id);
    RETURN OLD;
  END IF;
  PERFORM public.consignment_recalc_container_sale_status(NEW.container_id);
  IF TG_OP = 'UPDATE' AND OLD.container_id IS DISTINCT FROM NEW.container_id THEN
    PERFORM public.consignment_recalc_container_sale_status(OLD.container_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cnt_sale_status ON public.consignment_sale;
CREATE TRIGGER trg_cnt_sale_status
  AFTER INSERT OR UPDATE OR DELETE ON public.consignment_sale
  FOR EACH ROW EXECUTE FUNCTION public.consignment_sale_status_trg();

DROP TRIGGER IF EXISTS trg_cnt_good_sale_status ON public.consignment_container_good;
CREATE TRIGGER trg_cnt_good_sale_status
  AFTER INSERT OR UPDATE OR DELETE ON public.consignment_container_good
  FOR EACH ROW EXECUTE FUNCTION public.consignment_sale_status_trg();

-- backfill existing containers
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.consignment_container WHERE deleted_at IS NULL LOOP
    PERFORM public.consignment_recalc_container_sale_status(r.id);
  END LOOP;
END $$;

COMMIT;
