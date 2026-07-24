-- 0038_location_districts.sql
-- 1. Alter countries to add phone_code
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS phone_code text;

-- 2. Create districts table
CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  state_province_id uuid NOT NULL REFERENCES public.states_provinces(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Index and policy for districts
CREATE UNIQUE INDEX IF NOT EXISTS districts_state_name_idx
  ON public.districts (state_province_id, lower(name))
  WHERE deleted_at IS NULL;

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS districts_scope_read ON public.districts;
CREATE POLICY districts_scope_read ON public.districts
  FOR SELECT USING (is_super_admin() OR can_access_country(country_id));

DROP POLICY IF EXISTS districts_admin_write ON public.districts;
CREATE POLICY districts_admin_write ON public.districts
  FOR ALL USING (is_super_admin() OR can_manage_country(country_id))
  WITH CHECK (is_super_admin() OR can_manage_country(country_id));

-- 3. Add district_id columns
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.areas_locations ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.city_branches ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.country_branches ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.banks ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS cities_country_state_name_idx;
CREATE UNIQUE INDEX IF NOT EXISTS cities_country_state_district_name_idx
  ON public.cities (country_id, coalesce(state_province_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(district_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE deleted_at IS NULL;

-- 4. Enable RLS and trigger schema reload notification
NOTIFY pgrst, 'reload schema';
