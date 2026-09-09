-- ============================================================================
-- MIGRATION: 20261118_priority_branch_hierarchy_and_account_categories.sql
-- 1. Support combined Shipping Line & Clearing Agent Main Branch hierarchy under Country Main Branch
-- 2. Domain-aware unique index on country_branches (one main branch per operational domain)
-- 3. Operational domain on city_branches
-- 4. Persistent master table: public.account_categories with 5-language seed
-- 5. Operational domain and category links on enterprise_accounts
-- ============================================================================

DO $$
BEGIN
  -- 1. country_branches columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'country_branches' AND column_name = 'operational_domain'
  ) THEN
    ALTER TABLE public.country_branches
      ADD COLUMN operational_domain text NOT NULL DEFAULT 'business'
      CHECK (operational_domain IN ('business', 'shipping'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'country_branches' AND column_name = 'parent_country_branch_id'
  ) THEN
    ALTER TABLE public.country_branches
      ADD COLUMN parent_country_branch_id uuid REFERENCES public.country_branches(id) ON DELETE SET NULL;
  END IF;

  -- Update country_branches unique constraint: allow 1 main branch per country per operational domain
  -- (e.g. 1 Country Main Branch for Business, and 1 Main Branch for Shipping Line & Clearing Agent)
  DROP INDEX IF EXISTS public.country_one_main_branch_idx;
  CREATE UNIQUE INDEX IF NOT EXISTS country_one_main_branch_per_domain_idx
    ON public.country_branches (country_id, operational_domain)
    WHERE is_main = true AND deleted_at IS NULL;

  -- 2. city_branches columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'city_branches' AND column_name = 'operational_domain'
  ) THEN
    ALTER TABLE public.city_branches
      ADD COLUMN operational_domain text NOT NULL DEFAULT 'business'
      CHECK (operational_domain IN ('business', 'shipping'));
  END IF;

  -- 3. enterprise_accounts columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'enterprise_accounts' AND column_name = 'operational_domain'
  ) THEN
    ALTER TABLE public.enterprise_accounts
      ADD COLUMN operational_domain text NOT NULL DEFAULT 'business'
      CHECK (operational_domain IN ('business', 'shipping'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'enterprise_accounts' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.enterprise_accounts
      ADD COLUMN category text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'enterprise_accounts' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.enterprise_accounts
      ADD COLUMN category_id uuid;
  END IF;

  -- 4. Create public.account_categories master table
  CREATE TABLE IF NOT EXISTS public.account_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text,
    name text NOT NULL,
    description text,
    account_type text,
    operational_domain text NOT NULL DEFAULT 'business' CHECK (operational_domain IN ('business', 'shipping')),
    country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );

  CREATE UNIQUE INDEX IF NOT EXISTS account_categories_name_domain_idx
    ON public.account_categories (lower(trim(name)), operational_domain)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS account_categories_domain_idx
    ON public.account_categories (operational_domain, is_active)
    WHERE deleted_at IS NULL;

  -- Enable RLS
  ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS account_categories_read_policy ON public.account_categories;
  CREATE POLICY account_categories_read_policy ON public.account_categories
    FOR SELECT USING (deleted_at IS NULL);

  DROP POLICY IF EXISTS account_categories_all_policy ON public.account_categories;
  CREATE POLICY account_categories_all_policy ON public.account_categories
    FOR ALL USING (true) WITH CHECK (true);

  -- 5. Seed default account categories if table is empty
  IF NOT EXISTS (SELECT 1 FROM public.account_categories LIMIT 1) THEN
    INSERT INTO public.account_categories (code, name, description, account_type, operational_domain)
    VALUES
      ('P/S', 'Purchases & Sales / Trading', 'Accounts for core trading, customer invoicing, supplier purchases', 'Customer', 'business'),
      ('B/C', 'Bank & Cash Accounts', 'Liquid cash counters, bank operational accounts, petty cash', 'Bank', 'business'),
      ('B/P', 'Bills & Payables', 'Trade vendor bills, recurring payables, freight invoices', 'Company', 'business'),
      ('EX', 'General Operating Expenses', 'Administrative overhead, supplies, communication, daily operations', 'Expenses Account', 'business'),
      ('S', 'Staff & Payroll Expenses', 'Employee basic salaries, allowances, bonuses, reimbursements', 'Expenses Account', 'business'),
      ('OFFICE_EXP', 'Office & Administrative Expenses', 'Rent, stationery, computer hardware, maintenance', 'Expenses Account', 'business'),
      ('TRAVEL_EXP', 'Travel & Conveyance Expenses', 'Field travel, boarding, lodging, transport costs', 'Expenses Account', 'business'),
      ('LOGISTICS_EXP', 'Port & Customs Clearing Charges', 'Terminal handling, wharfage, customs duty, shipping line fees', 'Expenses Account', 'shipping'),
      ('UTILITY_EXP', 'Utilities & Facilities', 'Electricity, water, gas, broadband internet services', 'Expenses Account', 'business')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
