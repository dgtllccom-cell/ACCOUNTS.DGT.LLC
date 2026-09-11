-- ============================================================================
-- MIGRATION: 20261124_shipping_transfers_order_link.sql
-- Link the EXISTING inter-country/inter-branch shipping expense transfer
-- workflow (shipping_expense_transfers, already fully built with an accept/
-- reject/return approval flow that posts through postRoznamchaWithErpSession
-- — see supabase/migrations/20260819_shipping_intercountry_transfer.sql and
-- lib/services/shipping-transfer-service.ts) to a specific Shipping Customer
-- Order, so a per-order Job Cost report can query claims directly instead of
-- an N-hop join through source_table/source_id. Additive only.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shipping_expense_transfers' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE public.shipping_expense_transfers
      ADD COLUMN order_id uuid REFERENCES public.clearing_customer_orders(id);
  END IF;

  CREATE INDEX IF NOT EXISTS shipping_expense_transfers_order_idx
    ON public.shipping_expense_transfers (order_id) WHERE deleted_at IS NULL;
END $$;
