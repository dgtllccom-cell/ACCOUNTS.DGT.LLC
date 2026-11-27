-- Delivery / facility address of a customer-order loading allocation ("Other / third-party warehouse")
-- references the central Location Management Master (countries → states_provinces → cities), like every
-- other ERP address form. Additive and nullable: existing rows keep their free-text source_location_text,
-- which stays the display text. No branch, ownership, currency, ledger or stock column is touched.
ALTER TABLE public.clearing_customer_order_loading_allocations
  ADD COLUMN IF NOT EXISTS source_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_state_province_id uuid REFERENCES public.states_provinces(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_city_id uuid REFERENCES public.cities(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_postal_code text;
