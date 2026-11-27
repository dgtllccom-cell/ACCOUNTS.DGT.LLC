-- Keep the editable facility address separate from its display text and location IDs.
ALTER TABLE public.clearing_customer_order_loading_allocations
  ADD COLUMN IF NOT EXISTS facility_postal_code text,
  ADD COLUMN IF NOT EXISTS facility_address_detail text;
