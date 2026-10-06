-- Bank Roznamcha & Cheque Management Architecture Migration
-- Creates bank_cheque_transactions table with full scoping, status lifecycle, and audit logs.

CREATE TABLE IF NOT EXISTS public.bank_cheque_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  roznamcha_entry_id UUID REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id UUID REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id UUID REFERENCES public.city_branches(id) ON DELETE SET NULL,
  
  -- Identifiers & Serials
  entry_serial_number TEXT NOT NULL,
  voucher_no TEXT,
  journal_no TEXT,
  
  -- Date & Timestamps
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Actor & Bank details
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT 'System User',
  bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT,
  
  -- Cheque & Transaction details
  cheque_no TEXT,
  particulars TEXT NOT NULL,
  cheque_date DATE,
  due_date DATE,
  
  -- Financials
  debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PKR',
  
  -- Status lifecycle
  -- 'cleared' | 'pending' | 'post_dated' | 'overdue' | 'dishonored'
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Clearance / Dishonor details
  presented_at TIMESTAMPTZ,
  presented_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cleared_at TIMESTAMPTZ,
  cleared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dishonored_at TIMESTAMPTZ,
  dishonored_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dishonor_reason TEXT,
  
  -- Ledger linkage
  ledger_id UUID REFERENCES public.ledgers(id) ON DELETE SET NULL,
  counter_ledger_id UUID REFERENCES public.ledgers(id) ON DELETE SET NULL,
  
  -- Audit & Notes
  notes TEXT,
  audit_trail JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_bank_cheque_entry_date ON public.bank_cheque_transactions(entry_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bank_cheque_due_date ON public.bank_cheque_transactions(due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bank_cheque_status ON public.bank_cheque_transactions(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bank_cheque_country ON public.bank_cheque_transactions(country_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bank_cheque_country_branch ON public.bank_cheque_transactions(country_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bank_cheque_city_branch ON public.bank_cheque_transactions(city_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bank_cheque_company ON public.bank_cheque_transactions(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bank_cheque_cheque_no ON public.bank_cheque_transactions(cheque_no) WHERE deleted_at IS NULL;
