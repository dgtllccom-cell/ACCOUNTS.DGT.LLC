-- Migration: Add 'booking' to purchase_order_payment_kind and correct recalc function
-- This allows distinguishing the Stage 1 Booking Transfer from actual cash/bank payments.

-- 1. Add 'booking' to the payment kind enum (run outside of transaction if needed, but standard migrations support this)
ALTER TYPE purchase_order_payment_kind ADD VALUE IF NOT EXISTS 'booking';

-- 2. Correct the recalculation function
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
  -- Fetch the order total in base currency
  SELECT COALESCE(order_total, 0) INTO v_total
  FROM purchase_orders
  WHERE id = p_purchase_order_id
    AND deleted_at IS NULL;

  -- Fetch sum of advance, remaining, and actual credit payments.
  -- Note: Booking transfers of kind 'booking' will NOT be summed in v_adv, v_rem, or v_cr,
  -- so they won't incorrectly subtract from the remaining due balance.
  SELECT
    COALESCE(SUM(CASE WHEN kind = 'advance' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'remaining' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'credit' THEN amount ELSE 0 END), 0)
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
  ELSIF v_due = 0 THEN
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
