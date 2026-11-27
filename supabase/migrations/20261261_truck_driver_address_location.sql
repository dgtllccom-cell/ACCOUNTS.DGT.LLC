-- Temporary driver's physical address from the shared Location Management master.
-- trucks.country_id / country_branch_id / city_branch_id keep controlling scope; these columns
-- only record where the driver lives. Additive, nullable, no backfill (the old free-text
-- driver country/state/city were never saved, so there is nothing to migrate).
ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS driver_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS driver_state_province_id uuid REFERENCES public.states_provinces(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS driver_district_id uuid REFERENCES public.districts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS driver_city_id uuid REFERENCES public.cities(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS driver_address text;
