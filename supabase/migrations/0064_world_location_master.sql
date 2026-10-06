-- 0064_world_location_master.sql
-- Worldwide location master support for ERP cascading location dropdowns.

CREATE TABLE IF NOT EXISTS public.postal_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  state_province_id uuid REFERENCES public.states_provinces(id) ON DELETE SET NULL,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  country_code text NOT NULL,
  postal_code text NOT NULL,
  place_name text NOT NULL,
  admin1_name text,
  admin1_code text,
  admin2_name text,
  admin2_code text,
  admin3_name text,
  admin3_code text,
  latitude numeric,
  longitude numeric,
  accuracy text,
  source text NOT NULL DEFAULT 'geonames',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS postal_codes_unique_location_idx
  ON public.postal_codes (country_id, postal_code, lower(place_name), coalesce(admin1_code, ''), coalesce(admin2_code, ''), coalesce(admin3_code, ''))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS postal_codes_country_postal_idx
  ON public.postal_codes (country_id, postal_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS postal_codes_country_place_idx
  ON public.postal_codes (country_id, lower(place_name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS postal_codes_state_idx
  ON public.postal_codes (state_province_id)
  WHERE deleted_at IS NULL AND state_province_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS postal_codes_district_idx
  ON public.postal_codes (district_id)
  WHERE deleted_at IS NULL AND district_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS postal_codes_city_idx
  ON public.postal_codes (city_id)
  WHERE deleted_at IS NULL AND city_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS countries_active_name_idx
  ON public.countries (is_active, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS states_provinces_country_active_name_idx
  ON public.states_provinces (country_id, is_active, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS districts_state_active_name_idx
  ON public.districts (state_province_id, is_active, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS cities_district_active_name_idx
  ON public.cities (district_id, is_active, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS cities_country_state_district_lookup_idx
  ON public.cities (country_id, state_province_id, district_id)
  WHERE deleted_at IS NULL;

INSERT INTO public.erp_schema_migrations (name, status, applied_at)
VALUES ('0064_world_location_master', 'applied', now())
ON CONFLICT (name) DO UPDATE
  SET status = excluded.status,
      applied_at = excluded.applied_at;

NOTIFY pgrst, 'reload schema';
