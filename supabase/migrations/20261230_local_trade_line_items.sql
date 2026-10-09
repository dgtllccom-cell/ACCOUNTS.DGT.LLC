-- Local Purchase: persist the multi-line goods list, extra charges and loading details
-- so a reopened record shows exactly what was entered (previously all lines were collapsed
-- into one header row and the lines were lost). Additive only; existing rows are untouched
-- (legacy rows with line_items = '[]' are shown as one synthesized line by the UI).
ALTER TABLE public.local_purchases
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extra_charges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS loading_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS loading_date date,
  ADD COLUMN IF NOT EXISTS remarks text;

COMMENT ON COLUMN public.local_purchases.line_items IS 'Canonical goods lines (goods_id + variant + lot) as entered in Step 2; header goods_* columns are aggregates.';
COMMENT ON COLUMN public.local_purchases.extra_charges IS 'Informational extra charges (Step 3). Never posted or allocated unless explicitly confirmed.';
