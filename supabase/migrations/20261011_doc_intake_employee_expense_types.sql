-- Migration: 20261011_doc_intake_employee_expense_types.sql
-- AI Document Intake — Employee KYC and Expense document types routed at the
-- Employee (HR) and Expense Bill workflows. Additive & idempotent.

BEGIN;

INSERT INTO public.document_type_registry
  (code, name, operational_domain, category, target_module, expected_fields,
   classifier_keywords, min_confidence, requires_qvc, is_active, rank_order)
SELECT v.code, v.name, v.operational_domain, v.category, v.target_module,
       v.expected_fields::jsonb, v.classifier_keywords::text[], v.min_confidence,
       v.requires_qvc, true, v.rank_order
FROM (VALUES
  (
    'employee_kyc',
    'Employee ID / Contract Document',
    'business', 'other', 'employees',
    '[{"key":"customer_name","label":"Employee Name","required":true},
      {"key":"father_name","label":"Father / Guardian Name"},
      {"key":"national_id","label":"National ID / Passport No.","required":true},
      {"key":"contract_start_date","label":"Joining / Contract Start Date"},
      {"key":"contract_end_date","label":"Contract End Date"},
      {"key":"phone","label":"Phone"},
      {"key":"email","label":"Email"},
      {"key":"address","label":"Address"},
      {"key":"grand_total","label":"Basic Salary"},
      {"key":"currency","label":"Salary Currency"}]',
    ARRAY['employment contract','offer letter','appointment letter','staff id','employee id',
          'joining date','date of joining','basic salary','labour contract','iqama'],
    0.35, true, 570
  ),
  (
    'expense_invoice',
    'Expense Bill / Vendor Invoice',
    'business', 'finance', 'expenses',
    '[{"key":"invoice_number","label":"Bill / Invoice No."},
      {"key":"document_date","label":"Bill Date","required":true},
      {"key":"supplier_name","label":"Vendor / Payee"},
      {"key":"grand_total","label":"Amount","required":true},
      {"key":"currency","label":"Currency"},
      {"key":"tax_amount","label":"Tax / VAT"},
      {"key":"exchange_rate","label":"Exchange Rate"}]',
    ARRAY['expense','utility bill','rent invoice','office expense','petty cash','vendor invoice',
          'reimbursement','tax invoice','bill to'],
    0.35, true, 580
  )
) AS v(code, name, operational_domain, category, target_module, expected_fields,
       classifier_keywords, min_confidence, requires_qvc, rank_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_type_registry r
  WHERE lower(r.code) = lower(v.code) AND r.country_id IS NULL AND r.deleted_at IS NULL
);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261011_doc_intake_employee_expense_types', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
