-- Sub-phase B: local_purchases had free-text warehouse_name/supplier_name snapshot columns
-- only, with no FK back to the Warehouse/Person masters. The UI already lets the user pick a
-- real warehouse (features/purchases/components/local-purchase-view.tsx selectedWarehouseId)
-- but never persists the id — this closes that gap and adds a supplier FK for parity.
ALTER TABLE public.local_purchases
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
