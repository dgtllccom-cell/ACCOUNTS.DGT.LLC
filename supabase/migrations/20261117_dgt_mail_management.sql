-- Migration: DGT Mail Management System
-- Purpose: Secure admin interface for mailbox credential management
-- Features: Create/update/suspend mailboxes, encrypted password storage, connection testing

-- Extend erp_email_accounts with management fields
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  imap_password_encrypted TEXT;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  smtp_password_encrypted TEXT;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  last_connection_test TIMESTAMPTZ;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  last_connection_status VARCHAR(50);
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  last_connection_error TEXT;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  storage_quota_mb INT DEFAULT 5000;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  storage_used_mb INT DEFAULT 0;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  plan_type VARCHAR(50) DEFAULT 'free';
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  assigned_branch_id UUID REFERENCES city_branches(id) ON DELETE SET NULL;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  suspended_at TIMESTAMPTZ;
ALTER TABLE erp_email_accounts ADD COLUMN IF NOT EXISTS
  suspended_reason TEXT;

-- Audit log for mailbox operations (soft-delete safe: no cascade)
-- IMPORTANT: old_values/new_values must never include imap_password_encrypted, smtp_password_encrypted, or password_hash
CREATE TABLE IF NOT EXISTS erp_email_account_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES erp_email_accounts(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  action_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  old_values JSONB,
  new_values JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  country_id UUID,
  branch_id UUID
);

-- Public mail users (separate from ERP users)
CREATE TABLE IF NOT EXISTS erp_public_mail_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  email_address VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  storage_quota_mb INT DEFAULT 1000,
  storage_used_mb INT DEFAULT 0,
  plan_type VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_erp_email_accounts_assigned_user ON erp_email_accounts(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_erp_email_accounts_suspended ON erp_email_accounts(suspended_at);
CREATE INDEX IF NOT EXISTS idx_erp_email_account_audit_account ON erp_email_account_audit(account_id);
CREATE INDEX IF NOT EXISTS idx_erp_public_mail_users_email ON erp_public_mail_users(email_address);

-- Update migration registry
INSERT INTO erp_schema_migrations (name, status)
VALUES ('20261117_dgt_mail_management', 'applied')
ON CONFLICT (name) DO UPDATE SET status = excluded.status, applied_at = NOW();
