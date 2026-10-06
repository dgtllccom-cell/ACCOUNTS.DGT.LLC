-- Migration: Correct stored amount column to store contract currency (USD) for PKR payments.
-- This ensures recalc_purchase_order_payment_totals sums the USD value correctly.

-- Fix existing payment records where amount was saved in PKR instead of USD
UPDATE purchase_order_payments
SET amount = amount / exchange_rate
WHERE currency_code = 'PKR'
  AND amount = base_currency_amount
  AND exchange_rate > 1
  AND deleted_at IS NULL;

-- Recalculate for all existing purchase orders that have payments
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT DISTINCT purchase_order_id FROM purchase_order_payments WHERE deleted_at IS NULL
  LOOP
    PERFORM recalc_purchase_order_payment_totals(rec.purchase_order_id);
  END LOOP;
END;
$$;
