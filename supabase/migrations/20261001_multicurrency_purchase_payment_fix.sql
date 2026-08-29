-- ============================================================================
-- Multi-currency Purchase / Payment accounting — coherent model
-- Surfaced by the real-contract UAT (DSA2025-0908: USD 220,500 purchase,
-- AED functional @ 3.675). Fixes the two defects the UAT found:
--
--   1. recalc_purchase_order_payment_totals divided every payment by
--      `exchange_rate`, assuming `amount` is always in the functional currency.
--      For a USD-priced order it under-scaled advance_paid / remaining_due by
--      the rate (e.g. paid USD 20,050 -> recorded 5,455.78).
--
--   2. post_purchase_order_payment wrote purchase_order_payments.exchange_rate = 1
--      whenever the payment currency equalled purchase_orders.currency_code
--      (which holds the PURCHASE currency, not the functional one) — so a real
--      USD->AED conversion recorded "rate 1" even though base_currency_amount
--      was correctly amount * 3.675. It also labelled the roznamcha line with
--      the ledger's own currency, so a USD-denominated supplier ledger received
--      an AED base amount tagged "USD".
--
-- CANONICAL MODEL (documented here, enforced by both functions):
--
--   base / functional currency  = countries.currency_code of the order's country
--                                 (UAE -> AED). The general ledger and every
--                                 roznamcha line are denominated in it.
--   purchase_orders.currency_code / .purchase_currency = the PURCHASE/original
--                                 currency (e.g. USD). .exchange_rate =
--                                 base-currency units per 1 purchase-currency
--                                 unit. .order_total is in the purchase currency.
--   purchase_order_payments.currency_code       = the payment's TRANSACTION currency
--   purchase_order_payments.amount              = original amount, in currency_code
--   purchase_order_payments.exchange_rate       = base-currency units per 1
--                                 currency_code unit, FROZEN at posting
--                                 (= 1 iff currency_code == base currency)
--   purchase_order_payments.base_currency_amount = round(amount * exchange_rate, 4)
--                                 -- INVARIANT; the value in the base currency
--   purchase_order_payments.original_currency_code = currency_code
--
--   advance_paid / remaining_paid / credit_amount / remaining_due on
--   purchase_orders stay in the PURCHASE currency (consistent with order_total
--   and with all historical rows).
--
-- Idempotent: two CREATE OR REPLACE FUNCTION statements; safe to re-run.
-- No data is rewritten. Historical single-currency orders are unaffected
-- (base == purchase currency -> rate_to_base = 1 -> identical arithmetic).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. post_purchase_order_payment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_purchase_order_payment(p_purchase_order_id uuid, p_kind purchase_order_payment_kind, p_entry_date date, p_amount numeric, p_currency_code text, p_exchange_rate numeric, p_debit_ledger_id uuid, p_credit_ledger_id uuid, p_reference_no text, p_narration text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order purchase_orders%rowtype;
  v_po_payment_id uuid;
  v_roz_type roznamcha_type;
  v_journal text;
  v_voucher text;
  v_lines jsonb;
  v_entry_id uuid;
  v_line_rate numeric;
  v_txn_currency text;      -- the payment's transaction currency
  v_base_currency text;     -- the order country's functional currency
  v_order_currency text;    -- the order's purchase currency
  v_fx_rate numeric;        -- base-currency units per 1 txn-currency unit (frozen)
  v_order_rate numeric;     -- base-currency units per 1 purchase-currency unit
  v_base_amount numeric;    -- payment value in the base currency
  v_reference_no text;
  v_existing_entry_id uuid;
  v_source_transaction_id uuid;
  v_line_desc text;
  v_orig_note text := '';
begin
  select * into v_order
  from purchase_orders
  where id = p_purchase_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Purchase order not found';
  end if;

  -- Idempotency guard: one active (non-cancelled) 'booking' roznamcha posting per PO.
  if p_kind = 'booking' then
    select id into v_existing_entry_id
    from roznamcha_entries
    where source_module = 'purchase'
      and source_transaction_type = 'purchase_booking_transfer'
      and source_transaction_id = p_purchase_order_id
      and deleted_at is null
      and status <> 'cancelled'
    limit 1;

    if v_existing_entry_id is not null then
      raise exception 'This purchase order has already been posted to Roznamcha (entry %). Duplicate posting is not allowed.', v_existing_entry_id;
    end if;
  end if;

  if p_debit_ledger_id is null or p_credit_ledger_id is null then
    raise exception 'Debit and credit ledgers are required';
  end if;
  if p_debit_ledger_id = p_credit_ledger_id then
    raise exception 'Debit and credit ledgers must be different';
  end if;

  -- Resolve the currencies.
  v_order_currency := upper(trim(coalesce(v_order.currency_code, v_order.purchase_currency, 'USD')));
  v_txn_currency   := upper(trim(coalesce(p_currency_code, v_order_currency, 'USD')));

  select upper(trim(coalesce(c.currency_code, v_order_currency)))
    into v_base_currency
  from countries c
  where c.id = v_order.country_id;
  v_base_currency := coalesce(v_base_currency, v_order_currency, 'USD');

  -- base units per 1 purchase-currency unit
  v_order_rate := case
    when v_order_currency = v_base_currency then 1
    else coalesce(nullif(v_order.exchange_rate, 0), 1)
  end;

  -- base units per 1 txn-currency unit (the historical FX rate, frozen here)
  if v_txn_currency = v_base_currency then
    v_fx_rate := 1;
  elsif v_txn_currency = v_order_currency then
    -- payment made in the purchase currency -> use the order's rate to base,
    -- unless the caller supplied a specific rate for this payment.
    v_fx_rate := case
      when coalesce(p_exchange_rate, 0) > 0 and p_exchange_rate <> 1 then p_exchange_rate
      else v_order_rate
    end;
  else
    -- payment in a third currency -> the caller must supply its base rate.
    v_fx_rate := case when coalesce(p_exchange_rate, 0) > 0 then p_exchange_rate else 1 end;
  end if;
  if coalesce(v_fx_rate, 0) <= 0 then v_fx_rate := 1; end if;

  v_base_amount := round(coalesce(p_amount, 0) * v_fx_rate, 4);
  v_reference_no := coalesce(nullif(trim(p_reference_no), ''), v_order.purchase_order_no);

  if v_txn_currency <> v_base_currency then
    v_orig_note := ' | Orig: ' || v_txn_currency || ' ' ||
                   trim(to_char(coalesce(p_amount, 0), 'FM999999999990.00')) || ' @ ' ||
                   trim(to_char(v_fx_rate, 'FM999999990.999999')) || ' ' || v_base_currency;
  end if;
  v_line_desc := coalesce(nullif(trim(p_narration), ''), 'Purchase payment') || v_orig_note;

  v_roz_type := case
    when v_order.city_branch_id is not null or v_order.country_branch_id is not null then 'branch'::roznamcha_type
    when v_order.country_id is not null then 'country'::roznamcha_type
    else 'super_admin'::roznamcha_type
  end;

  v_journal := concat('PO-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_voucher := concat('POPAY-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_line_rate := 1; -- roznamcha lines are already in the base currency

  -- Every roznamcha line is in the BASE currency and labelled with it — never
  -- the individual ledger's own currency (that was the "AED shown as USD" bug).
  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', v_line_desc,
      'debit', v_base_amount,
      'credit', 0,
      'currency', v_base_currency,
      'usdRate', v_line_rate
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', v_line_desc,
      'debit', 0,
      'credit', v_base_amount,
      'currency', v_base_currency,
      'usdRate', v_line_rate
    )
  );

  v_entry_id := post_roznamcha_entry(
    v_roz_type,
    v_order.country_id,
    v_order.country_branch_id,
    v_order.city_branch_id,
    v_journal,
    v_voucher,
    p_entry_date,
    null::uuid,
    v_reference_no,
    coalesce(nullif(trim(p_narration), ''), concat('Purchase payment for ', v_reference_no)) || v_orig_note,
    v_lines,
    true
  );

  v_source_transaction_id := case when p_kind = 'booking' then v_order.id else v_entry_id end;

  update roznamcha_entries
  set
    source_module = 'purchase',
    source_transaction_type = case p_kind
      when 'booking' then 'purchase_booking_transfer'
      when 'advance' then 'purchase_advance_payment'
      when 'remaining' then 'purchase_remaining_payment'
      when 'credit' then 'purchase_credit_payment'
      else 'purchase_payment'
    end,
    source_transaction_id = v_source_transaction_id,
    source_reference_no = v_reference_no,
    original_currency_code = v_txn_currency,
    currency_name = v_txn_currency,
    base_currency_amount = v_base_amount,
    entry_category = 'business'
  where id = v_entry_id;

  insert into purchase_order_payments (
    purchase_order_id, kind, entry_date, amount, currency_code, exchange_rate,
    debit_ledger_id, credit_ledger_id, roznamcha_entry_id, status, reference_no,
    narration, source_module, source_transaction_type, source_reference_no,
    original_currency_code, currency_name, base_currency_amount,
    created_by, created_at, updated_at
  )
  values (
    v_order.id, p_kind, p_entry_date,
    p_amount,                 -- original amount, in the transaction currency
    v_txn_currency,           -- the transaction currency
    v_fx_rate,                -- REAL base-per-txn rate, frozen (never a misleading 1)
    p_debit_ledger_id, p_credit_ledger_id, v_entry_id, 'posted', v_reference_no,
    nullif(trim(coalesce(p_narration, '')), ''),
    'purchase',
    case p_kind
      when 'booking' then 'purchase_booking_transfer'
      when 'advance' then 'purchase_advance_payment'
      when 'remaining' then 'purchase_remaining_payment'
      when 'credit' then 'purchase_credit_payment'
      else 'purchase_payment'
    end,
    v_reference_no,
    v_txn_currency,
    v_txn_currency,
    v_base_amount,            -- value in the base currency (= amount * rate)
    auth.uid(), now(), now()
  )
  returning id into v_po_payment_id;

  perform recalc_purchase_order_payment_totals(v_order.id);

  return v_po_payment_id;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 2. recalc_purchase_order_payment_totals
-- ----------------------------------------------------------------------------
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
BEGIN
  -- Order total (purchase currency), the order's FX rate, and the currencies.
  SELECT COALESCE(po.order_total, 0),
         COALESCE(NULLIF(po.exchange_rate, 0), 1),
         UPPER(TRIM(COALESCE(po.currency_code, po.purchase_currency, 'USD'))),
         UPPER(TRIM(COALESCE(c.currency_code, po.currency_code, po.purchase_currency, 'USD')))
  INTO v_total, v_order_exchange_rate, v_order_currency, v_base_currency
  FROM purchase_orders po
  LEFT JOIN countries c ON c.id = po.country_id
  WHERE po.id = p_purchase_order_id
    AND po.deleted_at IS NULL;

  -- base-currency units per 1 purchase-currency unit
  v_order_rate_to_base := CASE
    WHEN v_order_currency = v_base_currency THEN 1
    ELSE COALESCE(NULLIF(v_order_exchange_rate, 0), 1)
  END;

  -- Each payment's contribution expressed in the PURCHASE currency (so it is
  -- directly comparable to order_total). base_currency_amount is authoritative
  -- and reliably in the base currency for every historical and new row; divide
  -- it by the order's rate-to-base to get back to the purchase currency. A
  -- payment already in the purchase currency contributes its own amount.
  SELECT
    COALESCE(SUM(CASE WHEN kind = 'advance'
      THEN CASE WHEN UPPER(TRIM(COALESCE(currency_code, v_order_currency))) = v_order_currency
                THEN amount
                ELSE ROUND(COALESCE(base_currency_amount, amount * COALESCE(NULLIF(exchange_rate,0),1))
                           / NULLIF(v_order_rate_to_base, 0), 4)
           END
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'remaining'
      THEN CASE WHEN UPPER(TRIM(COALESCE(currency_code, v_order_currency))) = v_order_currency
                THEN amount
                ELSE ROUND(COALESCE(base_currency_amount, amount * COALESCE(NULLIF(exchange_rate,0),1))
                           / NULLIF(v_order_rate_to_base, 0), 4)
           END
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN kind = 'credit'
      THEN CASE WHEN UPPER(TRIM(COALESCE(currency_code, v_order_currency))) = v_order_currency
                THEN amount
                ELSE ROUND(COALESCE(base_currency_amount, amount * COALESCE(NULLIF(exchange_rate,0),1))
                           / NULLIF(v_order_rate_to_base, 0), 4)
           END
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
      SELECT SUM(ROUND(COALESCE(pop.base_currency_amount, pop.amount * COALESCE(NULLIF(pop.exchange_rate,0),1))
                       / NULLIF(v_order_rate_to_base, 0), 4))
      FROM purchase_order_payments pop
      WHERE pop.loading_record_id = plr.id
        AND pop.deleted_at IS NULL
        AND pop.status = 'posted'
    ), 0),
    remaining_loading_balance = CASE
      WHEN plr.total_quantity > 0 THEN
        ROUND(v_total * (plr.loaded_quantity / plr.total_quantity), 4)
        - COALESCE((
            SELECT SUM(ROUND(COALESCE(pop.base_currency_amount, pop.amount * COALESCE(NULLIF(pop.exchange_rate,0),1))
                             / NULLIF(v_order_rate_to_base, 0), 4))
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
VALUES ('20261001_multicurrency_purchase_payment_fix', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
