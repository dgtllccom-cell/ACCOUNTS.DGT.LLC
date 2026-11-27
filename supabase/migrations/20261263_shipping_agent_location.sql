-- Shipping agent office location from the shared Location Management master.
-- The table has no scope country; city_name / country_name stay as the report names.
-- Additive, nullable, no backfill (old rows keep their typed names and show them).
ALTER TABLE public.shipping_agent_entries
  ADD COLUMN IF NOT EXISTS address_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS state_province_id uuid REFERENCES public.states_provinces(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE RESTRICT;
