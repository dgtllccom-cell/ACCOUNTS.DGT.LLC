-- ============================================================================
-- 20261029 — country_tax_settings
--
-- Backing table for Settings → Tax Rate Management (Country Tax Management).
-- `app/api/erp/tax/route.ts` has always read/written `public.country_tax_settings`
-- but no migration ever created it, so GET fell back to hard-coded presets and
-- POST silently "saved in session state" (nothing persisted). This is the real
-- store; the route's fake-save fallback is removed alongside this migration.
--
-- One row per (country, tax code). Country-scoped like every other module — a
-- Country Admin only manages their own country's rows (enforced in the API by
-- resolveReportScope / enforceScopeFilters; RLS below is a second gate).
--
-- Additive & idempotent. No existing table/data touched.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.country_tax_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id   uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,

  tax_name     text NOT NULL,
  tax_code     text NOT NULL,
  tax_rate     numeric(6,3) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  trn_number   text,
  applies_to   text NOT NULL DEFAULT 'both'
                 CHECK (applies_to IN ('purchase','sales','both','expense')),
  is_default   boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,

  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- one tax code per country (upsert target for the API)
CREATE UNIQUE INDEX IF NOT EXISTS country_tax_settings_country_code_uidx
  ON public.country_tax_settings (country_id, lower(tax_code));

CREATE INDEX IF NOT EXISTS country_tax_settings_country_idx
  ON public.country_tax_settings (country_id);

-- at most one default per country
CREATE UNIQUE INDEX IF NOT EXISTS country_tax_settings_one_default_uidx
  ON public.country_tax_settings (country_id)
  WHERE is_default;

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION public.country_tax_settings_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_country_tax_settings_touch ON public.country_tax_settings;
CREATE TRIGGER trg_country_tax_settings_touch
  BEFORE UPDATE ON public.country_tax_settings
  FOR EACH ROW EXECUTE FUNCTION public.country_tax_settings_touch_updated_at();

ALTER TABLE public.country_tax_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS country_tax_settings_read ON public.country_tax_settings;
CREATE POLICY country_tax_settings_read
  ON public.country_tax_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS country_tax_settings_write ON public.country_tax_settings;
CREATE POLICY country_tax_settings_write
  ON public.country_tax_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
