-- HRM: Employee Performance & Appraisal — ADDITIVE.
--
-- One appraisal per employee per review period (quarterly / annual / custom), reviewed by the
-- employee's manager, acknowledged by the employee. Goals / KPIs carry a target and an actual; the
-- system KPIs (task completion, on-time rate, attendance rate) take their actuals from the EXISTING
-- user_tasks and office_attendance records — never typed or invented. Follow-ups (acknowledgement,
-- improvement plan) are EXISTING user_tasks rows (related_module = 'performance').
-- Rollback: DROP TABLE hr_appraisal_events, hr_appraisal_goals, hr_appraisals;

BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_appraisals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_no        text NOT NULL,
  employee_id         uuid NOT NULL REFERENCES public.employees(id),
  period_type         text NOT NULL CHECK (period_type IN ('quarterly','annual','custom')),
  period_label        text NOT NULL,                 -- e.g. 2026-Q3 / 2026
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  reviewer_id         uuid,                          -- profiles.id of the reviewing manager
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','acknowledged','closed','cancelled')),
  overall_rating      numeric(3,2),
  rating_band         text,
  manager_comments    text,
  strengths           text,
  improvement_plan    text,
  improvement_due     date,
  employee_comments   text,
  submitted_at        timestamptz,
  acknowledged_at     timestamptz,
  acknowledged_by     uuid,
  closed_at           timestamptz,
  ack_task_id         uuid REFERENCES public.user_tasks(id),
  improvement_task_id uuid REFERENCES public.user_tasks(id),
  country_id          uuid REFERENCES public.countries(id),
  country_branch_id   uuid REFERENCES public.country_branches(id),
  city_branch_id      uuid REFERENCES public.city_branches(id),
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT hr_appraisals_period_chk CHECK (period_end >= period_start),
  CONSTRAINT hr_appraisals_rating_chk CHECK (overall_rating IS NULL OR overall_rating BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_appraisals_no_uq ON public.hr_appraisals (appraisal_no);
-- One live appraisal per employee per period.
CREATE UNIQUE INDEX IF NOT EXISTS hr_appraisals_emp_period_uq ON public.hr_appraisals (employee_id, period_start, period_end)
  WHERE deleted_at IS NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS hr_appraisals_status_idx ON public.hr_appraisals (status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hr_appraisal_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id  uuid NOT NULL REFERENCES public.hr_appraisals(id) ON DELETE CASCADE,
  title         text NOT NULL,
  kpi_type      text NOT NULL DEFAULT 'manual' CHECK (kpi_type IN ('manual','task_completion','task_on_time','attendance_rate')),
  target        numeric(18,2),
  actual        numeric(18,2),
  unit          text,
  actual_source text NOT NULL DEFAULT 'manager' CHECK (actual_source IN ('manager','system')),
  actual_computed_at timestamptz,
  weight        numeric(5,2) NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 100),
  score         numeric(3,2) CHECK (score IS NULL OR score BETWEEN 1 AND 5),
  comments      text,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_appraisal_goals_appraisal_idx ON public.hr_appraisal_goals (appraisal_id, sort_order);

CREATE TABLE IF NOT EXISTS public.hr_appraisal_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id  uuid NOT NULL REFERENCES public.hr_appraisals(id) ON DELETE CASCADE,
  action        text NOT NULL,
  from_status   text,
  to_status     text,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id      uuid,
  actor_name    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_appraisal_events_idx ON public.hr_appraisal_events (appraisal_id, created_at DESC);

COMMENT ON TABLE public.hr_appraisals IS 'Employee performance appraisal per review period. System KPI actuals come from user_tasks / office_attendance; follow-ups are user_tasks.';

COMMIT;
