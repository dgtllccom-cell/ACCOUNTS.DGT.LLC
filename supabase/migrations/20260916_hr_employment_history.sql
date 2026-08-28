-- =============================================================================
-- HRM Phase 2 — Employment history & lifecycle
-- Migration: 20260916_hr_employment_history.sql
--
-- Immutable, append-only history of what happens to an employee AFTER hire:
--   * promotions / salary revisions      -> hr_employee_position_events
--   * country / branch / department moves -> hr_employee_transfers
--   * resignation / termination           -> hr_employee_separations
--
-- Nothing here rewrites the live employees row automatically — a service applies
-- an approved event to employees and records the event. Corrections are new
-- rows, never edits. Non-destructive: 3 new tables + 1 view.
-- =============================================================================

BEGIN;

-- ── 1. position / salary events ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_employee_position_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  event_type          text NOT NULL CHECK (event_type IN ('promotion','demotion','salary_revision','confirmation','probation_extension','role_change')),
  effective_date      date NOT NULL,
  prev_designation    text,
  new_designation     text,
  prev_designation_id uuid REFERENCES public.hr_designations(id) ON DELETE SET NULL,
  new_designation_id  uuid REFERENCES public.hr_designations(id) ON DELETE SET NULL,
  prev_department     text,
  new_department      text,
  prev_basic_salary   numeric(18,2),
  new_basic_salary    numeric(18,2),
  prev_monthly_salary numeric(18,2),
  new_monthly_salary  numeric(18,2),
  salary_currency     text,
  reason              text,
  reference_no        text,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected','cancelled')),
  approved_by         uuid,
  approved_at         timestamptz,
  applied_at          timestamptz,
  country_id          uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id   uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id      uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS hr_pos_events_emp_idx ON public.hr_employee_position_events (employee_id, effective_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hr_pos_events_scope_idx ON public.hr_employee_position_events (country_id, city_branch_id) WHERE deleted_at IS NULL;

-- ── 2. transfers ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_employee_transfers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  transfer_type         text NOT NULL CHECK (transfer_type IN ('country','main_branch','city_branch','department','manager')),
  effective_date        date NOT NULL,
  prev_country_id       uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  new_country_id        uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  prev_country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  new_country_branch_id  uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  prev_city_branch_id   uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  new_city_branch_id    uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  prev_department       text,
  new_department        text,
  prev_manager_id       uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  new_manager_id        uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reason                text,
  reference_no          text,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected','cancelled')),
  approved_by           uuid,
  approved_at           timestamptz,
  applied_at            timestamptz,
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE INDEX IF NOT EXISTS hr_transfers_emp_idx ON public.hr_employee_transfers (employee_id, effective_date DESC) WHERE deleted_at IS NULL;

-- ── 3. separations (resignation / termination / end of contract) ───────────
CREATE TABLE IF NOT EXISTS public.hr_employee_separations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  separation_type      text NOT NULL CHECK (separation_type IN ('resignation','termination','end_of_contract','retirement','absconding','death','redundancy')),
  notice_date          date,
  last_working_date    date NOT NULL,
  reason               text,
  rehire_eligible      boolean NOT NULL DEFAULT true,
  exit_interview_done  boolean NOT NULL DEFAULT false,
  exit_notes           text,
  handover_done        boolean NOT NULL DEFAULT false,
  assets_returned      boolean NOT NULL DEFAULT false,
  final_settlement_id  uuid,
  settlement_status    text NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending','calculated','approved','paid')),
  reference_no         text,
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected','cancelled')),
  approved_by          uuid,
  approved_at          timestamptz,
  applied_at           timestamptz,
  country_id           uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id    uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id       uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_separations_active_uidx
  ON public.hr_employee_separations (employee_id)
  WHERE deleted_at IS NULL AND status IN ('pending','approved','applied');
CREATE INDEX IF NOT EXISTS hr_separations_scope_idx ON public.hr_employee_separations (country_id, city_branch_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.hr_employee_position_events IS 'Append-only promotion / salary-revision / confirmation history.';
COMMENT ON TABLE public.hr_employee_transfers IS 'Append-only country / branch / department / manager transfer history.';
COMMENT ON TABLE public.hr_employee_separations IS 'Resignation / termination / end-of-contract records. One active row per employee.';

-- ── 4. unified lifecycle timeline view ────────────────────────────────────
CREATE OR REPLACE VIEW public.hr_employee_lifecycle_v AS
  SELECT
    'position'::text AS kind, e.id, e.employee_id, e.event_type AS sub_type, e.effective_date,
    e.status, e.reason, e.reference_no,
    jsonb_build_object(
      'prev_designation', e.prev_designation, 'new_designation', e.new_designation,
      'prev_department', e.prev_department, 'new_department', e.new_department,
      'prev_basic_salary', e.prev_basic_salary, 'new_basic_salary', e.new_basic_salary,
      'prev_monthly_salary', e.prev_monthly_salary, 'new_monthly_salary', e.new_monthly_salary,
      'salary_currency', e.salary_currency
    ) AS detail,
    e.country_id, e.city_branch_id, e.approved_by, e.approved_at, e.applied_at, e.created_by, e.created_at
  FROM public.hr_employee_position_events e WHERE e.deleted_at IS NULL
  UNION ALL
  SELECT
    'transfer'::text, t.id, t.employee_id, t.transfer_type, t.effective_date,
    t.status, t.reason, t.reference_no,
    jsonb_build_object(
      'prev_country_id', t.prev_country_id, 'new_country_id', t.new_country_id,
      'prev_country_branch_id', t.prev_country_branch_id, 'new_country_branch_id', t.new_country_branch_id,
      'prev_city_branch_id', t.prev_city_branch_id, 'new_city_branch_id', t.new_city_branch_id,
      'prev_department', t.prev_department, 'new_department', t.new_department,
      'prev_manager_id', t.prev_manager_id, 'new_manager_id', t.new_manager_id
    ),
    t.new_country_id, t.new_city_branch_id, t.approved_by, t.approved_at, t.applied_at, t.created_by, t.created_at
  FROM public.hr_employee_transfers t WHERE t.deleted_at IS NULL
  UNION ALL
  SELECT
    'separation'::text, s.id, s.employee_id, s.separation_type, s.last_working_date,
    s.status, s.reason, s.reference_no,
    jsonb_build_object(
      'notice_date', s.notice_date, 'last_working_date', s.last_working_date,
      'rehire_eligible', s.rehire_eligible, 'settlement_status', s.settlement_status,
      'exit_interview_done', s.exit_interview_done, 'assets_returned', s.assets_returned
    ),
    s.country_id, s.city_branch_id, s.approved_by, s.approved_at, s.applied_at, s.created_by, s.created_at
  FROM public.hr_employee_separations s WHERE s.deleted_at IS NULL;

COMMENT ON VIEW public.hr_employee_lifecycle_v IS 'Unified employee lifecycle timeline (position events + transfers + separations).';

GRANT SELECT ON public.hr_employee_lifecycle_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON
  public.hr_employee_position_events, public.hr_employee_transfers, public.hr_employee_separations
  TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260916_hr_employment_history', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
