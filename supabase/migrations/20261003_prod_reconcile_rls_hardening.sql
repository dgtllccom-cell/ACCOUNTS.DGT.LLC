-- Production schema reconciliation — RLS hardening for the HRM / Doc Intelligence /
-- clearing / contract / settlement release tables.
--
-- DEV (the verified target) has RLS ENABLED on every one of these tables; the
-- feature migrations that create them do not `ENABLE ROW LEVEL SECURITY`, and
-- some tables that predate this release were also left RLS-off on production.
-- The application reaches all of them through the service-role `withLocalPg`
-- connection (which bypasses RLS) and enforces country/branch scope in code, so
-- enabling RLS changes NO application behaviour — it only closes the PostgREST
-- (`anon` / `authenticated`) direct-read hole, matching DEV exactly.
--
-- Fully idempotent and reversible (`DISABLE ROW LEVEL SECURITY`). No data touched.

BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_settings','bank_cheque_transactions','business_shipping_handovers',
    'clearing_customer_order_parties','clearing_customer_orders','company_registration_types',
    'contract_followups','contract_register_audit','document_intake_drafts','document_intake_events',
    'document_intake_fields','document_intake_jobs','document_intake_line_items','document_intake_matches',
    'document_type_registry','document_types','employee_advances_loans','employee_salaries_due','employees',
    'erp_document_versions','erp_documents','external_form_links','hr_attendance_corrections',
    'hr_checklist_templates','hr_departments','hr_designations','hr_employee_checklist',
    'hr_employee_currency_audit','hr_employee_kyc_documents','hr_employee_kyc_requirements',
    'hr_employee_leave_balances','hr_employee_position_events','hr_employee_separations',
    'hr_employee_transfers','hr_gratuity_policy','hr_gratuity_settlements','hr_holidays','hr_leave_types',
    'hr_payroll_run_events','hr_payroll_run_lines','hr_payroll_runs','hr_payroll_tax_config','hr_shifts',
    'office_assets','office_attendance','office_leave_requests','purchase_loading_batches',
    'stock_movements','translation_field_registry'
  ]
  LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- scoped policies that DEV carries (the other tables are service-role-only:
-- RLS on, no policy = deny-all for anon/authenticated)
DROP POLICY IF EXISTS employees_scope_read ON public.employees;
CREATE POLICY employees_scope_read ON public.employees FOR SELECT
  USING (((country_id IS NULL) AND is_super_admin()) OR ((country_id IS NOT NULL) AND can_access_country(country_id)));
DROP POLICY IF EXISTS employees_scope_insert ON public.employees;
CREATE POLICY employees_scope_insert ON public.employees FOR INSERT
  WITH CHECK (((country_id IS NULL) AND is_super_admin()) OR ((country_id IS NOT NULL) AND can_access_country(country_id)));
DROP POLICY IF EXISTS employees_scope_update ON public.employees;
CREATE POLICY employees_scope_update ON public.employees FOR UPDATE
  USING (((country_id IS NULL) AND is_super_admin()) OR ((country_id IS NOT NULL) AND can_access_country(country_id)))
  WITH CHECK (((country_id IS NULL) AND is_super_admin()) OR ((country_id IS NOT NULL) AND can_access_country(country_id)));

DROP POLICY IF EXISTS employee_advances_loans_scope_all ON public.employee_advances_loans;
CREATE POLICY employee_advances_loans_scope_all ON public.employee_advances_loans FOR ALL
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_advances_loans.employee_id
    AND (((e.country_id IS NULL) AND is_super_admin()) OR ((e.country_id IS NOT NULL) AND can_access_country(e.country_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_advances_loans.employee_id
    AND (((e.country_id IS NULL) AND is_super_admin()) OR ((e.country_id IS NOT NULL) AND can_access_country(e.country_id)))));

DROP POLICY IF EXISTS employee_salaries_due_scope_all ON public.employee_salaries_due;
CREATE POLICY employee_salaries_due_scope_all ON public.employee_salaries_due FOR ALL
  USING (((country_id IS NULL) AND is_super_admin()) OR ((country_id IS NOT NULL) AND can_access_country(country_id)))
  WITH CHECK (((country_id IS NULL) AND is_super_admin()) OR ((country_id IS NOT NULL) AND can_access_country(country_id)));

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261003_prod_reconcile_rls_hardening', 'applied')
ON CONFLICT (name) DO UPDATE SET status='applied', applied_at=NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
