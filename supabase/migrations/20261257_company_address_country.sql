-- Registered address independently references Location Management.
-- Existing country_id continues to control operational scope, not registered addresses.
-- Keep legacy rows untouched; the application can display their historical country.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS address_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT;
