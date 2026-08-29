CREATE OR REPLACE FUNCTION public.recalc_purchase_order_payment_totals(p_purchase_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric(18,4);
  v_adv numeric(18,4);
  v_rem numeric(18,4);
  v_cr numeric(18,4);
  v_due numeric(18,4);
  v_status purchase_order_status;
  v_posting document_status;
  v_order_exchange_rate numeric;
  v_total_paid_all numeric(18,4);
BEGIN
  -- Fetch the order total and exchange rate
  SELECT COALESCE(order_total, 0), COALESCE(NULLIF(exchange_rate, 0), 1)
  INTO v_total, v_order_exchange_rate
  FROM purchase_orders
  WHERE id = p_purchase_order_id
    AND deleted_at IS NULL;

  SELECT
    COALESCE(SUM(CASE WHEN kind = 'advance' THEN 
      CASE WHEN COALESCE(exchange_rate, 0) <= 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'remaining' THEN 
      CASE WHEN COALESCE(exchange_rate, 0) <= 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'credit' THEN 
      CASE WHEN COALESCE(exchange_rate, 0) <= 0 THEN amount ELSE amount / exchange_rate END 
    ELSE 0 END), 0)
  INTO v_adv, v_rem, v_cr
  FROM purchase_order_payments
  WHERE purchase_order_id = p_purchase_order_id
    AND deleted_at IS NULL
    AND status = 'posted';

  v_total_paid_all := v_adv + v_rem + v_cr;
  v_due := GREATEST(v_total - v_total_paid_all, 0);

  -- Payment status
  IF v_total <= 0 THEN
    v_status := 'pending';
  ELSIF v_due = 0 THEN
    v_status := 'completed';
  ELSIF v_total_paid_all > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

  -- Document posting status
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

  -- Update purchase order
  UPDATE purchase_orders
  SET advance_paid = v_adv,
      remaining_paid = v_rem,
      credit_amount = v_cr,
      remaining_due = v_due,
      payment_status = v_status,
      ledger_posting_status = v_posting,
      updated_at = NOW()
  WHERE id = p_purchase_order_id;

  -- Recalculate loading-level balances for all linked loading records
  UPDATE purchase_loading_records plr
  SET
    loading_percentage = CASE
      WHEN plr.total_quantity > 0 THEN ROUND((plr.loaded_quantity / plr.total_quantity) * 100, 4)
      ELSE 0
    END,
    loaded_purchase_amount = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_total * (plr.loaded_quantity / plr.total_quantity), 4)
      ELSE 0
    END,
    loaded_advance_amount = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_adv * (plr.loaded_quantity / plr.total_quantity), 4)
      ELSE 0
    END,
    loaded_purchase_local = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_total * (plr.loaded_quantity / plr.total_quantity) * v_order_exchange_rate, 4)
      ELSE 0
    END,
    loaded_advance_local = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_adv * (plr.loaded_quantity / plr.total_quantity) * v_order_exchange_rate, 4)
      ELSE 0
    END,
    payment_made = COALESCE((
      SELECT SUM(CASE WHEN COALESCE(pop.exchange_rate, 0) <= 0 THEN pop.amount ELSE pop.amount / pop.exchange_rate END)
      FROM purchase_order_payments pop
      WHERE pop.loading_record_id = plr.id
        AND pop.deleted_at IS NULL
        AND pop.status = 'posted'
    ), 0),
    remaining_loading_balance = CASE
      WHEN plr.total_quantity > 0 THEN
        ROUND(v_total * (plr.loaded_quantity / plr.total_quantity), 4)
        - COALESCE((
            SELECT SUM(CASE WHEN COALESCE(pop.exchange_rate, 0) <= 0 THEN pop.amount ELSE pop.amount / pop.exchange_rate END)
            FROM purchase_order_payments pop
            WHERE pop.loading_record_id = plr.id
              AND pop.deleted_at IS NULL
              AND pop.status = 'posted'
          ), 0)
      ELSE 0
    END,
    exchange_rate = v_order_exchange_rate
  WHERE plr.purchase_order_id = p_purchase_order_id
    AND plr.deleted_at IS NULL;

END;
$function$

