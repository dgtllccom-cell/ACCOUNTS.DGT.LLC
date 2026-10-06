-- Migration: Add tracking columns to erp_email_accounts
-- These columns enable the Email Accounts Management dashboard to show
-- last tested time, last test result, and last sent email timestamp.

DO $$
BEGIN
  -- Add last_tested_at column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'erp_email_accounts' AND column_name = 'last_tested_at'
  ) THEN
    ALTER TABLE erp_email_accounts ADD COLUMN last_tested_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- Add last_test_result column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'erp_email_accounts' AND column_name = 'last_test_result'
  ) THEN
    ALTER TABLE erp_email_accounts ADD COLUMN last_test_result TEXT DEFAULT NULL;
  END IF;

  -- Add last_sent_at column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'erp_email_accounts' AND column_name = 'last_sent_at'
  ) THEN
    ALTER TABLE erp_email_accounts ADD COLUMN last_sent_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;
