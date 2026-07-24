-- 0077_daily_usd_rates_audit_columns.sql
-- Add user_name, branch_name, rate_time columns to daily_usd_rates for Super Admin audit table
ALTER TABLE IF EXISTS public.daily_usd_rates ADD COLUMN IF NOT EXISTS user_name text DEFAULT 'SUPER ADMIN';
ALTER TABLE IF EXISTS public.daily_usd_rates ADD COLUMN IF NOT EXISTS branch_name text DEFAULT 'Pakistan Main Branch';
ALTER TABLE IF EXISTS public.daily_usd_rates ADD COLUMN IF NOT EXISTS rate_time text DEFAULT '09:00 AM';
