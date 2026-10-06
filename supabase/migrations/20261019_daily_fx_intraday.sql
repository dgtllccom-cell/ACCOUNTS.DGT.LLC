-- Migration: 20261019_daily_fx_intraday.sql
-- Daily Exchange Rate — intraday (same-day) rate changes + explicit currency + effective time.
--
-- Before: daily_usd_rates was keyed UNIQUE on (country_id, coalesce(country_branch_id,zero), rate_date),
--   so only ONE rate per country/branch per day could exist and a second save overwrote the first —
--   destroying the earlier rate that historical transactions were posted against.
-- After:
--   * effective_from timestamptz  — the exact instant a rate becomes applicable
--   * currency_code text          — the local currency the rate is quoted in (units of local = 1 USD)
--   * superseded_at timestamptz   — set on the previous rate when a newer same-scope rate is entered (audit only)
--   * UNIQUE is now (country, branch, effective_from) — many rates per day allowed, ordered by time
--   * get_daily_rate(...) gains p_at timestamptz — resolves the rate effective AT that instant
--
-- Historical transactions are unaffected: every roznamcha_lines row already stores its own frozen
-- usd_rate / usd_amount at post time and nothing ever recomputes them. This migration only changes
-- how NEW postings look up the applicable rate.
--
-- Additive, non-destructive, idempotent.

BEGIN;

-- 1. New columns -------------------------------------------------------------
ALTER TABLE public.daily_usd_rates
  ADD COLUMN IF NOT EXISTS effective_from timestamptz,
  ADD COLUMN IF NOT EXISTS currency_code  text,
  ADD COLUMN IF NOT EXISTS superseded_at  timestamptz;

-- 2. Backfill effective_from from rate_date + rate_time (best effort), else rate_date 09:00 local,
--    else created_at. Only fills NULLs so re-runs are safe.
UPDATE public.daily_usd_rates r
SET effective_from = COALESCE(
      -- try "YYYY-MM-DD HH:MI AM/PM"
      NULLIF(
        to_timestamp(
          r.rate_date::text || ' ' || NULLIF(btrim(r.rate_time), ''),
          'YYYY-MM-DD HH12:MI AM'
        ),
        NULL
      ),
      (r.rate_date::timestamptz + interval '9 hours'),
      r.created_at,
      now()
    )
WHERE r.effective_from IS NULL;

-- fallback for any rows where the to_timestamp parse raised (wrapped by a safe re-pass)
UPDATE public.daily_usd_rates r
SET effective_from = COALESCE(r.rate_date::timestamptz + interval '9 hours', r.created_at, now())
WHERE r.effective_from IS NULL;

ALTER TABLE public.daily_usd_rates
  ALTER COLUMN effective_from SET DEFAULT now();

UPDATE public.daily_usd_rates SET effective_from = now()
WHERE effective_from IS NULL;

ALTER TABLE public.daily_usd_rates
  ALTER COLUMN effective_from SET NOT NULL;

-- 3. Backfill currency_code from the country master (units of THIS currency = 1 USD)
UPDATE public.daily_usd_rates r
SET currency_code = upper(c.currency_code)
FROM public.countries c
WHERE c.id = r.country_id
  AND (r.currency_code IS NULL OR btrim(r.currency_code) = '');

-- 4. Swap the "one rate per day" unique index for "one rate per effective instant" ----
DROP INDEX IF EXISTS public.daily_usd_rates_country_branch_day_idx;

CREATE UNIQUE INDEX IF NOT EXISTS daily_usd_rates_scope_effective_idx
  ON public.daily_usd_rates (
    country_id,
    COALESCE(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    effective_from
  )
  WHERE deleted_at IS NULL;

-- resolution index: newest-effective-first within a scope
CREATE INDEX IF NOT EXISTS daily_usd_rates_scope_effective_desc_idx
  ON public.daily_usd_rates (country_id, country_branch_id, effective_from DESC)
  WHERE deleted_at IS NULL;

-- 5. Mark superseded rows for audit (a rate is superseded by any newer same-scope rate) --
UPDATE public.daily_usd_rates r
SET superseded_at = (
  SELECT MIN(n.effective_from)
  FROM public.daily_usd_rates n
  WHERE n.deleted_at IS NULL
    AND n.country_id = r.country_id
    AND n.country_branch_id IS NOT DISTINCT FROM r.country_branch_id
    AND n.effective_from > r.effective_from
)
WHERE r.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.daily_usd_rates n2
    WHERE n2.deleted_at IS NULL
      AND n2.country_id = r.country_id
      AND n2.country_branch_id IS NOT DISTINCT FROM r.country_branch_id
      AND n2.effective_from > r.effective_from
  );

-- keep it current on future inserts
CREATE OR REPLACE FUNCTION public.daily_usd_rates_mark_superseded() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  -- the just-inserted rate supersedes every earlier same-scope rate
  UPDATE public.daily_usd_rates p
     SET superseded_at = NEW.effective_from, updated_at = now()
   WHERE p.deleted_at IS NULL
     AND p.id <> NEW.id
     AND p.country_id = NEW.country_id
     AND p.country_branch_id IS NOT DISTINCT FROM NEW.country_branch_id
     AND p.effective_from < NEW.effective_from
     AND (p.superseded_at IS NULL OR p.superseded_at > NEW.effective_from);
  -- and this rate is itself superseded if a later one already exists
  UPDATE public.daily_usd_rates s
     SET superseded_at = (
       SELECT MIN(n.effective_from) FROM public.daily_usd_rates n
       WHERE n.deleted_at IS NULL AND n.country_id = NEW.country_id
         AND n.country_branch_id IS NOT DISTINCT FROM NEW.country_branch_id
         AND n.effective_from > NEW.effective_from
     )
   WHERE s.id = NEW.id;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_daily_usd_rates_mark_superseded ON public.daily_usd_rates;
CREATE TRIGGER trg_daily_usd_rates_mark_superseded
  AFTER INSERT ON public.daily_usd_rates
  FOR EACH ROW EXECUTE FUNCTION public.daily_usd_rates_mark_superseded();

-- 6. get_daily_rate — resolve the rate effective AT a given instant --------------------
--    Backwards compatible: old 3-arg callers still work (p_at defaults to end-of-p_date,
--    or now() when no date given). Branch-specific rate wins over country-level.
CREATE OR REPLACE FUNCTION public.get_daily_rate(
  p_country_id uuid,
  p_country_branch_id uuid DEFAULT NULL::uuid,
  p_date text DEFAULT NULL::text,
  p_at timestamptz DEFAULT NULL::timestamptz
)
RETURNS TABLE(
  rate_date text,
  buying_rate numeric,
  selling_rate numeric,
  credit_rate numeric,
  debit_rate numeric,
  is_exact_date boolean,
  is_branch_specific boolean,
  effective_from timestamptz,
  currency_code text
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_at timestamptz;
  v_today text := to_char(now(), 'YYYY-MM-DD');
BEGIN
  -- effective instant to resolve against:
  --   explicit p_at wins; else if a back-date is given use END of that day;
  --   else "now" so today's postings pick up intraday changes.
  v_at := COALESCE(
    p_at,
    CASE
      WHEN p_date IS NOT NULL AND p_date < v_today
        THEN (p_date::date + interval '1 day' - interval '1 second')
      ELSE now()
    END
  );

  RETURN QUERY
  SELECT
    r.rate_date::text,
    r.buying_rate::numeric,
    r.selling_rate::numeric,
    r.credit_rate::numeric,
    r.debit_rate::numeric,
    (r.rate_date::text = COALESCE(p_date, v_today)) AS is_exact_date,
    (r.country_branch_id IS NOT NULL) AS is_branch_specific,
    r.effective_from,
    r.currency_code
  FROM public.daily_usd_rates r
  WHERE r.deleted_at IS NULL
    AND r.country_id = p_country_id
    AND (p_country_branch_id IS NULL OR r.country_branch_id = p_country_branch_id OR r.country_branch_id IS NULL)
    AND r.effective_from <= v_at
  ORDER BY
    (CASE WHEN r.country_branch_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
    r.effective_from DESC
  LIMIT 1;
END;
$function$;

COMMIT;
