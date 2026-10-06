-- Migration: 20261009_doc_intake_master_document_types.sql
-- Extend the AI Document Intake document-type registry so a document can also
-- prepare a REVIEWED DRAFT for the General-Office masters (Company, Customer,
-- Bank, Contract), reusing the same OCR → classify → extract → review → draft
-- engine. No master row is written by this — the human still opens the master's
-- own form and chooses Link / Update / Create-new. Additive & idempotent.

BEGIN;

-- 1. Route existing KYC / identity documents at the Customer master.
UPDATE public.document_type_registry
SET target_module = 'customers', updated_at = now()
WHERE lower(code) = 'kyc_document' AND deleted_at IS NULL AND target_module IS DISTINCT FROM 'customers';

-- 2. New master document types (global — country_id NULL).
INSERT INTO public.document_type_registry
  (code, name, operational_domain, category, target_module, expected_fields,
   classifier_keywords, min_confidence, requires_qvc, is_active, rank_order)
SELECT v.code, v.name, v.operational_domain, v.category, v.target_module,
       v.expected_fields::jsonb, v.classifier_keywords::text[], v.min_confidence,
       v.requires_qvc, true, v.rank_order
FROM (VALUES
  (
    'company_registration',
    'Company Registration / Trade License',
    'business', 'other', 'companies',
    '[{"key":"company_name","label":"Company / Entity Name","required":true},
      {"key":"company_type","label":"Legal Structure"},
      {"key":"registration_number","label":"Registration / License No.","required":true},
      {"key":"trn","label":"Tax Registration (TRN / NTN)"},
      {"key":"incorporation_date","label":"Incorporation / Issue Date"},
      {"key":"owner_name","label":"Owner / Manager"},
      {"key":"address","label":"Registered Address"},
      {"key":"phone","label":"Phone"},
      {"key":"email","label":"Email"},
      {"key":"website","label":"Website"},
      {"key":"currency","label":"Base Currency"}]',
    ARRAY['trade license','commercial registration','certificate of incorporation','memorandum of association',
          'company registration','establishment card','license no','registered name','legal name','moa'],
    0.35, true, 540
  ),
  (
    'bank_account_document',
    'Bank Account Document / Statement Header',
    'both', 'finance', 'banks',
    '[{"key":"bank_name","label":"Bank Name","required":true},
      {"key":"branch_name","label":"Branch"},
      {"key":"account_title","label":"Account Title / Holder","required":true},
      {"key":"account_number","label":"Account Number","required":true},
      {"key":"iban","label":"IBAN"},
      {"key":"swift_bic","label":"SWIFT / BIC"},
      {"key":"currency","label":"Account Currency"},
      {"key":"address","label":"Branch Address"}]',
    ARRAY['bank statement','account opening','iban certificate','account details','a/c no','account title',
          'swift code','bank certificate','statement of account'],
    0.35, true, 550
  ),
  (
    'service_agreement',
    'Service Agreement / Contract',
    'business', 'other', 'contracts',
    '[{"key":"contract_number","label":"Contract / Agreement No."},
      {"key":"company_name","label":"Counterparty","required":true},
      {"key":"contract_start_date","label":"Effective / Start Date","required":true},
      {"key":"contract_end_date","label":"Expiry / End Date"},
      {"key":"grand_total","label":"Contract Value"},
      {"key":"currency","label":"Currency"},
      {"key":"payment_terms","label":"Payment Terms"}]',
    ARRAY['agreement','service agreement','contract agreement','memorandum of understanding','mou',
          'this agreement is made','by and between','terms and conditions','effective date','hereinafter referred'],
    0.35, true, 560
  )
) AS v(code, name, operational_domain, category, target_module, expected_fields,
       classifier_keywords, min_confidence, requires_qvc, rank_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_type_registry r
  WHERE lower(r.code) = lower(v.code) AND r.country_id IS NULL AND r.deleted_at IS NULL
);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261009_doc_intake_master_document_types', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
