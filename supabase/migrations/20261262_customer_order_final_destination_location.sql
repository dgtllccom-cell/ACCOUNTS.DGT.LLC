-- Customer-order Final Destination from the shared Location Management master.
-- The text columns from 20261243 stay as the report/print names; these ids link the
-- address to the master. The order's own country_id / branch columns (scope) are untouched.
-- Additive, nullable, no backfill.
ALTER TABLE public.clearing_customer_orders
  ADD COLUMN IF NOT EXISTS final_destination_country_id uuid,
  ADD COLUMN IF NOT EXISTS final_destination_country_name text,
  ADD COLUMN IF NOT EXISTS final_destination_state text,
  ADD COLUMN IF NOT EXISTS final_destination_city text,
  ADD COLUMN IF NOT EXISTS final_destination_address text,
  ADD COLUMN IF NOT EXISTS final_destination_state_province_id uuid REFERENCES public.state_provinces(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS final_destination_district_id uuid REFERENCES public.districts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS final_destination_city_id uuid REFERENCES public.cities(id) ON DELETE RESTRICT;
