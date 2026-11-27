-- Third-party warehouse placement location from the shared Location Management master.
-- provider_city / provider_address stay as the printed text. Stock quantities and the
-- Stock Journal are unchanged. Additive, nullable, no backfill.
ALTER TABLE public.goods_transfers
  ADD COLUMN IF NOT EXISTS provider_country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS provider_state_province_id uuid REFERENCES public.states_provinces(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS provider_city_id uuid REFERENCES public.cities(id) ON DELETE RESTRICT;
