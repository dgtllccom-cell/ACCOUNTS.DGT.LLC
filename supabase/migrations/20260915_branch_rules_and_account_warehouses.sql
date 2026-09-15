-- Migration: 20260915_branch_rules_and_account_warehouses.sql
-- Description: Branch Rules & Permission Management table + Canonical Account-Warehouse linkage table.
-- Non-destructive and idempotent.

-- 1. Branch Rules table for Country, Main Branch, and City Branch level permission rules
CREATE TABLE IF NOT EXISTS public.branch_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('country', 'country_branch', 'city_branch')),
  scope_id uuid NOT NULL,
  allowed_domains text[] NOT NULL DEFAULT ARRAY['business']::text[],
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  denied_permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  module_access jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_rules_scope_unique UNIQUE (scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS branch_rules_scope_idx ON public.branch_rules (scope_type, scope_id);

-- 2. Canonical Account-Warehouse junction table (multi-warehouse per account/customer/company)
CREATE TABLE IF NOT EXISTS public.account_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.enterprise_accounts(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure all expected columns exist on account_warehouses
ALTER TABLE public.account_warehouses
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.country_company_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.account_warehouses
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.account_warehouses
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'account_warehouses_unique'
  ) THEN
    ALTER TABLE public.account_warehouses ADD CONSTRAINT account_warehouses_unique UNIQUE (account_id, warehouse_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS account_warehouses_account_idx ON public.account_warehouses (account_id);
CREATE INDEX IF NOT EXISTS account_warehouses_warehouse_idx ON public.account_warehouses (warehouse_id);
CREATE INDEX IF NOT EXISTS account_warehouses_customer_idx ON public.account_warehouses (customer_id);
CREATE INDEX IF NOT EXISTS account_warehouses_company_idx ON public.account_warehouses (company_id);

-- 3. Backwards-compatible direct FK references on warehouses table
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.enterprise_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.country_company_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS warehouses_account_idx ON public.warehouses (account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warehouses_company_idx ON public.warehouses (company_id) WHERE deleted_at IS NULL;

-- 4. Enable RLS
ALTER TABLE public.branch_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_warehouses ENABLE ROW LEVEL SECURITY;

-- 5. Permissive policies for authenticated ERP sessions (Super Admin + Scoped reads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'branch_rules' AND policyname = 'branch_rules_read_all'
  ) THEN
    CREATE POLICY branch_rules_read_all ON public.branch_rules
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'branch_rules' AND policyname = 'branch_rules_super_admin_all'
  ) THEN
    CREATE POLICY branch_rules_super_admin_all ON public.branch_rules
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'account_warehouses' AND policyname = 'account_warehouses_read_all'
  ) THEN
    CREATE POLICY account_warehouses_read_all ON public.account_warehouses
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'account_warehouses' AND policyname = 'account_warehouses_write_all'
  ) THEN
    CREATE POLICY account_warehouses_write_all ON public.account_warehouses
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
