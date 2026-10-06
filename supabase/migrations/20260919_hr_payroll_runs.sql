-- =============================================================================
-- HRM Phase 5 — Payroll run engine
-- Migration: 20260919_hr_payroll_runs.sql
--
-- A batch + workflow layer ABOVE the existing per-employee employee_salaries_due:
--   Draft -> Calculated -> Reviewed -> Approved -> Posted -> Paid
--
--   * hr_payroll_runs       — one row per (scope, period) payroll batch
--   * hr_payroll_run_lines  — one row per employee in the batch, with the full
--                             component breakdown + original / local / USD amounts
--   * hr_payroll_run_events — append-only status / action audit
--
-- Only an APPROVED run may post accounting; the same run can never post twice
-- (idempotency_key + posted_at guard). Posting is done by the service through
-- the existing post_roznamcha_entry RPC — this migration only stores state.
-- Reversal is controlled (a new contra entry), never a delete. Non-destructive:
-- 3 new tables + 1 view; employee_salaries_due is only ever linked, never altered
-- in shape.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_payroll_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_no              text NOT NULL,
  period_month        text NOT NULL,                       -- 'YYYY-MM'
  country_id          uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id   uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id      uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  presentation_currency text NOT NULL DEFAULT 'USD',
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','calculated','reviewed','approved','posted','paid','cancelled','reversed')),
  employee_count      int NOT NULL DEFAULT 0,
  total_gross         numeric(18,2) NOT NULL DEFAULT 0,
  total_allowances    numeric(18,2) NOT NULL DEFAULT 0,
  total_overtime      numeric(18,2) NOT NULL DEFAULT 0,
  total_bonus         numeric(18,2) NOT NULL DEFAULT 0,
  total_deductions    numeric(18,2) NOT NULL DEFAULT 0,
  total_tax_employee  numeric(18,2) NOT NULL DEFAULT 0,
  total_employer_cost numeric(18,2) NOT NULL DEFAULT 0,
  total_advance_recovery numeric(18,2) NOT NULL DEFAULT 0,
  total_net           numeric(18,2) NOT NULL DEFAULT 0,
  total_net_usd       numeric(18,2) NOT NULL DEFAULT 0,
  idempotency_key     text,
  accrual_journal_entry_id  uuid,
  payment_journal_entry_id  uuid,
  reversal_journal_entry_id uuid,
  notes               text,
  created_by          uuid,
  calculated_at       timestamptz,
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  approved_by         uuid,
  approved_at         timestamptz,
  posted_at           timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_payroll_runs_run_no_uidx ON public.hr_payroll_runs (lower(run_no)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hr_payroll_runs_scope_period_uidx
  ON public.hr_payroll_runs (period_month,
      coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS hr_payroll_runs_status_idx ON public.hr_payroll_runs (status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hr_payroll_run_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id         uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary        numeric(18,2) NOT NULL DEFAULT 0,
  allowances_total    numeric(18,2) NOT NULL DEFAULT 0,
  allowances_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  overtime_amount     numeric(18,2) NOT NULL DEFAULT 0,
  bonus_amount        numeric(18,2) NOT NULL DEFAULT 0,
  unpaid_leave_deduction numeric(18,2) NOT NULL DEFAULT 0,
  other_deductions    numeric(18,2) NOT NULL DEFAULT 0,
  advance_recovery    numeric(18,2) NOT NULL DEFAULT 0,
  tax_employee        numeric(18,2) NOT NULL DEFAULT 0,
  employer_contributions numeric(18,2) NOT NULL DEFAULT 0,
  gross_salary        numeric(18,2) NOT NULL DEFAULT 0,
  net_salary          numeric(18,2) NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'USD',
  exchange_rate       numeric(18,8) NOT NULL DEFAULT 1,
  local_amount        numeric(18,2) NOT NULL DEFAULT 0,
  usd_amount          numeric(18,2) NOT NULL DEFAULT 0,
  salary_due_id       uuid REFERENCES public.employee_salaries_due(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'calculated'
                      CHECK (status IN ('calculated','excluded','posted','paid')),
  worked_days         numeric(6,2),
  unpaid_leave_days   numeric(6,2) NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_payroll_run_lines_run_emp_uidx ON public.hr_payroll_run_lines (run_id, employee_id);
CREATE INDEX IF NOT EXISTS hr_payroll_run_lines_emp_idx ON public.hr_payroll_run_lines (employee_id);

-- roznamcha entry ids per line (journal_entries table is legacy/empty on this ERP;
-- the live GL is roznamcha_entries + roznamcha_lines).
ALTER TABLE public.hr_payroll_run_lines ADD COLUMN IF NOT EXISTS accrual_roznamcha_id  uuid REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL;
ALTER TABLE public.hr_payroll_run_lines ADD COLUMN IF NOT EXISTS payment_roznamcha_id  uuid REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL;
ALTER TABLE public.hr_payroll_run_lines ADD COLUMN IF NOT EXISTS reversal_roznamcha_id uuid REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.hr_payroll_run_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
  action      text NOT NULL,     -- created / calculated / reviewed / approved / posted / paid / reversed / cancelled / line_excluded
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id    uuid,
  actor_name  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_payroll_run_events_run_idx ON public.hr_payroll_run_events (run_id, created_at DESC);

COMMENT ON TABLE public.hr_payroll_runs IS 'Payroll batch + Draft->Calculated->Reviewed->Approved->Posted->Paid workflow. Only approved runs post; posted_at + idempotency_key prevent double posting.';
COMMENT ON TABLE public.hr_payroll_run_lines IS 'Per-employee payroll line: full component breakdown + original / local / USD amounts. Links to employee_salaries_due, never rewrites it.';

CREATE OR REPLACE VIEW public.hr_payroll_runs_v AS
SELECT
  r.*,
  co.name  AS country_name,
  cb.name  AS country_branch_name,
  cib.name AS city_branch_name
FROM public.hr_payroll_runs r
LEFT JOIN public.countries        co  ON co.id  = r.country_id
LEFT JOIN public.country_branches cb  ON cb.id  = r.country_branch_id
LEFT JOIN public.city_branches    cib ON cib.id = r.city_branch_id
WHERE r.deleted_at IS NULL;

GRANT SELECT ON public.hr_payroll_runs_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON
  public.hr_payroll_runs, public.hr_payroll_run_lines, public.hr_payroll_run_events
  TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260919_hr_payroll_runs', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
