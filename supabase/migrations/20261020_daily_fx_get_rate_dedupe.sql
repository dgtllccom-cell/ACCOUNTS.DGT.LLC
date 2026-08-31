-- Migration: 20261020_daily_fx_get_rate_dedupe.sql
-- Fix: 20261019 added a 4-arg get_daily_rate() but CREATE OR REPLACE with a new arg
-- list creates an OVERLOAD, it does not replace. The pre-existing 3-arg
-- get_daily_rate(uuid, uuid, text) and the older get_daily_rate(uuid, uuid, date)
-- therefore still existed, and a 3-arg call `get_daily_rate(uuid, uuid, text)` became
-- ambiguous ("function is not unique") — breaking Cash Entry FX lookup and the
-- Roznamcha USD resolver (which silently fell back to rate = 1).
--
-- This drops every stale overload and (re)defines a single canonical function whose
-- trailing args all default, so both 3-arg and 4-arg call sites resolve to it.
--
-- Non-destructive (functions only), idempotent.

BEGIN;

DROP FUNCTION IF EXISTS public.get_daily_rate(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_daily_rate(uuid, uuid, date);
DROP FUNCTION IF EXISTS public.get_daily_rate(uuid, uuid, text, timestamptz);

CREATE FUNCTION public.get_daily_rate(
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
