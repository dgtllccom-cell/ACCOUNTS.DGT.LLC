-- 20261241 — expense rows keep their tax treatment; expense bills keep the base currency they were calculated in (ADDITIVE)
--
-- WHY: every expense row must preserve original currency, original amount, exchange rate, converted amount AND its tax treatment
-- (tax code, rate, exclusive / inclusive / exempt, taxable base, tax amount). The bill itself snapshots the BASE currency it was
-- converted into, so a later change of a branch / country currency setting can never re-label or re-value an existing bill.
-- No amount is recalculated or rewritten by this migration. Production currently holds 0 expense bills (verified), so the
-- back-fill below touches 0 rows there; on DEV it touches only descriptive columns.
--
-- Rollback: ALTER TABLE ... DROP COLUMN ... (columns are new and unused by any older code path).

BEGIN;

ALTER TABLE public.expenses_bills
  ADD COLUMN IF NOT EXISTS base_currency text;

ALTER TABLE public.expenses_bill_lines
  ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS tax_code text,
  ADD COLUMN IF NOT EXISTS tax_base numeric(18,4);

ALTER TABLE public.bill_expense_lines
  ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS tax_code text,
  ADD COLUMN IF NOT EXISTS tax_base numeric(18,4);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_bill_lines_tax_mode_check') THEN
    ALTER TABLE public.expenses_bill_lines ADD CONSTRAINT expenses_bill_lines_tax_mode_check CHECK (tax_mode IN ('exclusive', 'inclusive', 'exempt'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bill_expense_lines_tax_mode_check') THEN
    ALTER TABLE public.bill_expense_lines ADD CONSTRAINT bill_expense_lines_tax_mode_check CHECK (tax_mode IN ('exclusive', 'inclusive', 'exempt'));
  END IF;
END $$;

-- descriptive back-fill only (no amounts): rows that never had tax are "exempt"; bills get the currency their branch is configured with
UPDATE public.expenses_bill_lines SET tax_mode = 'exempt' WHERE coalesce(tax_on, false) = false AND tax_mode = 'exclusive';
UPDATE public.bill_expense_lines  SET tax_mode = 'exempt' WHERE coalesce(tax_pct, 0) = 0 AND tax_mode = 'exclusive';
UPDATE public.expenses_bill_lines SET tax_base = final_amount WHERE tax_base IS NULL;
UPDATE public.expenses_bills b
   SET base_currency = upper(coalesce(cb.local_currency, c.currency_code))
  FROM public.city_branches cb
  LEFT JOIN public.countries c ON c.id = cb.country_id
 WHERE cb.id = b.branch_id AND b.base_currency IS NULL;

COMMIT;
