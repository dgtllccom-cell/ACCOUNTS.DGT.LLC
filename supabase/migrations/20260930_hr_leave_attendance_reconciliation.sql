-- =============================================================================
-- Enterprise HRM — Final Closure: Leave Balance, Shift Attendance,
-- Payroll↔Accounting↔Tax Reconciliation, Employee↔ERP-User link
-- Migration: 20260930_hr_leave_attendance_reconciliation.sql
--
-- Non-destructive. Adds: 3 columns, 2 trigger functions + triggers, 1 helper
-- function, 1 reconciliation view, and a default "Day Shift" seed per country
-- that has employees. No existing table/row is dropped or rewritten. No new
-- accounting engine — the reconciliation view only JOINS what already exists
-- (hr_payroll_run_lines.*_roznamcha_id / salary_due_id, roznamcha_lines).
-- =============================================================================

BEGIN;

-- ── A1. Leave balance lifecycle ─────────────────────────────────────────────
-- Request → Pending → Approved / Rejected / Cancelled → correct balance.
-- `balance_effect` records the status the balance was last reconciled to, so a
-- re-save or repeated PATCH never double-counts.
ALTER TABLE public.office_leave_requests
  ADD COLUMN IF NOT EXISTS balance_effect text;

CREATE OR REPLACE FUNCTION public.hr_apply_leave_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_year        int;
  v_type_id     uuid;
  v_days        numeric;
  v_prev        text;   -- previously-applied effect
  v_next        text;   -- effect to apply now
  -- normalise the free-text status into one of: pending | approved | released
  fn_norm text;
BEGIN
  -- deletions release everything that was reserved
  IF (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    v_next := 'released';
  ELSIF (TG_OP = 'DELETE') THEN
    v_next := 'released';
  ELSE
    v_next := CASE
      WHEN lower(coalesce(NEW.status,'')) IN ('approved','approve') THEN 'approved'
      WHEN lower(coalesce(NEW.status,'')) IN ('rejected','reject','cancelled','canceled','cancel','withdrawn') THEN 'released'
      WHEN lower(coalesce(NEW.status,'')) IN ('pending','requested','submitted','') THEN 'pending'
      ELSE 'pending'
    END;
  END IF;

  v_prev := coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.balance_effect ELSE OLD.balance_effect END), 'none');
  IF TG_OP = 'INSERT' THEN v_prev := 'none'; END IF;
  IF v_prev = v_next THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_days := coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.days ELSE NEW.days END), 0);
  v_year := extract(year FROM coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.from_date ELSE NEW.from_date END), current_date))::int;

  -- resolve the leave type: match hr_leave_types by code or name within the
  -- employee's country, else the first active type, else NULL (skip).
  SELECT lt.id INTO v_type_id
  FROM public.hr_leave_types lt
  JOIN public.employees e ON e.id = coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END))
  WHERE lt.deleted_at IS NULL AND lt.is_active
    AND (lt.country_id IS NULL OR lt.country_id = e.country_id)
    AND (lower(lt.code) = lower(coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.leave_type ELSE NEW.leave_type END),''))
      OR lower(lt.name) = lower(coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.leave_type ELSE NEW.leave_type END),'')))
  ORDER BY lt.country_id NULLS LAST, lt.rank_order
  LIMIT 1;

  IF v_type_id IS NULL THEN
    SELECT lt.id INTO v_type_id FROM public.hr_leave_types lt
    JOIN public.employees e ON e.id = coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END))
    WHERE lt.deleted_at IS NULL AND lt.is_active AND (lt.country_id IS NULL OR lt.country_id = e.country_id)
    ORDER BY lt.country_id NULLS LAST, lt.rank_order LIMIT 1;
  END IF;
  IF v_type_id IS NULL THEN
    -- no leave-type master yet — record the effect so we don't retry endlessly
    IF TG_OP <> 'DELETE' THEN NEW.balance_effect := v_next; END IF;
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- ensure a balance row
  INSERT INTO public.hr_employee_leave_balances (employee_id, leave_type_id, year, entitled_days, country_id, city_branch_id)
  SELECT coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END)), v_type_id, v_year,
         coalesce((SELECT annual_entitlement_days FROM public.hr_leave_types WHERE id = v_type_id), 0),
         (CASE WHEN TG_OP='DELETE' THEN OLD.country_id ELSE NEW.country_id END),
         (CASE WHEN TG_OP='DELETE' THEN OLD.city_branch_id ELSE NEW.city_branch_id END)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.hr_employee_leave_balances
    WHERE employee_id = coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END))
      AND leave_type_id = v_type_id AND year = v_year AND deleted_at IS NULL);

  -- reverse the previous effect
  IF v_prev = 'pending' THEN
    UPDATE public.hr_employee_leave_balances SET pending_days = greatest(0, pending_days - v_days), updated_at = now()
    WHERE employee_id = coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END)) AND leave_type_id = v_type_id AND year = v_year AND deleted_at IS NULL;
  ELSIF v_prev = 'approved' THEN
    UPDATE public.hr_employee_leave_balances SET taken_days = greatest(0, taken_days - v_days), updated_at = now()
    WHERE employee_id = coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END)) AND leave_type_id = v_type_id AND year = v_year AND deleted_at IS NULL;
  END IF;

  -- apply the new effect
  IF v_next = 'pending' THEN
    UPDATE public.hr_employee_leave_balances SET pending_days = pending_days + v_days, updated_at = now()
    WHERE employee_id = coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END)) AND leave_type_id = v_type_id AND year = v_year AND deleted_at IS NULL;
  ELSIF v_next = 'approved' THEN
    UPDATE public.hr_employee_leave_balances SET taken_days = taken_days + v_days, updated_at = now()
    WHERE employee_id = coalesce((CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END)) AND leave_type_id = v_type_id AND year = v_year AND deleted_at IS NULL;
  END IF;
  -- 'released' applies nothing further (the reversal above is the whole effect)

  IF TG_OP <> 'DELETE' THEN NEW.balance_effect := v_next; END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_apply_leave_balance ON public.office_leave_requests;
CREATE TRIGGER trg_hr_apply_leave_balance
  BEFORE INSERT OR UPDATE OF status, days, deleted_at, leave_type ON public.office_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.hr_apply_leave_balance();

COMMENT ON FUNCTION public.hr_apply_leave_balance() IS
  'Keeps hr_employee_leave_balances (pending_days / taken_days) in sync with the office_leave_requests lifecycle. balance_effect guards against double application.';

-- ── A2. Shift-based attendance calculation ──────────────────────────────────
ALTER TABLE public.office_attendance
  ADD COLUMN IF NOT EXISTS expected_hours numeric;
ALTER TABLE public.office_attendance
  ADD COLUMN IF NOT EXISTS is_holiday boolean NOT NULL DEFAULT false;
ALTER TABLE public.office_attendance
  ADD COLUMN IF NOT EXISTS on_approved_leave boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.hr_calc_attendance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_shift     public.hr_shifts%ROWTYPE;
  v_start     time;
  v_end       time;
  v_grace     int;
  v_break     int;
  v_expected  numeric;
  v_actual    numeric;
  v_ci        time := NEW.check_in;
  v_co        time := NEW.check_out;
  v_span      numeric;
BEGIN
  -- resolve the shift: explicit shift_id, else the employee's working_shift by
  -- name within scope, else the branch/country default active shift.
  IF NEW.shift_id IS NOT NULL THEN
    SELECT * INTO v_shift FROM public.hr_shifts WHERE id = NEW.shift_id AND deleted_at IS NULL;
  END IF;
  IF v_shift.id IS NULL THEN
    SELECT s.* INTO v_shift
    FROM public.hr_shifts s
    JOIN public.employees e ON e.id = NEW.employee_id
    WHERE s.deleted_at IS NULL AND s.is_active
      AND (s.country_id IS NULL OR s.country_id = e.country_id)
      AND (s.city_branch_id IS NULL OR s.city_branch_id = e.city_branch_id)
      AND (lower(s.name) = lower(coalesce(e.working_shift,'')) OR lower(s.code) = lower(coalesce(e.working_shift,'')) OR e.working_shift IS NULL)
    ORDER BY (lower(s.name) = lower(coalesce(e.working_shift,''))) DESC, s.city_branch_id NULLS LAST, s.country_id NULLS LAST
    LIMIT 1;
    IF v_shift.id IS NOT NULL THEN NEW.shift_id := v_shift.id; END IF;
  END IF;

  -- holiday / approved-leave flags (don't accrue late / overtime on these)
  NEW.is_holiday := EXISTS (
    SELECT 1 FROM public.hr_holidays h
    JOIN public.employees e ON e.id = NEW.employee_id
    WHERE h.deleted_at IS NULL AND h.holiday_date = NEW.attendance_date
      AND (h.country_id IS NULL OR h.country_id = e.country_id)
      AND (h.city_branch_id IS NULL OR h.city_branch_id = e.city_branch_id));
  NEW.on_approved_leave := EXISTS (
    SELECT 1 FROM public.office_leave_requests l
    WHERE l.deleted_at IS NULL AND l.employee_id = NEW.employee_id
      AND lower(l.status) IN ('approved','approve')
      AND NEW.attendance_date BETWEEN l.from_date AND l.to_date);

  v_start := coalesce(v_shift.start_time, time '09:00');
  v_end   := coalesce(v_shift.end_time,   time '17:00');
  v_grace := coalesce(v_shift.grace_minutes, 0);
  v_break := coalesce(v_shift.break_minutes, 0);

  -- expected duty hours (overnight shift: end < start → add 24h)
  v_span := EXTRACT(EPOCH FROM (v_end - v_start)) / 3600.0;
  IF v_span <= 0 THEN v_span := v_span + 24; END IF;
  v_expected := greatest(0, v_span - v_break / 60.0);
  NEW.expected_hours := round(v_expected, 2);

  IF v_ci IS NOT NULL AND v_co IS NOT NULL THEN
    v_actual := EXTRACT(EPOCH FROM (v_co - v_ci)) / 3600.0;
    IF v_actual <= 0 THEN v_actual := v_actual + 24; END IF;               -- overnight
    v_actual := greatest(0, v_actual - v_break / 60.0);
    NEW.work_hours := round(v_actual, 2);

    IF NEW.is_holiday OR NEW.on_approved_leave THEN
      NEW.late_minutes := 0;
      NEW.early_leave_minutes := 0;
      NEW.overtime_hours := round(v_actual, 2);   -- all hours on a holiday are overtime
    ELSE
      NEW.late_minutes := greatest(0, ceil(EXTRACT(EPOCH FROM (v_ci - (v_start + make_interval(mins => v_grace)))) / 60.0))::int;
      NEW.early_leave_minutes := greatest(0, ceil(EXTRACT(EPOCH FROM ((v_end - make_interval(mins => v_grace)) - v_co)) / 60.0))::int;
      NEW.overtime_hours := round(greatest(0, v_actual - v_expected), 2);
    END IF;
  ELSE
    NEW.work_hours := coalesce(NEW.work_hours, 0);
    NEW.late_minutes := coalesce(NEW.late_minutes, 0);
    NEW.early_leave_minutes := coalesce(NEW.early_leave_minutes, 0);
    NEW.overtime_hours := coalesce(NEW.overtime_hours, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_calc_attendance ON public.office_attendance;
CREATE TRIGGER trg_hr_calc_attendance
  BEFORE INSERT OR UPDATE OF check_in, check_out, attendance_date, shift_id, status, employee_id ON public.office_attendance
  FOR EACH ROW EXECUTE FUNCTION public.hr_calc_attendance();

COMMENT ON FUNCTION public.hr_calc_attendance() IS
  'Computes expected_hours, work_hours, late_minutes, early_leave_minutes, overtime_hours from the assigned shift. Handles overnight shifts, holidays and approved leave.';

-- default "Day Shift" per country that has employees (only if none exists there)
INSERT INTO public.hr_shifts (code, name, country_id, start_time, end_time, break_minutes, grace_minutes, working_days, is_night_shift, is_active)
SELECT 'DAY', 'Day Shift', c.country_id, time '09:00', time '17:00', 60, 15, 'Mon-Fri', false, true
FROM (SELECT DISTINCT country_id FROM public.employees WHERE deleted_at IS NULL AND country_id IS NOT NULL) c
WHERE NOT EXISTS (SELECT 1 FROM public.hr_shifts s WHERE s.country_id = c.country_id AND s.deleted_at IS NULL)
ON CONFLICT DO NOTHING;

-- ── A3. Payroll ↔ Accounting ↔ Tax reconciliation (view only) ──────────────
CREATE OR REPLACE VIEW public.hr_payroll_reconciliation_v AS
SELECT
  pr.id                         AS run_id,
  pr.run_no,
  pr.period_month,
  pr.status                     AS run_status,
  pr.country_id, pr.country_branch_id, pr.city_branch_id,
  pr.presentation_currency,
  prl.id                        AS run_line_id,
  prl.employee_id,
  e.employee_code,
  prl.gross_salary,
  prl.tax_employee,
  prl.net_salary,
  prl.currency                  AS line_currency,
  prl.exchange_rate,
  prl.local_amount,
  prl.usd_amount,
  prl.salary_due_id,
  sd.net_salary                 AS salary_due_amount,
  sd.currency                   AS salary_due_currency,
  sd.status                     AS salary_due_status,
  sd.journal_entry_id           AS salary_due_journal_entry_id,
  sd.payment_journal_entry_id   AS salary_due_payment_journal_entry_id,
  prl.accrual_roznamcha_id,
  prl.payment_roznamcha_id,
  prl.reversal_roznamcha_id,
  re_a.voucher_no               AS accrual_voucher_no,
  re_a.entry_serial             AS accrual_entry_serial,
  re_p.voucher_no               AS payment_voucher_no,
  -- Dr/Cr balance of the accrual roznamcha entry (must net to zero)
  (SELECT round(coalesce(sum(rl.debit),0) - coalesce(sum(rl.credit),0), 2)
     FROM public.roznamcha_lines rl WHERE rl.roznamcha_entry_id = prl.accrual_roznamcha_id) AS accrual_dr_minus_cr,
  (SELECT round(coalesce(sum(rl.debit),0) - coalesce(sum(rl.credit),0), 2)
     FROM public.roznamcha_lines rl WHERE rl.roznamcha_entry_id = prl.payment_roznamcha_id) AS payment_dr_minus_cr,
  CASE
    WHEN prl.accrual_roznamcha_id IS NULL THEN 'not_posted'
    WHEN coalesce((SELECT round(coalesce(sum(rl.debit),0) - coalesce(sum(rl.credit),0), 2)
      FROM public.roznamcha_lines rl WHERE rl.roznamcha_entry_id = prl.accrual_roznamcha_id), 0) = 0 THEN 'balanced'
    ELSE 'unbalanced'
  END AS accrual_balance_check
FROM public.hr_payroll_runs pr
JOIN public.hr_payroll_run_lines prl ON prl.run_id = pr.id
LEFT JOIN public.employees e            ON e.id  = prl.employee_id
LEFT JOIN public.employee_salaries_due sd ON sd.id = prl.salary_due_id
LEFT JOIN public.roznamcha_entries re_a ON re_a.id = prl.accrual_roznamcha_id
LEFT JOIN public.roznamcha_entries re_p ON re_p.id = prl.payment_roznamcha_id
WHERE pr.deleted_at IS NULL;

GRANT SELECT ON public.hr_payroll_reconciliation_v TO authenticated, service_role;
COMMENT ON VIEW public.hr_payroll_reconciliation_v IS
  'Payroll Register → Salary Due → Roznamcha (accrual/payment) → Dr/Cr balance check. Read-only join of existing records — no new accounting engine.';

-- ── A4. Employee ↔ ERP User relationship ───────────────────────────────────
-- One Person Master (customers) → one Employee → optionally one ERP User (profiles).
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'employees_user_id_fkey' AND table_name = 'employees') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id)
      REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
-- one user ↔ at most one employee
CREATE UNIQUE INDEX IF NOT EXISTS employees_user_id_uidx
  ON public.employees (user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.hr_link_employee_user(p_employee_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.employees WHERE user_id = p_user_id AND id <> p_employee_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'That ERP user is already linked to another employee.';
  END IF;
  UPDATE public.employees SET user_id = p_user_id, updated_at = now()
  WHERE id = p_employee_id AND deleted_at IS NULL;
END;
$$;
COMMENT ON FUNCTION public.hr_link_employee_user(uuid, uuid) IS
  'Links an employee to an ERP user (profiles) 1:1. Preserves the Person Master → Employee → User chain; never creates a duplicate identity.';

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260930_hr_leave_attendance_reconciliation', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
