-- Sub-phase B: money_exchange_entries had zero master-data FK usage — every party field
-- (receipt_name, purchased_from, received_office_name) was plain free text, and the
-- receivedType="Bank" option had no link to the Bank master at all. Additive FKs only;
-- existing free-text columns stay as display/print snapshots.
ALTER TABLE public.money_exchange_entries
  ADD COLUMN IF NOT EXISTS receipt_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchased_from_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
