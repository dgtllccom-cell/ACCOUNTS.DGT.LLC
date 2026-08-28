-- =============================================================================
-- HRM Phase 6 — All-Countries payroll tax configuration
-- Migration: 20260920_hr_payroll_tax_config.sql
--
-- Payroll tax / statutory contributions are configured PER COUNTRY here — this is
-- genuinely missing (tax_codes / uae_tax_rules are Purchase/Sales VAT and must NOT
-- be mixed with payroll). Salary tax lines get their OWN payable ledgers and their
-- own report; they never appear in a VAT return.
--
--   * hr_payroll_tax_config — one row per (country, component), versioned by
--                             effective_from; flat % / fixed / slab methods
--   * hr_payroll_tax_for()  — returns {employee_tax, employer_contribution} for a
--                             given country + gross + basic + month
--
-- Non-destructive: 1 new table + 1 function + a UAE(0%) / Pakistan sample seed.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_payroll_tax_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id          uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name                text NOT NULL,
  component_type      text NOT NULL CHECK (component_type IN
                        ('income_tax','social_security_employee','social_security_employer',
                         'pension_employee','pension_employer','other_employee_deduction','other_employer_contribution')),
  payer               text NOT NULL CHECK (payer IN ('employee','employer')),
  calc_method         text NOT NULL DEFAULT 'flat_percent' CHECK (calc_method IN ('flat_percent','fixed_amount','slab')),
  applies_to          text NOT NULL DEFAULT 'gross' CHECK (applies_to IN ('gross','basic','taxable')),
  rate_percent        numeric(9,4) NOT NULL DEFAULT 0,
  fixed_amount        numeric(18,2) NOT NULL DEFAULT 0,
  slabs               jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ "up_to": 50000, "percent": 5, "plus_fixed": 0 }, ...]
  monthly_exemption   numeric(18,2) NOT NULL DEFAULT 0,
  annual_exemption    numeric(18,2) NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'USD',
  ledger_id           uuid REFERENCES public.ledgers(id) ON DELETE SET NULL,
  effective_from      date NOT NULL DEFAULT current_date,
  effective_to        date,
  filing_frequency    text NOT NULL DEFAULT 'monthly' CHECK (filing_frequency IN ('monthly','quarterly','annual')),
  is_active           boolean NOT NULL DEFAULT true,
  source_reference    text,
  notes               text,
  created_by          uuid,
  updated_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS hr_payroll_tax_config_country_idx
  ON public.hr_payroll_tax_config (country_id, component_type, effective_from DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.hr_payroll_tax_config IS
  'Per-country payroll tax / statutory contribution configuration. Separate from Purchase/Sales VAT (tax_codes / uae_tax_rules) — salary tax never enters a VAT return.';

CREATE OR REPLACE VIEW public.hr_payroll_tax_config_v AS
SELECT t.*, co.name AS country_name, l.code AS ledger_code, l.name AS ledger_name
FROM public.hr_payroll_tax_config t
LEFT JOIN public.countries co ON co.id = t.country_id
LEFT JOIN public.ledgers   l  ON l.id  = t.ledger_id
WHERE t.deleted_at IS NULL;

-- ── computation function ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hr_payroll_tax_for(
  p_country_id uuid, p_gross numeric, p_basic numeric, p_month text DEFAULT NULL
) RETURNS TABLE (employee_tax numeric, employer_contribution numeric)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  r          record;
  v_base     numeric;
  v_amount   numeric;
  v_emp      numeric := 0;
  v_er       numeric := 0;
  v_as_of    date := COALESCE(NULLIF(p_month,'') || '-01', current_date::text)::date;
  slab       jsonb;
  v_prev_cap numeric;
  v_slab_amt numeric;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (component_type) *
    FROM public.hr_payroll_tax_config
    WHERE deleted_at IS NULL AND is_active AND country_id = p_country_id
      AND effective_from <= v_as_of
      AND (effective_to IS NULL OR effective_to >= v_as_of)
    ORDER BY component_type, effective_from DESC
  LOOP
    v_base := CASE r.applies_to WHEN 'basic' THEN COALESCE(p_basic,0) ELSE COALESCE(p_gross,0) END;
    v_base := GREATEST(0, v_base - r.monthly_exemption);

    IF r.calc_method = 'fixed_amount' THEN
      v_amount := r.fixed_amount;
    ELSIF r.calc_method = 'flat_percent' THEN
      v_amount := round(v_base * r.rate_percent / 100.0, 2);
    ELSE  -- slab
      v_amount := 0; v_prev_cap := 0;
      FOR slab IN SELECT * FROM jsonb_array_elements(r.slabs)
      LOOP
        v_slab_amt := LEAST(v_base, COALESCE((slab->>'up_to')::numeric, v_base)) - v_prev_cap;
        IF v_slab_amt > 0 THEN
          v_amount := v_amount + round(v_slab_amt * COALESCE((slab->>'percent')::numeric,0) / 100.0, 2)
                              + COALESCE((slab->>'plus_fixed')::numeric,0);
        END IF;
        v_prev_cap := COALESCE((slab->>'up_to')::numeric, v_base);
        EXIT WHEN v_base <= v_prev_cap;
      END LOOP;
    END IF;

    IF r.payer = 'employee' THEN v_emp := v_emp + GREATEST(0, v_amount);
    ELSE                         v_er  := v_er  + GREATEST(0, v_amount);
    END IF;
  END LOOP;

  employee_tax := v_emp;
  employer_contribution := v_er;
  RETURN NEXT;
END;
$$;

-- ── sample seed (safe: 0% / illustrative, versioned) ───────────────────────
INSERT INTO public.hr_payroll_tax_config (country_id, name, component_type, payer, calc_method, applies_to, rate_percent, currency, source_reference, notes)
SELECT c.id, 'UAE — no personal income tax', 'income_tax', 'employee', 'flat_percent', 'gross', 0, 'AED',
       'FTA — UAE levies no personal income tax on salaries', 'Placeholder 0% row so the payroll engine has an explicit UAE rule.'
FROM public.countries c WHERE lower(c.name) LIKE '%united arab emirates%' OR c.iso2 = 'AE'
ON CONFLICT DO NOTHING;

GRANT SELECT ON public.hr_payroll_tax_config_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.hr_payroll_tax_config TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hr_payroll_tax_for(uuid, numeric, numeric, text) TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260920_hr_payroll_tax_config', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
