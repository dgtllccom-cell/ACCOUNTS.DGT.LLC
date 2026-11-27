-- Residential geography is separate from the Customer/Person Master's assigned country.
-- No backfill or permission changes. Legacy reads continue to use the original country.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT;
