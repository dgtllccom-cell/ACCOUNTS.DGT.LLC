-- Company Master strengthening — ADDITIVE ONLY.
--
-- The existing `public.companies` table stays the single source of truth for every legal
-- company (customer-owned or our own internal entities). This migration only adds the legal /
-- registration columns the master was missing. No existing row is modified: legacy rows keep
-- company_type NULL and the application derives it on read (is_branch_operative → internal,
-- owner_person_id → customer).
--
-- NOT added here, on purpose (architecture rule):
--   * no bank account / ledger / balance columns — Bank Master registers banks, New Account
--     creates accounts, Roznamcha/Journal posts DR/CR. Company 360 only *references*
--     enterprise_accounts.company_id / banks.owner_company_id that already exist.
--   * no company↔branch table — city_branches.company_id / country_branches.company_id
--     already model "which legal company a branch operates under".
--   * no second serial — company_code (COMP/CMP entry serial) is reused.
--
-- Rollback: ALTER TABLE public.companies DROP COLUMN <each column below>; DROP INDEX … .

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_type        text,
  ADD COLUMN IF NOT EXISTS trade_name          text,
  ADD COLUMN IF NOT EXISTS legal_structure     text,
  ADD COLUMN IF NOT EXISTS nature_of_business  text,
  ADD COLUMN IF NOT EXISTS registration_type   text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS tax_number          text,
  ADD COLUMN IF NOT EXISTS incorporation_date  date,
  ADD COLUMN IF NOT EXISTS license_expiry_date date,
  ADD COLUMN IF NOT EXISTS company_status      text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_company_type_chk') THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_company_type_chk CHECK (company_type IS NULL OR company_type IN ('customer', 'internal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_company_status_chk') THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_company_status_chk CHECK (company_status IS NULL OR company_status IN ('active', 'expired', 'suspended', 'closed'));
  END IF;
END $$;

-- Duplicate-protection lookups (name / registration number / TRN), live rows only.
CREATE INDEX IF NOT EXISTS companies_legal_name_lower_idx
  ON public.companies (lower(coalesce(legal_name, name))) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS companies_registration_number_idx
  ON public.companies (lower(registration_number)) WHERE deleted_at IS NULL AND registration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_tax_number_idx
  ON public.companies (lower(tax_number)) WHERE deleted_at IS NULL AND tax_number IS NOT NULL;
-- Compliance / expiry reminders (Smart Operations detector).
CREATE INDEX IF NOT EXISTS companies_license_expiry_idx
  ON public.companies (license_expiry_date) WHERE deleted_at IS NULL AND license_expiry_date IS NOT NULL;
-- Branch → legal company lookups used by Company 360.
CREATE INDEX IF NOT EXISTS city_branches_company_id_idx ON public.city_branches (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS country_branches_company_id_idx ON public.country_branches (company_id) WHERE company_id IS NOT NULL;

COMMENT ON COLUMN public.companies.company_type IS 'customer = legally registered company owned by a customer/party (owner_person_id); internal = our own legal entity serving a country and/or branches (city_branches.company_id / country_branches.company_id). NULL on legacy rows — derived on read.';
COMMENT ON COLUMN public.companies.tax_number IS 'TRN / NTN / VAT registration number of the legal entity.';
COMMENT ON COLUMN public.companies.license_expiry_date IS 'Trade licence / registration expiry — feeds the Smart Operations compliance reminder.';

-- CRM ↔ Customer Company (spec 19.11): an inquiry may name the specific registered company of the
-- customer it belongs to, so sister companies' activity never mixes. Nullable, no backfill.
ALTER TABLE public.customer_inquiries ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS customer_inquiries_company_id_idx ON public.customer_inquiries (company_id) WHERE company_id IS NOT NULL;

-- New translatable free-text fields join the existing multilingual master-data contract.
INSERT INTO public.translation_field_registry (table_name, field_name, mode)
SELECT v.t, v.f, v.m
FROM (VALUES ('companies', 'trade_name', 'transliterate'), ('companies', 'nature_of_business', 'translate')) AS v(t, f, m)
WHERE to_regclass('public.translation_field_registry') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.translation_field_registry r WHERE r.table_name = v.t AND r.field_name = v.f);

COMMIT;
