-- =============================================================================
-- HRM Phase 3 — Employee KYC / QVC integration
-- Migration: 20260917_hr_employee_kyc.sql
--
-- Employee-side KYC on top of the existing document infrastructure. Files still
-- live in office_documents (bucket erp-documents); this layer adds:
--   * hr_employee_kyc_requirements  — the configurable required-document checklist
--   * hr_employee_kyc_documents     — one row per (employee, requirement) with
--                                     number / issue / expiry / verification state
--   * hr_employee_kyc_status_v      — per-employee completeness + missing list,
--                                     the feed for the QVC / KYC Pending queue
--
-- Non-destructive: 2 new tables + 1 view + a seed of the standard requirement
-- set. Nothing existing is modified.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_employee_kyc_requirements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL,
  label            text NOT NULL,
  country_id       uuid REFERENCES public.countries(id) ON DELETE CASCADE,  -- NULL = applies to every country
  applies_to       text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','expat','local')),
  is_mandatory     boolean NOT NULL DEFAULT true,
  requires_expiry  boolean NOT NULL DEFAULT false,
  requires_number  boolean NOT NULL DEFAULT true,
  rank_order       int NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_kyc_req_code_country_uidx
  ON public.hr_employee_kyc_requirements (lower(code), coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hr_employee_kyc_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requirement_code   text NOT NULL,
  document_type      text NOT NULL,
  document_number    text,
  issuing_authority  text,
  issue_date         date,
  expiry_date        date,
  file_url           text,
  office_document_id uuid REFERENCES public.office_documents(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','submitted','verified','rejected','expired')),
  verified_by        uuid,
  verified_at        timestamptz,
  rejection_reason   text,
  notes              text,
  country_id         uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id  uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id     uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_kyc_doc_emp_req_uidx
  ON public.hr_employee_kyc_documents (employee_id, lower(requirement_code)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hr_kyc_doc_status_idx ON public.hr_employee_kyc_documents (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hr_kyc_doc_expiry_idx ON public.hr_employee_kyc_documents (expiry_date) WHERE deleted_at IS NULL AND expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS hr_kyc_doc_scope_idx ON public.hr_employee_kyc_documents (country_id, city_branch_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.hr_employee_kyc_requirements IS 'Configurable per-country employee KYC document checklist.';
COMMENT ON TABLE public.hr_employee_kyc_documents IS 'One row per (employee, requirement): number / issue / expiry / verification state. File in office_documents.';

-- ── seed the standard requirement set (country_id NULL = global) ───────────
INSERT INTO public.hr_employee_kyc_requirements (code, label, applies_to, is_mandatory, requires_expiry, requires_number, rank_order)
VALUES
  ('passport',            'Passport',                         'all',   true,  true,  true,  10),
  ('national_id',         'National ID (Emirates ID / CNIC / Tazkira / Aadhaar)', 'all', true, true, true, 20),
  ('visa_permit',         'Visa / Residence Permit',          'expat', true,  true,  true,  30),
  ('labour_card',         'Labour / Work Permit',             'expat', true,  true,  true,  40),
  ('employment_contract', 'Signed Employment Contract',       'all',   true,  false, false, 50),
  ('bank_document',       'Bank Account Proof / IBAN Letter', 'all',   true,  false, true,  60),
  ('education_cert',      'Educational / Professional Certificate', 'all', false, false, false, 70),
  ('photo',              'Passport-size Photograph',          'all',   true,  false, false, 80),
  ('other',              'Other Country-specific Document',   'all',   false, false, false, 99)
ON CONFLICT DO NOTHING;

-- ── per-employee KYC status feed ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.hr_employee_kyc_status_v AS
WITH req AS (
  -- effective requirements per employee: global rows + country-specific rows,
  -- filtered by expat/local (expat = employee.country_id <> person nationality is
  -- unknown here, so 'expat' rows apply unless the employee is flagged local via
  -- category = 'local' — conservative: include expat rows for everyone).
  SELECT e.id AS employee_id, r.code, r.label, r.is_mandatory, r.requires_expiry, r.rank_order
  FROM public.employees e
  JOIN public.hr_employee_kyc_requirements r
    ON r.deleted_at IS NULL AND r.is_active
   AND (r.country_id IS NULL OR r.country_id = e.country_id)
  WHERE e.deleted_at IS NULL
),
doc AS (
  SELECT d.employee_id, lower(d.requirement_code) AS code, d.status, d.expiry_date, d.verified_at
  FROM public.hr_employee_kyc_documents d
  WHERE d.deleted_at IS NULL
)
SELECT
  e.id                              AS employee_id,
  e.employee_code,
  COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
  e.country_id, e.country_branch_id, e.city_branch_id,
  co.name                           AS country_name,
  count(req.code)                                                          AS required_count,
  count(req.code) FILTER (WHERE req.is_mandatory)                          AS mandatory_count,
  count(d.code) FILTER (WHERE d.status = 'verified')                       AS verified_count,
  count(d.code) FILTER (WHERE d.status IN ('submitted','pending'))         AS awaiting_count,
  count(d.code) FILTER (WHERE d.status = 'rejected')                       AS rejected_count,
  count(*) FILTER (WHERE req.requires_expiry AND d.expiry_date IS NOT NULL AND d.expiry_date <= current_date + 30) AS expiring_soon_count,
  count(*) FILTER (WHERE req.requires_expiry AND d.expiry_date IS NOT NULL AND d.expiry_date < current_date)       AS expired_count,
  count(*) FILTER (WHERE req.is_mandatory AND d.code IS NULL)              AS missing_mandatory_count,
  CASE
    WHEN count(*) FILTER (WHERE req.is_mandatory AND (d.code IS NULL OR d.status = 'rejected')) > 0 THEN 'incomplete'
    WHEN count(*) FILTER (WHERE req.is_mandatory AND d.status <> 'verified') > 0 THEN 'pending_verification'
    WHEN count(*) FILTER (WHERE req.requires_expiry AND d.expiry_date IS NOT NULL AND d.expiry_date < current_date) > 0 THEN 'expired'
    ELSE 'verified'
  END                                                                     AS kyc_status,
  (
    SELECT jsonb_agg(jsonb_build_object('code', r2.code, 'label', r2.label) ORDER BY r2.rank_order)
    FROM req r2
    LEFT JOIN doc d2 ON d2.employee_id = r2.employee_id AND d2.code = r2.code
    WHERE r2.employee_id = e.id AND r2.is_mandatory AND (d2.code IS NULL OR d2.status IN ('rejected','pending'))
  )                                                                       AS missing_items
FROM public.employees e
LEFT JOIN public.customers  c  ON c.id  = e.person_master_id
LEFT JOIN public.countries  co ON co.id = e.country_id
LEFT JOIN req ON req.employee_id = e.id
LEFT JOIN doc d ON d.employee_id = e.id AND d.code = req.code
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.employee_code, c.customer_name, c.company_name, co.name, e.country_id, e.country_branch_id, e.city_branch_id;

COMMENT ON VIEW public.hr_employee_kyc_status_v IS 'Per-employee KYC completeness + missing mandatory items — feeds the KYC / QVC Pending Verification queue.';

GRANT SELECT ON public.hr_employee_kyc_status_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.hr_employee_kyc_requirements, public.hr_employee_kyc_documents TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260917_hr_employee_kyc', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
