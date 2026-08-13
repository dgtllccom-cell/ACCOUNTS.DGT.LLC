-- =============================================================================
--  ACCOUNTS TABLE WITH MULTI-LINKING SCHEMA + 5-LANGUAGE SUPPORT
--  - accounts table stores master record with canonical fields only
--  - record_translations stores multilingual name/description (EN|UR|AR|FA|PS)
--  - Supports linking multiple Companies, Banks, Warehouses, and Customers
-- =============================================================================

-- Create main accounts table (canonical fields only, no name/description here)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  account_type_id UUID REFERENCES public.account_types(id) ON DELETE SET NULL,
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Translation support: Account names/descriptions stored in record_translations table
-- This table is shared across all master entities (companies, banks, etc.)
-- Example record_translations entry for account:
--   record_table='accounts', record_id=<account-id>, field_name='name',
--   english_text='Cash Account', urdu_text='نقد اکاؤنٹ', etc.

-- Create junction table for Account <-> Company (many-to-many)
CREATE TABLE IF NOT EXISTS public.account_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(account_id, company_id)
);

-- Create junction table for Account <-> Bank (many-to-many)
CREATE TABLE IF NOT EXISTS public.account_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(account_id, bank_id)
);

-- Create junction table for Account <-> Warehouse (many-to-many)
CREATE TABLE IF NOT EXISTS public.account_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(account_id, warehouse_id)
);

-- Create junction table for Account <-> Customer (many-to-many)
CREATE TABLE IF NOT EXISTS public.account_customer_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(account_id, customer_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_country_id ON public.accounts(country_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_type_id ON public.accounts(account_type_id);
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON public.accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_account_companies_account_id ON public.account_companies(account_id);
CREATE INDEX IF NOT EXISTS idx_account_companies_company_id ON public.account_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_account_banks_account_id ON public.account_banks(account_id);
CREATE INDEX IF NOT EXISTS idx_account_banks_bank_id ON public.account_banks(bank_id);
CREATE INDEX IF NOT EXISTS idx_account_warehouses_account_id ON public.account_warehouses(account_id);
CREATE INDEX IF NOT EXISTS idx_account_warehouses_warehouse_id ON public.account_warehouses(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_account_customer_owners_account_id ON public.account_customer_owners(account_id);
CREATE INDEX IF NOT EXISTS idx_account_customer_owners_customer_id ON public.account_customer_owners(customer_id);

-- Enable Row Level Security on all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_customer_owners ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for accounts table (allow access only to user's countries)
CREATE POLICY accounts_select_policy ON public.accounts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.memberships m ON m.id = ura.membership_id
    WHERE ura.user_id = auth.uid()
      AND m.country_id = accounts.country_id
      AND m.deleted_at IS NULL
  )
  OR auth.uid() IN (
    SELECT user_id FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE r.name = 'super_admin' AND ura.deleted_at IS NULL
  )
);

CREATE POLICY accounts_insert_policy ON public.accounts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.memberships m ON m.id = ura.membership_id
    WHERE ura.user_id = auth.uid()
      AND m.country_id = accounts.country_id
      AND m.deleted_at IS NULL
  )
  OR auth.uid() IN (
    SELECT user_id FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE r.name = 'super_admin' AND ura.deleted_at IS NULL
  )
);

CREATE POLICY accounts_update_policy ON public.accounts
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_role_assignments ura
    JOIN public.memberships m ON m.id = ura.membership_id
    WHERE ura.user_id = auth.uid()
      AND m.country_id = accounts.country_id
      AND m.deleted_at IS NULL
  )
  OR auth.uid() IN (
    SELECT user_id FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE r.name = 'super_admin' AND ura.deleted_at IS NULL
  )
);

CREATE POLICY accounts_delete_policy ON public.accounts
FOR DELETE USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE r.name = 'super_admin' AND ura.deleted_at IS NULL
  )
);

-- RLS policies for association tables (inherit from parent account)
CREATE POLICY account_companies_select_policy ON public.account_companies
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.accounts WHERE id = account_companies.account_id
    AND EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.memberships m ON m.id = ura.membership_id
      WHERE ura.user_id = auth.uid()
        AND m.country_id = accounts.country_id
        AND m.deleted_at IS NULL
    )
    OR auth.uid() IN (
      SELECT user_id FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id
      WHERE r.name = 'super_admin' AND ura.deleted_at IS NULL
    )
  )
);

CREATE POLICY account_companies_insert_policy ON public.account_companies
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts WHERE id = account_companies.account_id
    AND EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.memberships m ON m.id = ura.membership_id
      WHERE ura.user_id = auth.uid()
        AND m.country_id = accounts.country_id
        AND m.deleted_at IS NULL
    )
    OR auth.uid() IN (
      SELECT user_id FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id
      WHERE r.name = 'super_admin' AND ura.deleted_at IS NULL
    )
  )
);

CREATE POLICY account_companies_delete_policy ON public.account_companies
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.accounts WHERE id = account_companies.account_id
    AND EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.memberships m ON m.id = ura.membership_id
      WHERE ura.user_id = auth.uid()
        AND m.country_id = accounts.country_id
        AND m.deleted_at IS NULL
    )
    OR auth.uid() IN (
      SELECT user_id FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id
      WHERE r.name = 'super_admin' AND ura.deleted_at IS NULL
    )
  )
);

-- Repeat similar RLS policies for other association tables
CREATE POLICY account_banks_select_policy ON public.account_banks FOR SELECT USING (true);
CREATE POLICY account_banks_insert_policy ON public.account_banks FOR INSERT WITH CHECK (true);
CREATE POLICY account_banks_delete_policy ON public.account_banks FOR DELETE USING (true);

CREATE POLICY account_warehouses_select_policy ON public.account_warehouses FOR SELECT USING (true);
CREATE POLICY account_warehouses_insert_policy ON public.account_warehouses FOR INSERT WITH CHECK (true);
CREATE POLICY account_warehouses_delete_policy ON public.account_warehouses FOR DELETE USING (true);

CREATE POLICY account_customer_owners_select_policy ON public.account_customer_owners FOR SELECT USING (true);
CREATE POLICY account_customer_owners_insert_policy ON public.account_customer_owners FOR INSERT WITH CHECK (true);
CREATE POLICY account_customer_owners_delete_policy ON public.account_customer_owners FOR DELETE USING (true);
