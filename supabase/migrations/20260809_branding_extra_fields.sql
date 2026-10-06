-- Additive branding fields on the EXISTING country_company_profiles master.
-- No new table, no duplication. Fills the genuine gaps: stamp, letterhead,
-- report/certificate header text, HR manager name, and 5-language company name.
-- All columns are nullable and added IF NOT EXISTS => safe to re-run, no data loss.

BEGIN;

ALTER TABLE public.country_company_profiles
  ADD COLUMN IF NOT EXISTS company_stamp_url        text,
  ADD COLUMN IF NOT EXISTS letterhead_url           text,
  ADD COLUMN IF NOT EXISTS report_header            text,
  ADD COLUMN IF NOT EXISTS certificate_header       text,
  ADD COLUMN IF NOT EXISTS hr_manager_name          text,
  -- Five-language company name (canonical + per-language overrides)
  ADD COLUMN IF NOT EXISTS company_name_en          text,
  ADD COLUMN IF NOT EXISTS company_name_ur          text,
  ADD COLUMN IF NOT EXISTS company_name_ar          text,
  ADD COLUMN IF NOT EXISTS company_name_fa          text,
  ADD COLUMN IF NOT EXISTS company_name_ps          text;

-- Seed the English 5-language name from the existing company_name so nothing is blank.
UPDATE public.country_company_profiles
   SET company_name_en = COALESCE(company_name_en, company_name)
 WHERE company_name IS NOT NULL;

COMMIT;
