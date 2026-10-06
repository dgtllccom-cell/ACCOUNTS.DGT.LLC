-- Money Exchange: real Account Master mapping (Purchase/Sales account per entry)
-- and a draft/posted status, needed by the redesigned Money Exchange dashboard
-- and entry screen. Additive only — existing columns, existing data and every
-- other module (Business Ledger, Shipping Ledger) are untouched. No accounting
-- postings are created by this or by the application code that uses it; these
-- columns only drive an informational "posting preview" in the UI.

BEGIN;

ALTER TABLE public.money_exchange_entries
  ADD COLUMN IF NOT EXISTS purchase_account_id uuid REFERENCES public.enterprise_accounts(id),
  ADD COLUMN IF NOT EXISTS sales_account_id uuid REFERENCES public.enterprise_accounts(id),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted';

ALTER TABLE public.money_exchange_entries
  DROP CONSTRAINT IF EXISTS money_exchange_entries_status_check;
ALTER TABLE public.money_exchange_entries
  ADD CONSTRAINT money_exchange_entries_status_check CHECK (status IN ('draft', 'posted'));

CREATE INDEX IF NOT EXISTS money_exchange_entries_branch_currency_idx
  ON public.money_exchange_entries (branch_id, qty_currency, status) WHERE deleted_at IS NULL;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260921_money_exchange_account_mapping_and_status', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;
