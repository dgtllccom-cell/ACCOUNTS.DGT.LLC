-- Delivery / facility location (customer premises or third-party facility) from the shared
-- Location Management master, per loading allocation. source_location_text stays the printed
-- address line. No scope column is touched. Additive, nullable, no backfill.
ALTER TABLE public.clearing_customer_order_loading_allocations
  ADD COLUMN IF NOT EXISTS facility_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS facility_state_province_id uuid REFERENCES public.states_provinces(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS facility_city_id uuid REFERENCES public.cities(id) ON DELETE RESTRICT;
