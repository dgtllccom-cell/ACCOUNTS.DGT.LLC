-- =============================================================================
-- P/S General Transfer — All 4 Bill Types & Multi-Destination Routing
-- Migration: 20261031_ps_general_transfer_all_types.sql
--
-- After Loading, all four bill types pass through the central P/S General Transfer register:
--   1. Purchase Booking (purchase_booking)
--   2. Local Purchase (local_purchase)
--   3. Sales Booking (sales_booking)
--   4. Local Sales (local_sales)
--
-- Adds:
--   - check constraint expansion to include 'sales_booking' and 'local_sales'
--   - sales_order_id reference column
--   - remaining_quantity column (tracks physical quantity remaining on the bill)
--   - transfer_destination column (tracks workflow destination e.g. expenses, remaining payment, JC, PC, branch)
--
-- Non-destructive: preserves all existing data and accounting validation rules.
-- =============================================================================

BEGIN;

-- 1. Expand check constraint to support all 4 bill types
ALTER TABLE public.purchase_lane_loads
  DROP CONSTRAINT IF EXISTS purchase_lane_loads_source_type_check;

ALTER TABLE public.purchase_lane_loads
  ADD CONSTRAINT purchase_lane_loads_source_type_check
  CHECK (source_type IN ('purchase_booking', 'local_purchase', 'sales_booking', 'local_sales'));

-- 2. Add columns for sales orders, remaining quantity, and transfer destination
ALTER TABLE public.purchase_lane_loads
  ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remaining_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_destination text;

-- 3. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS purchase_lane_loads_sales_order_idx
  ON public.purchase_lane_loads (sales_order_id) WHERE deleted_at IS NULL AND sales_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_lane_loads_dest_idx
  ON public.purchase_lane_loads (transfer_destination) WHERE deleted_at IS NULL AND transfer_destination IS NOT NULL;

COMMIT;
