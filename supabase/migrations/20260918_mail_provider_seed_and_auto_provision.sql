-- Migration: DGT Mail System — Provider Seed + Mailbox Host Overrides + Auto-Provision
-- Purpose: Seed Titan email provider, add per-mailbox host overrides, build auto-provision webhook
-- Date: 2026-09-18

-- ============================================================
-- 1. Seed Titan / Hostinger email provider for dgt.llc
-- ============================================================
INSERT INTO erp_email_providers (
  provider_name, provider_type, domain,
  smtp_host, smtp_port,
  imap_host, imap_port,
  security_mode, is_active
)
VALUES (
  'Titan Email (Hostinger)', 'managed', 'dgt.llc',
  'smtp.titan.email', 587,
  'imap.titan.email', 993,
  'starttls', true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. Add per-mailbox IMAP/SMTP host overrides (optional, allow
--    individual mailboxes to override provider-level defaults)
-- ============================================================
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  imap_host TEXT;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  imap_port INTEGER;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  smtp_host TEXT;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  smtp_port INTEGER;

-- ============================================================
-- 3. Function: auto_provision_mailbox
-- Called whenever a new city_branch or profile (user) is created
-- Creates erp_email_accounts record if one does not yet exist
-- ============================================================
CREATE OR REPLACE FUNCTION auto_provision_mailbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_display_name TEXT;
  v_city_branch_id UUID;
  v_country_branch_id UUID;
  v_country_id UUID;
  v_scope TEXT;
  v_provider_id UUID;
BEGIN
  -- Resolve provider for dgt.llc
  SELECT id INTO v_provider_id
  FROM erp_email_providers
  WHERE domain = 'dgt.llc' AND is_active = true AND deleted_at IS NULL
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Handle city_branches table
  IF TG_TABLE_NAME = 'city_branches' THEN
    v_city_branch_id   := NEW.id;
    v_country_branch_id := NEW.country_branch_id;
    v_country_id        := NEW.country_id;
    v_scope             := 'city_branch';
    -- Derive email from branch code (e.g. "CHM" -> "chaman@dgt.llc", "DXB" -> "dubai@dgt.llc")
    v_email := lower(
      COALESCE(
        NEW.code,
        regexp_replace(lower(NEW.name), '[^a-z0-9]', '', 'g')
      )
    ) || '@dgt.llc';
    v_display_name := COALESCE(NEW.name, NEW.code, 'Branch') || ' Mailbox';

  -- Handle country_branches table
  ELSIF TG_TABLE_NAME = 'country_branches' THEN
    v_country_branch_id := NEW.id;
    v_country_id        := NEW.country_id;
    v_scope             := 'country_branch';
    v_email := lower(
      COALESCE(
        NEW.code,
        regexp_replace(lower(NEW.name), '[^a-z0-9]', '', 'g')
      )
    ) || '.branch@dgt.llc';
    v_display_name := COALESCE(NEW.name, 'Country Branch') || ' Mailbox';

  -- Handle profiles (users) table
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    -- Only provision if user has an email that ends with @dgt.llc
    IF NEW.email IS NULL OR NEW.email NOT ILIKE '%@dgt.llc' THEN
      RETURN NEW;
    END IF;
    v_scope        := 'city_branch';
    v_email        := lower(NEW.email);
    v_display_name := COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)) || ' Mailbox';
    -- Inherit branch from profile if available
    v_city_branch_id    := NEW.city_branch_id;
    v_country_branch_id := NEW.country_branch_id;
    v_country_id        := NEW.country_id;
  ELSE
    RETURN NEW;
  END IF;

  -- Only insert if email doesn't already exist
  INSERT INTO erp_email_accounts (
    provider_id, email_address, display_name,
    scope, is_active, is_default,
    country_id, country_branch_id, city_branch_id,
    cc_super_admin, cc_country_admin,
    settings
  )
  VALUES (
    v_provider_id, v_email, v_display_name,
    v_scope, true, false,
    v_country_id, v_country_branch_id, v_city_branch_id,
    true, true,
    '{}'::jsonb
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Attach triggers for auto-provisioning
-- ============================================================
DROP TRIGGER IF EXISTS trg_auto_provision_mailbox_city_branch ON city_branches;
CREATE TRIGGER trg_auto_provision_mailbox_city_branch
  AFTER INSERT ON city_branches
  FOR EACH ROW EXECUTE FUNCTION auto_provision_mailbox();

DROP TRIGGER IF EXISTS trg_auto_provision_mailbox_country_branch ON country_branches;
CREATE TRIGGER trg_auto_provision_mailbox_country_branch
  AFTER INSERT ON country_branches
  FOR EACH ROW EXECUTE FUNCTION auto_provision_mailbox();

DROP TRIGGER IF EXISTS trg_auto_provision_mailbox_profile ON profiles;
CREATE TRIGGER trg_auto_provision_mailbox_profile
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_provision_mailbox();

-- ============================================================
-- 5. Back-fill: Ensure Dubai and Chaman mailboxes exist
--    (idempotent - skips if already present)
-- ============================================================
INSERT INTO erp_email_accounts (
  provider_id, email_address, display_name,
  scope, is_active, is_default, cc_super_admin, cc_country_admin,
  settings
)
SELECT
  p.id, 'dubai@dgt.llc', 'Dubai Branch Mailbox',
  'city_branch', true, false, true, true, '{}'::jsonb
FROM erp_email_providers p
WHERE p.domain = 'dgt.llc' AND p.is_active = true AND p.deleted_at IS NULL
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO erp_email_accounts (
  provider_id, email_address, display_name,
  scope, is_active, is_default, cc_super_admin, cc_country_admin,
  settings
)
SELECT
  p.id, 'chaman@dgt.llc', 'Chaman Branch Mailbox',
  'city_branch', true, false, true, true, '{}'::jsonb
FROM erp_email_providers p
WHERE p.domain = 'dgt.llc' AND p.is_active = true AND p.deleted_at IS NULL
LIMIT 1
ON CONFLICT DO NOTHING;

-- Link to city branches if they exist
UPDATE erp_email_accounts ea
SET city_branch_id = cb.id,
    country_id = cb.country_id,
    country_branch_id = cb.country_branch_id
FROM city_branches cb
WHERE ea.email_address = 'dubai@dgt.llc'
  AND (lower(cb.name) ILIKE '%dubai%' OR lower(cb.code) ILIKE '%dxb%' OR lower(cb.code) ILIKE '%dub%')
  AND ea.city_branch_id IS NULL;

UPDATE erp_email_accounts ea
SET city_branch_id = cb.id,
    country_id = cb.country_id,
    country_branch_id = cb.country_branch_id
FROM city_branches cb
WHERE ea.email_address = 'chaman@dgt.llc'
  AND (lower(cb.name) ILIKE '%chaman%' OR lower(cb.code) ILIKE '%chm%')
  AND ea.city_branch_id IS NULL;

-- ============================================================
-- 6. Update migration registry
-- ============================================================
INSERT INTO erp_schema_migrations (name, status)
VALUES ('20260918_mail_provider_seed_and_auto_provision', 'applied')
ON CONFLICT (name) DO UPDATE SET status = excluded.status, applied_at = NOW();
