-- Transfer Mode Master Migration
-- Creates the transfer_modes table to support centralized transfer modes across ERP Settings & Roznamcha

CREATE TABLE IF NOT EXISTS public.transfer_modes (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code                  TEXT NOT NULL,
  name                  TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  reference_label       TEXT NOT NULL DEFAULT 'Transaction Reference',
  reference_placeholder TEXT NOT NULL DEFAULT 'Reference / number',
  description           TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_transfer_modes_code
  ON public.transfer_modes (lower(code)) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transfer_modes_active
  ON public.transfer_modes (is_active, sort_order) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.transfer_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_modes_read_authenticated"
  ON public.transfer_modes FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

CREATE POLICY "transfer_modes_all_service_role"
  ON public.transfer_modes FOR ALL
  USING (auth.role() = 'service_role');

-- Seed canonical default transfer modes
INSERT INTO public.transfer_modes (code, name, reference_label, reference_placeholder, sort_order)
VALUES
  ('bank_transfer', 'Bank Transfer', 'Transaction Reference', 'Reference / number', 1),
  ('mobile_transfer', 'Mobile Transfer', 'Mobile Number / Transfer ID', 'Enter mobile number or transfer ID', 2),
  ('gpay', 'GPay / Google Pay', 'GPay Number / UPI ID', 'Enter GPay number or UPI ID', 3),
  ('cheque_transfer', 'Cheque Transfer', 'Cheque Number', 'Enter cheque number', 4),
  ('mobile_wallet', 'Mobile Wallet', 'Mobile Number / Transfer ID', 'Enter mobile number or transfer ID', 5),
  ('other_transfer', 'Other Transfer', 'Transaction Reference', 'Reference / number', 6)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.transfer_modes IS
  'Transfer Mode Master — central registry of payment & financial transfer modes in DGT ERP.';
