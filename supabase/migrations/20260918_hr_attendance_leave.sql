-- =============================================================================
-- HRM Phase 4 — Attendance, Shifts & Leave management
-- Migration: 20260918_hr_attendance_leave.sql
--
--   * hr_shifts                  — shift / roster master (times, grace, break, working days)
--   * hr_holidays                — per country/branch public-holiday & weekly-off calendar
--   * hr_leave_types             — configurable leave types (paid, entitlement, carry-forward)
--   * hr_employee_leave_balances — per employee / type / year entitled/taken/pending/remaining
--   * hr_attendance_corrections  — append-only correction requests: old value, new value,
--                                  reason, requested_by, approved_by, date, time
--   * additive nullable columns on office_attendance (shift_id, late/early/OT minutes)
--
-- Non-destructive: 5 new tables + 3 nullable columns + seed of standard leave
-- types. office_attendance / office_leave_requests rows and columns untouched.
-- =============================================================================

BEGIN;

-- ── shifts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_shifts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL,
  name              text NOT NULL,
  country_id        uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id    uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  start_time        time NOT NULL DEFAULT '09:00',
  end_time          time NOT NULL DEFAULT '18:00',
  break_minutes     int  NOT NULL DEFAULT 60,
  grace_minutes     int  NOT NULL DEFAULT 15,
  working_days      text NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  is_night_shift    boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid,
  updated_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_shifts_code_uidx ON public.hr_shifts (lower(code)) WHERE deleted_at IS NULL;

-- ── holiday / weekly-off calendar ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_holidays (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  holiday_date      date NOT NULL,
  country_id        uuid REFERENCES public.countries(id) ON DELETE CASCADE,
  country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE CASCADE,
  city_branch_id    uuid REFERENCES public.city_branches(id) ON DELETE CASCADE,
  holiday_type      text NOT NULL DEFAULT 'public' CHECK (holiday_type IN ('public','religious','national','company','weekly_off')),
  is_recurring      boolean NOT NULL DEFAULT false,
  is_paid           boolean NOT NULL DEFAULT true,
  notes             text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS hr_holidays_date_idx ON public.hr_holidays (holiday_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hr_holidays_scope_idx ON public.hr_holidays (country_id, city_branch_id) WHERE deleted_at IS NULL;

-- ── leave types ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_leave_types (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   text NOT NULL,
  name                   text NOT NULL,
  country_id             uuid REFERENCES public.countries(id) ON DELETE CASCADE,   -- NULL = all countries
  is_paid                boolean NOT NULL DEFAULT true,
  annual_entitlement_days numeric(6,2) NOT NULL DEFAULT 0,
  accrual_method         text NOT NULL DEFAULT 'annual' CHECK (accrual_method IN ('annual','monthly','none')),
  max_carry_forward_days numeric(6,2) NOT NULL DEFAULT 0,
  requires_document      boolean NOT NULL DEFAULT false,
  min_notice_days        int NOT NULL DEFAULT 0,
  is_active              boolean NOT NULL DEFAULT true,
  rank_order             int NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_leave_types_code_country_uidx
  ON public.hr_leave_types (lower(code), coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;

INSERT INTO public.hr_leave_types (code, name, is_paid, annual_entitlement_days, accrual_method, max_carry_forward_days, requires_document, rank_order)
VALUES
  ('annual',    'Annual Leave',        true,  30, 'annual',  10, false, 10),
  ('sick',      'Sick Leave',          true,  14, 'annual',  0,  true,  20),
  ('casual',    'Casual Leave',        true,  6,  'annual',  0,  false, 30),
  ('unpaid',    'Unpaid Leave',        false, 0,  'none',    0,  false, 40),
  ('maternity', 'Maternity Leave',     true,  60, 'none',    0,  true,  50),
  ('paternity', 'Paternity Leave',     true,  5,  'none',    0,  false, 60),
  ('bereavement','Bereavement Leave',  true,  3,  'none',    0,  false, 70),
  ('hajj',      'Hajj / Pilgrimage Leave', true, 15, 'none', 0,  false, 80)
ON CONFLICT DO NOTHING;

-- ── employee leave balances ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_employee_leave_balances (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id      uuid NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE CASCADE,
  year               int  NOT NULL,
  entitled_days      numeric(6,2) NOT NULL DEFAULT 0,
  carried_forward    numeric(6,2) NOT NULL DEFAULT 0,
  taken_days         numeric(6,2) NOT NULL DEFAULT 0,
  pending_days       numeric(6,2) NOT NULL DEFAULT 0,
  adjustment_days    numeric(6,2) NOT NULL DEFAULT 0,
  country_id         uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  city_branch_id     uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  updated_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_leave_bal_emp_type_year_uidx
  ON public.hr_employee_leave_balances (employee_id, leave_type_id, year) WHERE deleted_at IS NULL;

-- ── attendance corrections (append-only, old + new value) ─────────────────
CREATE TABLE IF NOT EXISTS public.hr_attendance_corrections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id     uuid REFERENCES public.office_attendance(id) ON DELETE SET NULL,
  employee_id       uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date   date NOT NULL,
  prev_check_in     time,
  new_check_in      time,
  prev_check_out    time,
  new_check_out     time,
  prev_status       text,
  new_status        text,
  prev_work_hours   numeric(6,2),
  new_work_hours    numeric(6,2),
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','applied','rejected')),
  requested_by      uuid,
  approved_by       uuid,
  approved_at       timestamptz,
  applied_at        timestamptz,
  country_id        uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  city_branch_id    uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE INDEX IF NOT EXISTS hr_att_corr_emp_idx ON public.hr_attendance_corrections (employee_id, attendance_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hr_att_corr_status_idx ON public.hr_attendance_corrections (status) WHERE deleted_at IS NULL;

-- ── additive columns on office_attendance ────────────────────────────────
ALTER TABLE public.office_attendance ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.hr_shifts(id) ON DELETE SET NULL;
ALTER TABLE public.office_attendance ADD COLUMN IF NOT EXISTS late_minutes int NOT NULL DEFAULT 0;
ALTER TABLE public.office_attendance ADD COLUMN IF NOT EXISTS early_leave_minutes int NOT NULL DEFAULT 0;
ALTER TABLE public.office_attendance ADD COLUMN IF NOT EXISTS overtime_hours numeric(6,2) NOT NULL DEFAULT 0;

COMMENT ON TABLE public.hr_leave_types IS 'Configurable leave types (paid flag, entitlement, carry-forward, notice).';
COMMENT ON TABLE public.hr_employee_leave_balances IS 'Per employee / leave type / year balance ledger.';
COMMENT ON TABLE public.hr_attendance_corrections IS 'Append-only attendance correction requests — old value, new value, reason, requester, approver, timestamp.';

-- ── views ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.hr_employee_leave_balances_v AS
SELECT
  b.*,
  (b.entitled_days + b.carried_forward + b.adjustment_days - b.taken_days - b.pending_days) AS remaining_days,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  lt.is_paid,
  e.employee_code,
  COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
  co.name AS country_name
FROM public.hr_employee_leave_balances b
JOIN public.hr_leave_types lt ON lt.id = b.leave_type_id
JOIN public.employees e ON e.id = b.employee_id
LEFT JOIN public.customers c ON c.id = e.person_master_id
LEFT JOIN public.countries co ON co.id = b.country_id
WHERE b.deleted_at IS NULL;

GRANT SELECT ON public.hr_employee_leave_balances_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON
  public.hr_shifts, public.hr_holidays, public.hr_leave_types,
  public.hr_employee_leave_balances, public.hr_attendance_corrections
  TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260918_hr_attendance_leave', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
