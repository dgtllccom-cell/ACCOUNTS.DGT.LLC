-- 0042_location_master_population.sql
-- Adds code/postal/phone metadata required for automatic ERP location master population.

ALTER TABLE public.states_provinces
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS phone_area_code text;

ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS phone_area_code text;

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS phone_area_code text;

ALTER TABLE public.areas_locations
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS phone_area_code text;

CREATE INDEX IF NOT EXISTS states_provinces_country_code_idx
  ON public.states_provinces (country_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

CREATE INDEX IF NOT EXISTS districts_state_code_idx
  ON public.districts (state_province_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

CREATE INDEX IF NOT EXISTS cities_country_code_idx
  ON public.cities (country_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

CREATE INDEX IF NOT EXISTS areas_locations_city_code_idx
  ON public.areas_locations (city_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

INSERT INTO public.erp_schema_migrations (name, status, applied_at)
VALUES ('0042_location_master_population', 'applied', now())
ON CONFLICT (name) DO UPDATE
  SET status = excluded.status,
      applied_at = excluded.applied_at;

NOTIFY pgrst, 'reload schema';
