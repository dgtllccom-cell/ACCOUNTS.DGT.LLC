-- =============================================================================
-- HRM — country-based, currency-aware salaries
-- Migration: 20260923_hr_country_currency.sql
--
-- Every employee's salary currency is the OFFICIAL currency of their assigned
-- city branch / main branch / country — resolved dynamically, never hard-coded:
--     city_branches.local_currency
--   → country_branches.local_currency
--   → countries.currency_code
--   → countries.reporting_currency
--   → 'USD'
--
--   * hr_resolve_currency(country_id, country_branch_id, city_branch_id) → text
--   * hr_employee_currency(employee_id)                                  → text
--
-- Backfill: align employees.salary_currency to the resolved country/branch
-- currency where they differ (records the previous value in an audit row).
-- Non-destructive: 2 functions + 1 audit table + a corrective backfill.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.hr_resolve_currency(
  p_country_id uuid, p_country_branch_id uuid DEFAULT NULL, p_city_branch_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(cib.local_currency), '') FROM public.city_branches cib WHERE cib.id = p_city_branch_id AND cib.deleted_at IS NULL),
    (SELECT NULLIF(btrim(cb.local_currency), '')  FROM public.country_branches cb WHERE cb.id = p_country_branch_id AND cb.deleted_at IS NULL),
    (SELECT NULLIF(btrim(co.currency_code), '')   FROM public.countries co WHERE co.id = p_country_id AND co.deleted_at IS NULL),
    (SELECT NULLIF(btrim(co.reporting_currency), '') FROM public.countries co WHERE co.id = p_country_id AND co.deleted_at IS NULL),
    'USD'
  );
$$;

CREATE OR REPLACE FUNCTION public.hr_employee_currency(p_employee_id uuid)
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT public.hr_resolve_currency(e.country_id, e.country_branch_id, e.city_branch_id)
  FROM public.employees e WHERE e.id = p_employee_id AND e.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.hr_resolve_currency(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hr_employee_currency(uuid) TO authenticated, service_role;

-- ── audit of currency realignments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_employee_currency_audit (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  prev_currency  text,
  new_currency   text,
  reason         text NOT NULL DEFAULT 'aligned to country/branch official currency',
  changed_at     timestamptz NOT NULL DEFAULT now()
);

-- ── corrective backfill ──────────────────────────────────────────────────
WITH mism AS (
  SELECT e.id, e.salary_currency AS prev, public.hr_resolve_currency(e.country_id, e.country_branch_id, e.city_branch_id) AS want
  FROM public.employees e
  WHERE e.deleted_at IS NULL
),
changed AS (
  SELECT * FROM mism WHERE COALESCE(prev, '') IS DISTINCT FROM want
)
INSERT INTO public.hr_employee_currency_audit (employee_id, prev_currency, new_currency)
SELECT id, prev, want FROM changed;

UPDATE public.employees e
SET salary_currency = public.hr_resolve_currency(e.country_id, e.country_branch_id, e.city_branch_id),
    updated_at = now()
WHERE e.deleted_at IS NULL
  AND COALESCE(e.salary_currency, '') IS DISTINCT FROM public.hr_resolve_currency(e.country_id, e.country_branch_id, e.city_branch_id);

COMMENT ON FUNCTION public.hr_resolve_currency(uuid, uuid, uuid) IS
  'Official salary currency for a country/branch scope: city branch → main branch → country currency_code → reporting_currency → USD.';

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260923_hr_country_currency', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
