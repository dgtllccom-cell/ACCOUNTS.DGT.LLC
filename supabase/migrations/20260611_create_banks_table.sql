-- Bank Master Form Migration
-- Creates the banks table to support the Bank Master Form
-- All bank records are stored here and reused everywhere in the ERP system.

CREATE TABLE IF NOT EXISTS public.banks (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Bank Identification
  bank_type           TEXT NOT NULL CHECK (char_length(bank_type) BETWEEN 1 AND 80),
  account_type        TEXT NOT NULL CHECK (char_length(account_type) BETWEEN 1 AND 80),
  bank_name           TEXT NOT NULL CHECK (char_length(bank_name) BETWEEN 2 AND 200),
  branch_name         TEXT NOT NULL CHECK (char_length(branch_name) BETWEEN 2 AND 200),
  branch_code         TEXT NOT NULL CHECK (char_length(branch_code) BETWEEN 1 AND 80),
  branch_code_type    TEXT NOT NULL CHECK (char_length(branch_code_type) BETWEEN 1 AND 80),
  short_name          TEXT NOT NULL CHECK (char_length(short_name) BETWEEN 1 AND 20),

  -- Account Details
  account_title       TEXT NOT NULL CHECK (char_length(account_title) BETWEEN 2 AND 200),
  account_number      TEXT NOT NULL CHECK (char_length(account_number) BETWEEN 2 AND 120),
  iban_number         TEXT CHECK (char_length(iban_number) <= 34),
  currency            CHAR(3) NOT NULL DEFAULT 'USD',
  account_status      TEXT NOT NULL DEFAULT 'Active'
                        CHECK (account_status IN ('Active', 'Inactive', 'Frozen', 'Closed')),

  -- Location (FK to Master Form location tables)
  country_id          UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  state_province_id   UUID REFERENCES public.state_provinces(id) ON DELETE SET NULL,
  city_id             UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  full_address        TEXT CHECK (char_length(full_address) <= 500),

  -- Contact
  phone               TEXT CHECK (char_length(phone) <= 50),
  email               TEXT CHECK (char_length(email) <= 255),
  swift_bic           TEXT CHECK (char_length(swift_bic) <= 20),
  website             TEXT CHECK (char_length(website) <= 500),
  remarks             TEXT CHECK (char_length(remarks) <= 2000),

  -- Audit
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- Indexes for fast picker searches
CREATE INDEX IF NOT EXISTS idx_banks_bank_name    ON public.banks (bank_name)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_banks_account_no   ON public.banks (account_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_banks_account_title ON public.banks (account_title) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_banks_country_id   ON public.banks (country_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_banks_is_active    ON public.banks (is_active)    WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read active banks
CREATE POLICY "banks_read_authenticated"
  ON public.banks FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- Allow service role full access (used by server-side admin client)
CREATE POLICY "banks_all_service_role"
  ON public.banks FOR ALL
  USING (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE public.banks IS
  'Bank Master Form — central bank database. Created once, used everywhere in the ERP system.';
