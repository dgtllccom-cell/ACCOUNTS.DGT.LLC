-- Fix: recalc_purchase_order_payment_totals was summing up local currency amounts (e.g. PKR, AED)
-- and subtracting them directly from the base currency (USD) order total, causing massive negative balances
-- or incorrect payment statuses. This fix converts the local amount to USD before summing.

CREATE OR REPLACE FUNCTION recalc_purchase_order_payment_totals(p_purchase_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(18,4);
  v_adv numeric(18,4);
  v_rem numeric(18,4);
  v_cr numeric(18,4);
  v_due numeric(18,4);
  v_status purchase_order_status;
  v_posting document_status;
BEGIN
  -- Fetch the order total in base currency (USD)
  SELECT COALESCE(order_total, 0) INTO v_total
  FROM purchase_orders
  WHERE id = p_purchase_order_id
    AND deleted_at IS NULL;

  -- Fetch sum of advance, remaining, and actual credit payments in BASE CURRENCY (USD).
  -- Since amount is stored in local currency, we divide by exchange_rate to get the USD equivalent.
  SELECT
    COALESCE(SUM(CASE WHEN kind = 'advance' THEN 
        CASE WHEN COALESCE(exchange_rate, 1) = 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'remaining' THEN 
        CASE WHEN COALESCE(exchange_rate, 1) = 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'credit' THEN 
        CASE WHEN COALESCE(exchange_rate, 1) = 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0)
  INTO v_adv, v_rem, v_cr
  FROM purchase_order_payments
  WHERE purchase_order_id = p_purchase_order_id
    AND deleted_at IS NULL
    AND status = 'posted';

  -- Calculate remaining due. Only actual cash/bank/credit payments (v_adv, v_rem, v_cr) reduce the due balance.
  v_due := GREATEST(v_total - v_adv - v_rem - v_cr, 0);

  -- Set payment status
  IF v_total <= 0 THEN
    v_status := 'pending';
  ELSIF v_due <= 0.01 THEN -- Use small tolerance for floating point math
    v_status := 'completed';
  ELSIF (v_adv + v_rem + v_cr) > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

  -- Document posting status: if any transaction is posted (Booking Transfer or Payments), it is 'posted'
  IF EXISTS (
    SELECT 1 FROM purchase_order_payments
    WHERE purchase_order_id = p_purchase_order_id
      AND deleted_at IS NULL
      AND status = 'posted'
  ) THEN
    v_posting := 'posted'::document_status;
  ELSE
    v_posting := 'draft'::document_status;
  END IF;

  -- Update purchase order with computed values
  UPDATE purchase_orders
  SET advance_paid = v_adv,
      remaining_paid = v_rem,
      credit_amount = v_cr,
      remaining_due = v_due,
      payment_status = v_status,
      ledger_posting_status = v_posting,
      updated_at = NOW()
  WHERE id = p_purchase_order_id;
END;
$$;

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
