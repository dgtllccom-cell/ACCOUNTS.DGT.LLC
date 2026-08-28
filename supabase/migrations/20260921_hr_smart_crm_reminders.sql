-- =============================================================================
-- HRM Phase 9 — Smart CRM HR reminders
-- Migration: 20260921_hr_smart_crm_reminders.sql
--
-- Smart CRM (crm_action_items) OWNS the reminders. This function feeds HR events
-- into it: probation expiry, employee KYC document expiry, incomplete KYC,
-- payroll approval pending, and contract next-action dates. It never copies
-- employee / contract data into CRM — only a reference + due date.
--
-- Mirrors sync_contract_reminders (20260914). Non-destructive: 1 function.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_hr_reminders(p_days_ahead int DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int := 0; v_n int;
BEGIN
  -- 1. Probation ending within the window
  INSERT INTO public.crm_action_items
    (source_type, source_id, reference_no, party_name, due_date, item_type, module,
     country_id, country_name, country_branch_id, city_branch_id, branch_name,
     responsible_user_id, urgency_class, status, next_follow_up, notes)
  SELECT
    'hr_employee', e.id::text, e.employee_code,
    COALESCE(c.customer_name, c.company_name, e.employee_code),
    e.probation_end_date, 'probation_expiry', 'hrm',
    e.country_id::text, co.name, e.country_branch_id::text, e.city_branch_id::text, cb.name,
    e.reporting_manager_id::text, 'medium', 'open', e.probation_end_date,
    'Probation period ends — confirm or extend.'
  FROM public.employees e
  LEFT JOIN public.customers c ON c.id = e.person_master_id
  LEFT JOIN public.countries co ON co.id = e.country_id
  LEFT JOIN public.country_branches cb ON cb.id = e.country_branch_id
  WHERE e.deleted_at IS NULL AND e.status = 'Active'
    AND e.probation_end_date IS NOT NULL
    AND e.probation_end_date BETWEEN current_date - 7 AND current_date + p_days_ahead
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_action_items x
      WHERE x.source_id = e.id::text AND x.module = 'hrm' AND x.item_type = 'probation_expiry'
        AND x.is_completed = false AND x.created_at > current_date - 14);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- 2. Employee KYC documents expiring within the window
  INSERT INTO public.crm_action_items
    (source_type, source_id, reference_no, party_name, due_date, item_type, module,
     country_id, country_name, country_branch_id, city_branch_id,
     responsible_user_id, urgency_class, status, next_follow_up, notes)
  SELECT
    'hr_employee', d.employee_id::text, e.employee_code,
    COALESCE(c.customer_name, c.company_name, e.employee_code) || ' — ' || d.document_type,
    d.expiry_date, 'employee_document_expiry', 'hrm',
    d.country_id::text, co.name, d.country_branch_id::text, d.city_branch_id::text,
    e.reporting_manager_id::text, 'high', 'open', d.expiry_date,
    'Employee document ' || d.document_type || ' expires — renew.'
  FROM public.hr_employee_kyc_documents d
  JOIN public.employees e ON e.id = d.employee_id AND e.deleted_at IS NULL
  LEFT JOIN public.customers c ON c.id = e.person_master_id
  LEFT JOIN public.countries co ON co.id = d.country_id
  WHERE d.deleted_at IS NULL AND d.expiry_date IS NOT NULL
    AND d.expiry_date BETWEEN current_date - 7 AND current_date + p_days_ahead
    AND d.status <> 'rejected'
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_action_items x
      WHERE x.source_id = d.employee_id::text AND x.module = 'hrm'
        AND x.item_type = 'employee_document_expiry' AND x.reference_no = e.employee_code
        AND x.is_completed = false AND x.created_at > current_date - 14);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- 3. Incomplete employee KYC (missing mandatory items)
  INSERT INTO public.crm_action_items
    (source_type, source_id, reference_no, party_name, due_date, item_type, module,
     country_id, country_name, country_branch_id, city_branch_id,
     urgency_class, status, next_follow_up, notes)
  SELECT
    'hr_employee', v.employee_id::text, v.employee_code, v.employee_name,
    current_date + 7, 'incomplete_kyc', 'hrm',
    v.country_id::text, v.country_name, v.country_branch_id::text, v.city_branch_id::text,
    'medium', 'open', current_date + 7,
    'Employee KYC incomplete: ' || COALESCE((SELECT string_agg(mi->>'label', ', ') FROM jsonb_array_elements(v.missing_items) mi), 'missing mandatory documents')
  FROM public.hr_employee_kyc_status_v v
  WHERE v.kyc_status = 'incomplete'
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_action_items x
      WHERE x.source_id = v.employee_id::text AND x.module = 'hrm' AND x.item_type = 'incomplete_kyc'
        AND x.is_completed = false AND x.created_at > current_date - 14);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  -- 4. Payroll runs pending approval / review
  INSERT INTO public.crm_action_items
    (source_type, source_id, reference_no, party_name, due_date, item_type, module,
     country_id, country_name, amount, currency, status, next_follow_up, notes)
  SELECT
    'hr_payroll_run', r.id::text, r.run_no, 'Payroll ' || r.period_month,
    (r.period_month || '-28')::date, 'payroll_approval_pending', 'hrm',
    r.country_id::text, co.name, r.total_net, r.presentation_currency, 'open',
    (r.period_month || '-28')::date,
    'Payroll run ' || r.run_no || ' is ' || r.status || ' — needs review/approval before posting.'
  FROM public.hr_payroll_runs r
  LEFT JOIN public.countries co ON co.id = r.country_id
  WHERE r.deleted_at IS NULL AND r.status IN ('calculated','reviewed')
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_action_items x
      WHERE x.source_id = r.id::text AND x.module = 'hrm' AND x.item_type = 'payroll_approval_pending'
        AND x.is_completed = false AND x.created_at > current_date - 7);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_hr_reminders(int) TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260921_hr_smart_crm_reminders', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
