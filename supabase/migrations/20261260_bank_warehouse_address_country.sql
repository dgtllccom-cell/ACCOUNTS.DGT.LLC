-- Physical address country is separate from the assigned (access-scope) country.
-- banks.country_id / warehouses.country_id keep controlling scope, permissions and
-- numbering; address_country_id only records where the bank branch / facility is.
-- Additive, nullable, no backfill: legacy rows keep reading country_id as before.
ALTER TABLE public.banks
  ADD COLUMN IF NOT EXISTS address_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT;
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS address_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT;
