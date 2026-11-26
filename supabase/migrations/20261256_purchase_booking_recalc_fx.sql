-- Combines 20261253_purchase_booking_recalc_fx (PR #236: the booking's saved ÷ / × FX operator) with
-- 20261255_purchase_booking_applied_amount (PR #268: exact applied_purchase_amount). Both redefined the same function;
-- this keeps BOTH behaviours so neither silently replaces the other. Definition change only: no rows are rewritten.
BEGIN;

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
  v_order_currency text;
  v_base_currency text;
  v_order_rate_to_base numeric;
  v_total_paid_all numeric(18,4);
  v_order_total_raw numeric(18,4);
  v_total_goods_original numeric(18,4);
  v_total_goods_usd numeric(18,4);
  v_form_data jsonb;
  v_fx_operator text;
BEGIN
  SELECT COALESCE(po.order_total, 0),
         COALESCE(po.total_goods_original, 0),
         COALESCE(po.total_goods_usd, 0),
         COALESCE(NULLIF(po.exchange_rate, 0), 1),
         UPPER(TRIM(COALESCE(po.currency_code, po.purchase_currency, 'USD'))),
         UPPER(TRIM(COALESCE(c.currency_code, po.currency_code, po.purchase_currency, 'USD'))), po.form_data
  INTO v_order_total_raw, v_total_goods_original, v_total_goods_usd, v_order_exchange_rate, v_order_currency, v_base_currency, v_form_data
  FROM purchase_orders po
  LEFT JOIN countries c ON c.id = po.country_id
  WHERE po.id = p_purchase_order_id
    AND po.deleted_at IS NULL;

  -- Older bookings can contain a JSON string inside the JSONB column.
  IF jsonb_typeof(v_form_data) = 'string' THEN
    BEGIN
      v_form_data := (v_form_data #>> '{}')::jsonb;
    EXCEPTION WHEN invalid_text_representation THEN
      v_form_data := '{}'::jsonb;
    END;
  END IF;
  v_fx_operator := COALESCE(v_form_data #>> '{form,operator}',
                            v_form_data #>> '{goodsEntries,0,op}',
                            v_form_data #>> '{goodsEntries,0,operator}', '*');

  v_order_rate_to_base := CASE
    WHEN v_order_currency = v_base_currency THEN 1
    WHEN v_fx_operator = '/' THEN 1 / v_order_exchange_rate
    ELSE COALESCE(NULLIF(v_order_exchange_rate, 0), 1)
  END;

  -- Order total, in the PURCHASE currency: prefer the canonical original-currency
  -- column; fall back (legacy orders only) to un-converting order_total.
  v_total := CASE
    WHEN v_total_goods_original > 0 THEN v_total_goods_original
    WHEN v_total_goods_usd > 0 THEN v_total_goods_usd
    WHEN v_fx_operator = '/' OR v_order_rate_to_base > 1 THEN ROUND(v_order_total_raw / v_order_rate_to_base, 4)
    ELSE v_order_total_raw
  END;

  SELECT
    COALESCE(SUM(CASE WHEN kind = 'advance'
      THEN COALESCE(applied_purchase_amount, CASE WHEN UPPER(TRIM(COALESCE(currency_code, v_order_currency))) = v_order_currency
                THEN amount
                ELSE ROUND(COALESCE(base_currency_amount, amount * COALESCE(NULLIF(exchange_rate,0),1))
                           / NULLIF(v_order_rate_to_base, 0), 4)
           END)
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'remaining'
      THEN COALESCE(applied_purchase_amount, CASE WHEN UPPER(TRIM(COALESCE(currency_code, v_order_currency))) = v_order_currency
                THEN amount
                ELSE ROUND(COALESCE(base_currency_amount, amount * COALESCE(NULLIF(exchange_rate,0),1))
                           / NULLIF(v_order_rate_to_base, 0), 4)
           END)
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'credit'
      THEN COALESCE(applied_purchase_amount, CASE WHEN UPPER(TRIM(COALESCE(currency_code, v_order_currency))) = v_order_currency
                THEN amount
                ELSE ROUND(COALESCE(base_currency_amount, amount * COALESCE(NULLIF(exchange_rate,0),1))
                           / NULLIF(v_order_rate_to_base, 0), 4)
           END)
      ELSE 0 END), 0)
  INTO v_adv, v_rem, v_cr
  FROM purchase_order_payments
  WHERE purchase_order_id = p_purchase_order_id
    AND deleted_at IS NULL
    AND status = 'posted';

  v_total_paid_all := v_adv + v_rem + v_cr;
  v_due := GREATEST(v_total - v_total_paid_all, 0);

  IF v_total <= 0 THEN
    v_status := 'pending';
  ELSIF v_due = 0 THEN
    v_status := 'completed';
  ELSIF v_total_paid_all > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

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

  UPDATE purchase_orders
  SET advance_paid = v_adv,
      remaining_paid = v_rem,
      credit_amount = v_cr,
      remaining_due = v_due,
      payment_status = v_status,
      ledger_posting_status = v_posting,
      updated_at = NOW()
  WHERE id = p_purchase_order_id;

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
      WHEN plr.total_quantity > 0 THEN ROUND(v_total * (plr.loaded_quantity / plr.total_quantity) * v_order_rate_to_base, 4)
      ELSE 0
    END,
    loaded_advance_local = CASE
      WHEN plr.total_quantity > 0 THEN ROUND(v_adv * (plr.loaded_quantity / plr.total_quantity) * v_order_rate_to_base, 4)
      ELSE 0
    END,
    payment_made = COALESCE((
      SELECT SUM(COALESCE(pop.applied_purchase_amount, ROUND(COALESCE(pop.base_currency_amount, pop.amount * COALESCE(NULLIF(pop.exchange_rate,0),1))
                       / NULLIF(v_order_rate_to_base, 0), 4)))
      FROM purchase_order_payments pop
      WHERE pop.loading_record_id = plr.id
        AND pop.deleted_at IS NULL
        AND pop.status = 'posted'
    ), 0),
    remaining_loading_balance = CASE
      WHEN plr.total_quantity > 0 THEN
        ROUND(v_total * (plr.loaded_quantity / plr.total_quantity), 4)
        - COALESCE((
            SELECT SUM(COALESCE(pop.applied_purchase_amount, ROUND(COALESCE(pop.base_currency_amount, pop.amount * COALESCE(NULLIF(pop.exchange_rate,0),1))
                             / NULLIF(v_order_rate_to_base, 0), 4)))
            FROM purchase_order_payments pop
            WHERE pop.loading_record_id = plr.id
              AND pop.deleted_at IS NULL
              AND pop.status = 'posted'
          ), 0)
      ELSE 0
    END,
    exchange_rate = v_order_rate_to_base
  WHERE plr.purchase_order_id = p_purchase_order_id
    AND plr.deleted_at IS NULL;
END;
$function$;


INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261256_purchase_booking_recalc_fx', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;
