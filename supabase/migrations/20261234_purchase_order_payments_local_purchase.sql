-- Allow purchase_order_payments to link to either purchase_orders or local_purchases.
-- This integrates Local Purchase payments directly into the existing Daily Payments workflow
-- without duplicate payment modules, tables, or conflicting foreign keys.

ALTER TABLE public.purchase_order_payments
  ALTER COLUMN purchase_order_id DROP NOT NULL;

ALTER TABLE public.purchase_order_payments
  ADD COLUMN IF NOT EXISTS local_purchase_id uuid REFERENCES public.local_purchases(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_purchase_order_payments_local_purchase
  ON public.purchase_order_payments(local_purchase_id)
  WHERE local_purchase_id IS NOT NULL;
