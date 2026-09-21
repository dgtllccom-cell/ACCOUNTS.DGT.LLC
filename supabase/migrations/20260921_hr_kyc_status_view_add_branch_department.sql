-- Adds real branch/department display columns to hr_employee_kyc_status_v
-- (read-only view extension, no accounting/business logic touched). Needed
-- by the redesigned Employee KYC / QVC register so its Branch and Department
-- columns/filters show real data instead of a hardcoded sample list.

BEGIN;

CREATE OR REPLACE VIEW public.hr_employee_kyc_status_v AS
WITH req AS (
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
  )                                                                       AS missing_items,
  cib.city_name                     AS city_branch_name,
  cb.name                           AS country_branch_name,
  COALESCE(hd.name, e.department)   AS department_name
FROM public.employees e
LEFT JOIN public.customers  c  ON c.id  = e.person_master_id
LEFT JOIN public.countries  co ON co.id = e.country_id
LEFT JOIN public.country_branches cb ON cb.id = e.country_branch_id
LEFT JOIN public.city_branches cib ON cib.id = e.city_branch_id
LEFT JOIN public.hr_departments hd ON hd.id = e.hr_department_id
LEFT JOIN req ON req.employee_id = e.id
LEFT JOIN doc d ON d.employee_id = e.id AND d.code = req.code
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.employee_code, c.customer_name, c.company_name, co.name, e.country_id, e.country_branch_id, e.city_branch_id,
  cib.city_name, cb.name, hd.name, e.department;

COMMENT ON VIEW public.hr_employee_kyc_status_v IS 'Per-employee KYC completeness + missing mandatory items — feeds the KYC / QVC Pending Verification queue. Adds branch/department display columns (read-only).';

GRANT SELECT ON public.hr_employee_kyc_status_v TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('hr_kyc_status_view_add_branch_department', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;
