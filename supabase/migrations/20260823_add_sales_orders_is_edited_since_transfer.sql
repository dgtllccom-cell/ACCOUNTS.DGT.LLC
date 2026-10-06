-- app/api/erp/sales/orders/[id]/transfer/route.ts (and features/sales/components/sales-transfer-erp-report-view.tsx)
-- select/reference sales_orders.is_edited_since_transfer, mirroring the same column that already
-- exists on purchase_orders. It was never added to sales_orders, so every call to the Sales
-- "transfer to payment" (booking) endpoint has been failing with
-- "column sales_orders.is_edited_since_transfer does not exist" — meaning no sales order could
-- ever be booked/transferred, which blocked every downstream sales payment screen (Advance,
-- Remaining, Credit, History) from ever having eligible data.
--
-- Purely additive: nullable boolean, defaults to false, matching purchase_orders' definition.

BEGIN;

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS is_edited_since_transfer boolean DEFAULT false;

COMMIT;
