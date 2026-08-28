-- =============================================================================
-- Goods Master — add the optional `category` attribute to the canonical goods table
-- Migration: 20260913_goods_master_category.sql
--
-- The Goods Master Registry screen (/dashboard/settings/goods-master) models a
-- goods row as { chs_code, name, category, brand, origin_country, sizes,
-- is_active }. Every field maps to the existing `goods` / `goods_variations`
-- tables EXCEPT `category`, which had no column. This adds it so the Registry
-- becomes a flat editor over the SAME `goods` rows used by
-- /dashboard/new-entry/goods-master and the Purchase/Sales wizards — one source
-- of truth, no parallel goods list.
--
-- Purely additive: a nullable TEXT column, no default backfill, no data touched.
-- =============================================================================

BEGIN;

ALTER TABLE public.goods ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.goods.category IS
  'Optional commercial category (e.g. "Agriculture & Food"). Free text; set from the Goods Master Registry.';

-- Register `category` as a translatable free-text field so the DB i18n scan is
-- aware of it (mirrors how goods_name is handled). Guarded — the registry table
-- and its unique key may not exist on every environment.
DO $$
BEGIN
  IF to_regclass('public.translation_field_registry') IS NOT NULL THEN
    INSERT INTO public.translation_field_registry (record_table, field_name, is_active)
    VALUES ('goods', 'category', true)
    ON CONFLICT DO NOTHING;
  END IF;
EXCEPTION WHEN others THEN
  -- registry shape differs across environments; never fail the migration for it
  NULL;
END $$;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260913_goods_master_category', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
