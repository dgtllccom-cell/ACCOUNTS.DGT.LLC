-- Pakistan Annual Income/Corporate Tax and Monthly Sales Tax — two SEPARATE
-- new modules (mirroring the existing UAE Corporate Tax module's proven
-- architecture: draft -> in_preparation -> ready_for_review -> reviewed ->
-- filed -> paid, four-eyes review, event audit trail, ERP does NOT file with
-- FBR — 'filed'/'paid' only record the IRIS/e-FBR reference).
--
-- Reuses public.uae_tax_entities for entity registration (it is already
-- generic: id/country_id/company_id/trn/legal_name/filing_frequency — "trn"
-- doubles as NTN/STRN here; the table name predates this reuse but its
-- schema was never UAE-specific) instead of a duplicate entity table.
--
-- RATES: every rate this migration ships as a seed default is sourced from
-- the primary legal text (cited inline) and is NOT trusted as authoritative
-- by the application — every return has accountant_confirmed (boolean,
-- default false) + accountant_confirmed_by + accountant_confirmed_at, and
-- the service layer (see lib/services/pk-income-tax-service.ts /
-- pk-sales-tax-service.ts) blocks a return from leaving draft/in_preparation
-- until a real user explicitly confirms the rate applied. No filing result,
-- accounting profit, or turnover figure is ever computed or invented by
-- this migration or its application code.
--
-- Sources (fetched and read directly from FBR's own document repository,
-- not secondary summaries):
--   - Income Tax Ordinance, 2001, First Schedule Part I, Division II & IIB
--     (download1.fbr.gov.pk, consolidated text amended up to 20 Feb 2026):
--     standard company rate 29%, small company 20%, banking company 44%
--     (TY2025) / 43% (TY2026) / 42% (TY2027 onward), Super Tax on high
--     earners (Section 4C) 0-4% bracketed on income >Rs.150m.
--   - Sales Tax Act, 1990, Section 3(1) (download1.fbr.gov.pk, consolidated
--     text updated up to 2025-26): standard rate 18% ("Substituted for
--     seventeen vide Finance (Supplementary) Act, 2023").
-- Additive & idempotent.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Pakistan Annual Income / Corporate Tax
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pk_income_tax_returns (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no                text NOT NULL,
  tax_entity_id            uuid NOT NULL REFERENCES public.uae_tax_entities(id),
  company_id               uuid REFERENCES public.companies(id),
  country_id               uuid NOT NULL REFERENCES public.countries(id),
  ntn                      text,                                    -- National Tax Number
  tax_year                 int NOT NULL CHECK (tax_year >= 2020 AND tax_year <= 2100),
  company_type             text NOT NULL DEFAULT 'other' CHECK (company_type IN ('small', 'banking', 'other')),
  filing_deadline          date NOT NULL,
  status                   text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','in_preparation','ready_for_review','reviewed','filed','paid','cancelled')),
  taxable_income           numeric(18,2),
  taxable_income_source    text,                                    -- e.g. 'Audited financial statements FY2025-26, computed per accountant'
  turnover                 numeric(18,2),                            -- for minimum-tax comparison (Section 113)
  super_tax_income         numeric(18,2),                            -- income under section 4C, if applicable
  super_tax_amount         numeric(18,2) NOT NULL DEFAULT 0,         -- manually entered — bracket table is a documented reference, not auto-applied
  rate_applied             numeric(6,4),                             -- the % actually used for this return (recorded, not silently assumed later)
  rate_source_note         text,                                     -- citation shown to the preparer at computation time
  normal_tax               numeric(18,2),
  minimum_tax              numeric(18,2),
  tax_payable              numeric(18,2),
  computed_at              timestamptz,
  accountant_confirmed     boolean NOT NULL DEFAULT false,
  accountant_confirmed_by  uuid,
  accountant_confirmed_at  timestamptz,
  responsible_user_id      uuid,
  reminder_task_id         uuid REFERENCES public.user_tasks(id),
  filing_reference         text,                                     -- IRIS acknowledgement / reference number
  filed_at                 timestamptz,
  filed_by                 uuid,
  payment_reference        text,
  paid_amount              numeric(18,2),
  paid_at                  timestamptz,
  notes                    text,
  created_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at                timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS pk_income_tax_returns_no_uq ON public.pk_income_tax_returns (return_no);
CREATE UNIQUE INDEX IF NOT EXISTS pk_income_tax_returns_entity_year_uq ON public.pk_income_tax_returns (tax_entity_id, tax_year)
  WHERE deleted_at IS NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS pk_income_tax_returns_deadline_idx ON public.pk_income_tax_returns (filing_deadline)
  WHERE deleted_at IS NULL AND status NOT IN ('filed','paid','cancelled');

CREATE TABLE IF NOT EXISTS public.pk_income_tax_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    uuid NOT NULL REFERENCES public.pk_income_tax_returns(id) ON DELETE CASCADE,
  action       text NOT NULL,
  from_status  text,
  to_status    text,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id     uuid,
  actor_name   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pk_income_tax_events_idx ON public.pk_income_tax_events (return_id, created_at DESC);

COMMENT ON TABLE public.pk_income_tax_returns IS
  'Pakistan annual Income/Corporate Tax return working per tax entity + tax year. Filing/payment are recorded references only — the ERP does not submit to FBR/IRIS. Rates are seed defaults sourced from the Income Tax Ordinance 2001 First Schedule (see migration header) and MUST be accountant_confirmed before a return can leave draft/in_preparation.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Pakistan Monthly Sales Tax
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pk_sales_tax_returns (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no                text NOT NULL,
  tax_entity_id            uuid NOT NULL REFERENCES public.uae_tax_entities(id),
  company_id               uuid REFERENCES public.companies(id),
  country_id               uuid NOT NULL REFERENCES public.countries(id),
  strn                     text,                                    -- Sales Tax Registration Number
  period_year              int NOT NULL CHECK (period_year >= 2020 AND period_year <= 2100),
  period_month             int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  filing_deadline          date NOT NULL,                            -- 18th of the following month
  status                   text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','in_preparation','ready_for_review','reviewed','filed','paid','cancelled')),
  output_tax_amount        numeric(18,2),                            -- sourced from the preparer's real sales/purchase tax registers
  output_tax_source        text,
  input_tax_amount         numeric(18,2),
  input_tax_source         text,
  rate_applied             numeric(6,4),
  rate_source_note         text,
  net_payable              numeric(18,2),                            -- output - input, floored at 0 for display; a negative value is a carry-forward credit
  computed_at              timestamptz,
  accountant_confirmed     boolean NOT NULL DEFAULT false,
  accountant_confirmed_by  uuid,
  accountant_confirmed_at  timestamptz,
  responsible_user_id      uuid,
  reminder_task_id         uuid REFERENCES public.user_tasks(id),
  filing_reference         text,
  filed_at                 timestamptz,
  filed_by                 uuid,
  payment_reference        text,
  paid_amount              numeric(18,2),
  paid_at                  timestamptz,
  notes                    text,
  created_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at                timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS pk_sales_tax_returns_no_uq ON public.pk_sales_tax_returns (return_no);
CREATE UNIQUE INDEX IF NOT EXISTS pk_sales_tax_returns_entity_period_uq ON public.pk_sales_tax_returns (tax_entity_id, period_year, period_month)
  WHERE deleted_at IS NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS pk_sales_tax_returns_deadline_idx ON public.pk_sales_tax_returns (filing_deadline)
  WHERE deleted_at IS NULL AND status NOT IN ('filed','paid','cancelled');

CREATE TABLE IF NOT EXISTS public.pk_sales_tax_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    uuid NOT NULL REFERENCES public.pk_sales_tax_returns(id) ON DELETE CASCADE,
  action       text NOT NULL,
  from_status  text,
  to_status    text,
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id     uuid,
  actor_name   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pk_sales_tax_events_idx ON public.pk_sales_tax_events (return_id, created_at DESC);

COMMENT ON TABLE public.pk_sales_tax_returns IS
  'Pakistan monthly Sales Tax return working per tax entity + period. Filing/payment are recorded references only — the ERP does not submit to FBR/IRIS. Output/input tax are manually entered by the preparer from their own real tax registers, never invented. Rate is a seed default sourced from the Sales Tax Act 1990 Section 3(1) (see migration header) and MUST be accountant_confirmed before a return can leave draft/in_preparation.';

COMMIT;
