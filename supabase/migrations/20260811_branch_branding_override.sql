-- Branch-level branding override + remaining company branding fields.
-- Fully additive: nullable columns, IF NOT EXISTS, no change to existing
-- country branding. When a branch column is NULL the resolver falls back to
-- the country company profile, so country branding is never affected.

BEGIN;

-- 1. Remaining fields on the country company profile (branding master).
ALTER TABLE public.country_company_profiles
  ADD COLUMN IF NOT EXISTS hr_department_name text,
  ADD COLUMN IF NOT EXISTS watermark_text     text,
  ADD COLUMN IF NOT EXISTS qr_enabled         boolean NOT NULL DEFAULT true;

-- 2. Optional per-branch overrides (main / country branch).
ALTER TABLE public.country_branches
  ADD COLUMN IF NOT EXISTS branding_company_name text,
  ADD COLUMN IF NOT EXISTS branding_logo_url     text,
  ADD COLUMN IF NOT EXISTS branding_stamp_url    text,
  ADD COLUMN IF NOT EXISTS branding_letterhead_url text,
  ADD COLUMN IF NOT EXISTS branding_report_header  text,
  ADD COLUMN IF NOT EXISTS branding_report_footer  text,
  ADD COLUMN IF NOT EXISTS branding_address        text,
  ADD COLUMN IF NOT EXISTS branding_phone          text,
  ADD COLUMN IF NOT EXISTS branding_email          text;

-- 3. Optional per-branch overrides (city branch).
ALTER TABLE public.city_branches
  ADD COLUMN IF NOT EXISTS branding_company_name text,
  ADD COLUMN IF NOT EXISTS branding_logo_url     text,
  ADD COLUMN IF NOT EXISTS branding_stamp_url    text,
  ADD COLUMN IF NOT EXISTS branding_letterhead_url text,
  ADD COLUMN IF NOT EXISTS branding_report_header  text,
  ADD COLUMN IF NOT EXISTS branding_report_footer  text,
  ADD COLUMN IF NOT EXISTS branding_address        text,
  ADD COLUMN IF NOT EXISTS branding_phone          text,
  ADD COLUMN IF NOT EXISTS branding_email          text;

COMMIT;
