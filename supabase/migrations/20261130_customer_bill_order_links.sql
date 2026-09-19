-- Customer Bill multi-order links
--
-- This migration intentionally follows 20261128_clearing_customer_bills.sql so
-- the referenced bill table exists on a clean database install.
-- The legacy clearing_customer_bills.order_id remains the primary reference;
-- this normalized relation adds support for one bill covering multiple orders.

CREATE TABLE IF NOT EXISTS public.clearing_customer_bill_orders (
  bill_id uuid NOT NULL REFERENCES public.clearing_customer_bills(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.clearing_customer_orders(id) ON DELETE CASCADE,
  link_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bill_id, order_id)
);

CREATE INDEX IF NOT EXISTS clearing_customer_bill_orders_order_idx
  ON public.clearing_customer_bill_orders (order_id, bill_id);

ALTER TABLE public.clearing_customer_bill_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clearing_customer_bill_orders_all_policy
  ON public.clearing_customer_bill_orders;
CREATE POLICY clearing_customer_bill_orders_all_policy
  ON public.clearing_customer_bill_orders
  FOR ALL USING (true) WITH CHECK (true);

-- Backfill the legacy one-to-one reference exactly once. The conflict guard
-- makes this migration safe to rerun after a deployment retry.
INSERT INTO public.clearing_customer_bill_orders (bill_id, order_id, link_order)
SELECT id, order_id, 1
FROM public.clearing_customer_bills
WHERE deleted_at IS NULL
ON CONFLICT (bill_id, order_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS clearing_customer_bill_orders_bill_idx
  ON public.clearing_customer_bill_orders (bill_id, link_order);

NOTIFY pgrst, 'reload schema';
