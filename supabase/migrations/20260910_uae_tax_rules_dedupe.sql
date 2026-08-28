-- =============================================================================
-- UAE TAX — dedupe seed rules + prevent future duplicates
-- Migration: 20260910_uae_tax_rules_dedupe.sql
-- =============================================================================

BEGIN;

-- Collapse duplicate seed rules (same type+key+version) keeping the earliest row
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY rule_type, rule_key, version ORDER BY created_at, id
  ) AS rn
  FROM public.uae_tax_rules
  WHERE deleted_at IS NULL
)
UPDATE public.uae_tax_rules r
SET deleted_at = NOW()
FROM ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uae_tax_rules_type_key_version_idx
  ON public.uae_tax_rules (rule_type, rule_key, version)
  WHERE deleted_at IS NULL;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260910_uae_tax_rules_dedupe', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
