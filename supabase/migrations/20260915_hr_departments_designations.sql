-- =============================================================================
-- HRM Phase 1 — Departments & Designations masters
-- Migration: 20260915_hr_departments_designations.sql
--
-- Promotes the free-text employees.department / employees.designation values to
-- proper master tables so HR can assign heads, budgets, pay grades and salary
-- scales. Existing free-text columns are LEFT UNTOUCHED and keep working — the
-- new hr_department_id / hr_designation_id columns on employees are nullable and
-- additive. Distinct existing values are backfilled into the masters.
--
-- Non-destructive: creates 2 tables + 2 nullable FK columns + backfill. No drop,
-- no rename, no data loss.
-- =============================================================================

BEGIN;

-- ── 1. hr_departments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_departments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text NOT NULL,
  name                 text NOT NULL,
  country_id           uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id    uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id       uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  head_employee_id     uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  parent_department_id uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  monthly_budget       numeric(18,2) NOT NULL DEFAULT 0,
  budget_currency      text NOT NULL DEFAULT 'USD',
  description          text,
  is_active            boolean NOT NULL DEFAULT true,
  created_by           uuid,
  updated_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_departments_code_uidx
  ON public.hr_departments (lower(code)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hr_departments_name_scope_uidx
  ON public.hr_departments (lower(name), coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hr_departments_scope_idx
  ON public.hr_departments (country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.hr_departments IS
  'HRM department master. Backfilled from distinct employees.department; the free-text column is retained.';

-- ── 2. hr_designations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_designations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL,
  title             text NOT NULL,
  department_id     uuid REFERENCES public.hr_departments(id) ON DELETE SET NULL,
  country_id        uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  pay_grade         text,
  min_basic_salary  numeric(18,2) NOT NULL DEFAULT 0,
  max_basic_salary  numeric(18,2) NOT NULL DEFAULT 0,
  salary_currency   text NOT NULL DEFAULT 'USD',
  rank_order        int NOT NULL DEFAULT 0,
  description       text,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid,
  updated_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_designations_code_uidx
  ON public.hr_designations (lower(code)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hr_designations_title_scope_uidx
  ON public.hr_designations (lower(title), coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hr_designations_dept_idx
  ON public.hr_designations (department_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.hr_designations IS
  'HRM designation master. Backfilled from distinct employees.designation; the free-text column is retained.';

-- ── 3. additive nullable FK columns on employees ───────────────────────────
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hr_department_id  uuid REFERENCES public.hr_departments(id)  ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hr_designation_id uuid REFERENCES public.hr_designations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS employees_hr_department_idx  ON public.employees (hr_department_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS employees_hr_designation_idx ON public.employees (hr_designation_id) WHERE deleted_at IS NULL;

-- ── 4. backfill masters from distinct existing free-text values ─────────────
INSERT INTO public.hr_departments (code, name, country_id, is_active)
SELECT
  upper(regexp_replace(substr(btrim(src.department), 1, 12), '[^A-Za-z0-9]+', '-', 'g')) AS code,
  btrim(src.department) AS name,
  src.country_id,
  true
FROM (
  SELECT DISTINCT ON (lower(btrim(e.department)), e.country_id)
    btrim(e.department) AS department, e.country_id
  FROM public.employees e
  WHERE e.deleted_at IS NULL AND btrim(coalesce(e.department, '')) <> ''
  ORDER BY lower(btrim(e.department)), e.country_id
) src
ON CONFLICT DO NOTHING;

INSERT INTO public.hr_designations (code, title, department_id, country_id, salary_currency, min_basic_salary, is_active)
SELECT
  upper(regexp_replace(substr(btrim(src.designation), 1, 12), '[^A-Za-z0-9]+', '-', 'g')) AS code,
  btrim(src.designation) AS title,
  d.id,
  src.country_id,
  coalesce(src.salary_currency, 'USD'),
  coalesce(src.min_salary, 0),
  true
FROM (
  SELECT DISTINCT ON (lower(btrim(e.designation)))
    btrim(e.designation)  AS designation,
    btrim(e.department)   AS department,
    e.country_id,
    e.salary_currency,
    min(e.basic_salary) OVER (PARTITION BY lower(btrim(e.designation))) AS min_salary
  FROM public.employees e
  WHERE e.deleted_at IS NULL AND btrim(coalesce(e.designation, '')) <> ''
  ORDER BY lower(btrim(e.designation))
) src
LEFT JOIN public.hr_departments d
  ON lower(d.name) = lower(src.department) AND d.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- ── 5. link existing employees to the freshly backfilled masters ───────────
UPDATE public.employees e
SET hr_department_id = d.id
FROM public.hr_departments d
WHERE e.hr_department_id IS NULL
  AND e.deleted_at IS NULL
  AND btrim(coalesce(e.department, '')) <> ''
  AND lower(d.name) = lower(btrim(e.department))
  AND d.deleted_at IS NULL
  AND (d.country_id IS NOT DISTINCT FROM e.country_id OR d.country_id IS NULL);

UPDATE public.employees e
SET hr_designation_id = g.id
FROM public.hr_designations g
WHERE e.hr_designation_id IS NULL
  AND e.deleted_at IS NULL
  AND btrim(coalesce(e.designation, '')) <> ''
  AND lower(g.title) = lower(btrim(e.designation))
  AND g.deleted_at IS NULL;

-- ── 6. localised view with employee counts (drives the masters UI) ─────────
CREATE OR REPLACE VIEW public.hr_departments_v AS
SELECT
  d.*,
  co.name  AS country_name,
  cb.name  AS country_branch_name,
  cib.name AS city_branch_name,
  hp.name  AS parent_department_name,
  (SELECT count(*)::int FROM public.employees e
     WHERE e.deleted_at IS NULL AND (e.hr_department_id = d.id OR lower(btrim(e.department)) = lower(d.name))) AS employee_count,
  he.employee_code AS head_employee_code
FROM public.hr_departments d
LEFT JOIN public.countries        co  ON co.id  = d.country_id
LEFT JOIN public.country_branches cb  ON cb.id  = d.country_branch_id
LEFT JOIN public.city_branches    cib ON cib.id = d.city_branch_id
LEFT JOIN public.hr_departments   hp  ON hp.id  = d.parent_department_id
LEFT JOIN public.employees        he  ON he.id  = d.head_employee_id
WHERE d.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.hr_designations_v AS
SELECT
  g.*,
  d.name AS department_name,
  co.name AS country_name,
  (SELECT count(*)::int FROM public.employees e
     WHERE e.deleted_at IS NULL AND (e.hr_designation_id = g.id OR lower(btrim(e.designation)) = lower(g.title))) AS employee_count
FROM public.hr_designations g
LEFT JOIN public.hr_departments d ON d.id = g.department_id
LEFT JOIN public.countries      co ON co.id = g.country_id
WHERE g.deleted_at IS NULL;

GRANT SELECT ON public.hr_departments_v, public.hr_designations_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.hr_departments, public.hr_designations TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260915_hr_departments_designations', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
