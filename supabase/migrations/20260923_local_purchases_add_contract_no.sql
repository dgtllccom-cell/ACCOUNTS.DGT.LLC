-- Local Purchase: add a real, user-entered Contract No. field.
-- Distinct from manual_bill_no (auto-generated booking serial, e.g. "LP-000123") —
-- contract_no is the supplier/contract reference the user types in, matching the
-- approved Local Purchase design prototype's "Contract No." field.
ALTER TABLE public.local_purchases ADD COLUMN IF NOT EXISTS contract_no text;
COMMENT ON COLUMN public.local_purchases.contract_no IS 'User-entered supplier/contract reference number, distinct from the auto-generated manual_bill_no serial.';
