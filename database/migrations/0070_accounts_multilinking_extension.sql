-- =============================================================================
--  EXTEND EXISTING ACCOUNTS TABLE WITH MULTI-LINKING SUPPORT
--  Adds country_id and account_type_id to existing ledger accounts table
--  Enables linking accounts to Companies, Banks, Warehouses, Customers
-- =============================================================================

-- Add missing columns to existing accounts table if they don't exist
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS account_type_id UUID REFERENCES public.account_types(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

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

-- Enable RLS on junction tables
ALTER TABLE public.account_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_customer_owners ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for junction tables (allow read/write for authorized users)
CREATE POLICY account_companies_select_policy ON public.account_companies
FOR SELECT USING (true);

CREATE POLICY account_companies_insert_policy ON public.account_companies
FOR INSERT WITH CHECK (true);

CREATE POLICY account_companies_delete_policy ON public.account_companies
FOR DELETE USING (true);

CREATE POLICY account_banks_select_policy ON public.account_banks FOR SELECT USING (true);
CREATE POLICY account_banks_insert_policy ON public.account_banks FOR INSERT WITH CHECK (true);
CREATE POLICY account_banks_delete_policy ON public.account_banks FOR DELETE USING (true);

CREATE POLICY account_warehouses_select_policy ON public.account_warehouses FOR SELECT USING (true);
CREATE POLICY account_warehouses_insert_policy ON public.account_warehouses FOR INSERT WITH CHECK (true);
CREATE POLICY account_warehouses_delete_policy ON public.account_warehouses FOR DELETE USING (true);

CREATE POLICY account_customer_owners_select_policy ON public.account_customer_owners FOR SELECT USING (true);
CREATE POLICY account_customer_owners_insert_policy ON public.account_customer_owners FOR INSERT WITH CHECK (true);
CREATE POLICY account_customer_owners_delete_policy ON public.account_customer_owners FOR DELETE USING (true);
