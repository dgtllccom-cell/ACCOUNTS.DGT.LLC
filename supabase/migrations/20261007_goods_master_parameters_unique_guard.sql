-- Migration: 20261007_goods_master_parameters_unique_guard.sql
-- Description: Make goods_master_parameters seeding truly idempotent.
--   20261006 used `ON CONFLICT DO NOTHING` with no matching constraint, so a
--   re-run would duplicate every seeded parameter row. This migration:
--     1. de-duplicates any existing rows (keeps the earliest id per key),
--     2. adds a partial unique index on (goods_id, param_type, param_value)
--        so future seeds / API inserts are protected against duplicates.
--   Additive and non-destructive to distinct business data.

BEGIN;

-- 1. Collapse duplicates that may already exist (keep the earliest row).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY goods_id, param_type, lower(param_value)
           ORDER BY created_at, id
         ) AS rn
  FROM public.goods_master_parameters
  WHERE deleted_at IS NULL
)
UPDATE public.goods_master_parameters g
SET deleted_at = NOW(), is_active = false
FROM ranked r
WHERE g.id = r.id AND r.rn > 1;

-- 2. Enforce uniqueness going forward.
CREATE UNIQUE INDEX IF NOT EXISTS ux_goods_master_parameters_key
  ON public.goods_master_parameters (goods_id, param_type, param_value)
  WHERE deleted_at IS NULL;

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261007_goods_master_parameters_unique_guard', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
