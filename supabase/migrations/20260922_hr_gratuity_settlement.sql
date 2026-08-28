-- =============================================================================
-- HRM Phase 8 — Gratuity & final settlement
-- Migration: 20260922_hr_gratuity_settlement.sql
--
--   * hr_gratuity_policy       — per-country end-of-service gratuity rule
--   * hr_gratuity_settlements  — the final-settlement worksheet for one employee:
--       pending salary + leave encashment + gratuity + other additions
--       − advances − other deductions = net settlement
--   * hr_calc_gratuity()       — service years + gratuity amount from joining date
--                                + last basic salary + the country policy
--
-- Non-destructive: 2 new tables + 1 function + a UAE / Pakistan sample policy.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_gratuity_policy (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id                uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name                      text NOT NULL,
  basis                     text NOT NULL DEFAULT 'basic' CHECK (basis IN ('basic','gross')),
  days_per_year_first_5     numeric(6,2) NOT NULL DEFAULT 21,
  days_per_year_after_5     numeric(6,2) NOT NULL DEFAULT 30,
  min_service_months        int NOT NULL DEFAULT 12,
  cap_months_of_salary      numeric(6,2) NOT NULL DEFAULT 24,
  resignation_scale         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- e.g. [{"up_to_years":1,"factor":0},{"up_to_years":3,"factor":0.333},{"up_to_years":5,"factor":0.667}]
  effective_from            date NOT NULL DEFAULT current_date,
  effective_to              date,
  is_active                 boolean NOT NULL DEFAULT true,
  source_reference          text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  deleted_at                timestamptz
);
CREATE INDEX IF NOT EXISTS hr_gratuity_policy_country_idx ON public.hr_gratuity_policy (country_id, effective_from DESC) WHERE deleted_at IS NULL;
-- de-dup any rows created before this unique index existed, then enforce it
DELETE FROM public.hr_gratuity_policy a USING public.hr_gratuity_policy b
  WHERE a.deleted_at IS NULL AND b.deleted_at IS NULL AND a.ctid > b.ctid
    AND a.country_id = b.country_id AND lower(a.name) = lower(b.name);
CREATE UNIQUE INDEX IF NOT EXISTS hr_gratuity_policy_country_name_uidx
  ON public.hr_gratuity_policy (country_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hr_gratuity_settlements (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id            uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  separation_id          uuid REFERENCES public.hr_employee_separations(id) ON DELETE SET NULL,
  settlement_no          text,
  calc_as_of             date NOT NULL DEFAULT current_date,
  separation_type        text,
  service_years          numeric(8,3) NOT NULL DEFAULT 0,
  last_basic_salary      numeric(18,2) NOT NULL DEFAULT 0,
  last_gross_salary      numeric(18,2) NOT NULL DEFAULT 0,
  gratuity_days          numeric(10,2) NOT NULL DEFAULT 0,
  gratuity_amount        numeric(18,2) NOT NULL DEFAULT 0,
  leave_encashment_days  numeric(8,2) NOT NULL DEFAULT 0,
  leave_encashment_amount numeric(18,2) NOT NULL DEFAULT 0,
  pending_salary_amount  numeric(18,2) NOT NULL DEFAULT 0,
  notice_pay_amount      numeric(18,2) NOT NULL DEFAULT 0,
  other_additions        numeric(18,2) NOT NULL DEFAULT 0,
  advance_deduction      numeric(18,2) NOT NULL DEFAULT 0,
  other_deductions       numeric(18,2) NOT NULL DEFAULT 0,
  net_settlement         numeric(18,2) NOT NULL DEFAULT 0,
  currency               text NOT NULL DEFAULT 'USD',
  exchange_rate          numeric(18,8) NOT NULL DEFAULT 1,
  local_amount           numeric(18,2) NOT NULL DEFAULT 0,
  usd_amount             numeric(18,2) NOT NULL DEFAULT 0,
  status                 text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','calculated','approved','paid','cancelled')),
  approved_by            uuid,
  approved_at            timestamptz,
  paid_roznamcha_id      uuid REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL,
  paid_at               timestamptz,
  country_id             uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id      uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id         uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  notes                  text,
  created_by             uuid,
  updated_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_gratuity_settlements_emp_active_uidx
  ON public.hr_gratuity_settlements (employee_id)
  WHERE deleted_at IS NULL AND status IN ('draft','calculated','approved');
CREATE INDEX IF NOT EXISTS hr_gratuity_settlements_scope_idx ON public.hr_gratuity_settlements (country_id, city_branch_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.hr_gratuity_policy IS 'Per-country end-of-service gratuity rule (days/year, resignation scale, salary cap).';
COMMENT ON TABLE public.hr_gratuity_settlements IS 'Final-settlement worksheet: pending salary + leave encashment + gratuity − advances − deductions = net.';

CREATE OR REPLACE VIEW public.hr_gratuity_settlements_v AS
SELECT s.*, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
       e.joining_date, co.name AS country_name
FROM public.hr_gratuity_settlements s
JOIN public.employees e ON e.id = s.employee_id
LEFT JOIN public.customers c ON c.id = e.person_master_id
LEFT JOIN public.countries co ON co.id = s.country_id
WHERE s.deleted_at IS NULL;

-- ── gratuity computation ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_calc_gratuity(
  p_employee_id uuid, p_as_of date DEFAULT current_date,
  p_separation_type text DEFAULT 'end_of_contract'
) RETURNS TABLE (service_years numeric, gratuity_days numeric, gratuity_amount numeric, basis_salary numeric)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  e            record;
  v_years      numeric;
  v_first5     numeric;
  v_after5     numeric;
  v_days       numeric;
  v_daily      numeric;
  v_amount     numeric;
  v_basis      numeric;
  v_factor     numeric := 1;
  scale        jsonb;
  p_basis        text    := 'basic';
  p_first5       numeric := 21;
  p_after5       numeric := 30;
  p_min_months   int     := 12;
  p_cap_months   numeric := 24;
  p_res_scale    jsonb   := '[]'::jsonb;
BEGIN
  SELECT * INTO e FROM public.employees WHERE id = p_employee_id AND deleted_at IS NULL;
  IF NOT FOUND OR e.joining_date IS NULL THEN
    service_years := 0; gratuity_days := 0; gratuity_amount := 0; basis_salary := 0; RETURN NEXT; RETURN;
  END IF;

  v_years := round((p_as_of - e.joining_date)::numeric / 365.25, 3);  -- date - date = integer days

  DECLARE pol record;
  BEGIN
    SELECT basis, days_per_year_first_5, days_per_year_after_5, min_service_months, cap_months_of_salary, resignation_scale
      INTO pol
    FROM public.hr_gratuity_policy
    WHERE deleted_at IS NULL AND is_active AND country_id = e.country_id
      AND effective_from <= p_as_of AND (effective_to IS NULL OR effective_to >= p_as_of)
    ORDER BY effective_from DESC LIMIT 1;
    IF FOUND THEN
      p_basis := pol.basis; p_first5 := pol.days_per_year_first_5; p_after5 := pol.days_per_year_after_5;
      p_min_months := pol.min_service_months; p_cap_months := pol.cap_months_of_salary; p_res_scale := pol.resignation_scale;
    ELSE
      -- fall back to the latest active policy for the country regardless of effective date
      SELECT basis, days_per_year_first_5, days_per_year_after_5, min_service_months, cap_months_of_salary, resignation_scale
        INTO pol
      FROM public.hr_gratuity_policy
      WHERE deleted_at IS NULL AND is_active AND country_id = e.country_id
      ORDER BY effective_from DESC LIMIT 1;
      IF FOUND THEN
        p_basis := pol.basis; p_first5 := pol.days_per_year_first_5; p_after5 := pol.days_per_year_after_5;
        p_min_months := pol.min_service_months; p_cap_months := pol.cap_months_of_salary; p_res_scale := pol.resignation_scale;
      END IF;
    END IF;
  END;

  v_basis := CASE p_basis WHEN 'gross'
    THEN COALESCE(e.monthly_salary, e.basic_salary, 0)
    ELSE COALESCE(e.basic_salary, e.monthly_salary, 0) END;

  IF v_years * 12 < p_min_months THEN
    service_years := v_years; gratuity_days := 0; gratuity_amount := 0; basis_salary := v_basis; RETURN NEXT; RETURN;
  END IF;

  v_first5 := LEAST(v_years, 5) * p_first5;
  v_after5 := GREATEST(v_years - 5, 0) * p_after5;
  v_days   := v_first5 + v_after5;

  -- resignation scale (factor by completed years)
  IF p_separation_type = 'resignation' AND jsonb_array_length(COALESCE(p_res_scale, '[]'::jsonb)) > 0 THEN
    v_factor := 0;
    FOR scale IN SELECT value FROM jsonb_array_elements(p_res_scale) ORDER BY (value->>'up_to_years')::numeric
    LOOP
      v_factor := (scale->>'factor')::numeric;
      IF v_years <= (scale->>'up_to_years')::numeric THEN EXIT; END IF;
    END LOOP;
  END IF;

  v_daily  := v_basis / 30.0;
  v_amount := round(v_days * v_daily * v_factor, 2);
  -- cap at N months of the basis salary
  v_amount := LEAST(v_amount, round(p_cap_months * v_basis, 2));

  service_years := v_years;
  gratuity_days := round(v_days * v_factor, 2);
  gratuity_amount := v_amount;
  basis_salary := v_basis;
  RETURN NEXT;
END;
$$;

GRANT SELECT ON public.hr_gratuity_settlements_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.hr_gratuity_policy, public.hr_gratuity_settlements TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hr_calc_gratuity(uuid, date, text) TO authenticated, service_role;

-- sample policies
INSERT INTO public.hr_gratuity_policy (country_id, name, basis, days_per_year_first_5, days_per_year_after_5, min_service_months, cap_months_of_salary, resignation_scale, source_reference)
SELECT c.id, 'UAE end-of-service gratuity', 'basic', 21, 30, 12, 24,
  '[{"up_to_years":1,"factor":0},{"up_to_years":3,"factor":0.333},{"up_to_years":5,"factor":0.667},{"up_to_years":100,"factor":1}]'::jsonb,
  'UAE Labour Law — 21 days basic wage per year for the first 5 years, 30 days thereafter; reduced on resignation before 5 years.'
FROM public.countries c WHERE c.iso2 = 'AE' OR lower(c.name) LIKE '%united arab emirates%'
ON CONFLICT DO NOTHING;

INSERT INTO public.hr_gratuity_policy (country_id, name, basis, days_per_year_first_5, days_per_year_after_5, min_service_months, cap_months_of_salary, source_reference)
SELECT c.id, 'Pakistan gratuity (30 days/year)', 'basic', 30, 30, 12, 100,
  'Payment of Wages / company policy — 30 days last drawn wages for every completed year of service.'
FROM public.countries c WHERE c.iso2 = 'PK' OR lower(c.name) LIKE '%pakistan%'
ON CONFLICT DO NOTHING;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260922_hr_gratuity_settlement', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
