-- Fix a currency double-conversion bug in Purchase Order booking transfers, and bring
-- Sales Orders up to the same (already-correct) original/base-currency architecture
-- Purchase Orders use, so the same class of bug cannot occur on the sales side either.
--
-- ROOT CAUSE (confirmed against a real Production posting): the booking wizards save
-- BOTH an already-converted local/base-currency total (order_total) AND the true
-- original-currency total (total_goods_original, purchase side only, already existed)
-- on the same order row. post_purchase_order_payment/post_purchase_booking_transfer
-- expects its p_amount argument to be in the order's OWN currency (currency_code) and
-- applies the exchange rate exactly once. The calling TypeScript code was passing
-- order_total (already converted) as p_amount alongside currency_code (the ORIGINAL
-- currency) — so the one correct conversion (126,500 USD -> 464,887.50 AED) was
-- immediately followed by a second, wrong one (464,887.50 -> 1,708,461.5625 AED) inside
-- the posting function. That TypeScript-side fix ships alongside this migration; this
-- migration fixes the two places the SAME wrong assumption ("order_total is in the
-- order's own currency") was baked into a database function.

-- 1. recalc_purchase_order_payment_totals: v_total was read directly from order_total
--    and labelled "purchase currency" in its own comment, but order_total is actually
--    already in the base/local currency. total_goods_original/total_goods_usd hold the
--    true purchase-currency total (populated by the wizard since these columns were
--    added) — prefer those, falling back to un-converting order_total for any order
--    that predates them.
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
BEGIN
  SELECT COALESCE(po.order_total, 0),
         COALESCE(po.total_goods_original, 0),
         COALESCE(po.total_goods_usd, 0),
         COALESCE(NULLIF(po.exchange_rate, 0), 1),
         UPPER(TRIM(COALESCE(po.currency_code, po.purchase_currency, 'USD'))),
         UPPER(TRIM(COALESCE(c.currency_code, po.currency_code, po.purchase_currency, 'USD')))
  INTO v_order_total_raw, v_total_goods_original, v_total_goods_usd, v_order_exchange_rate, v_order_currency, v_base_currency
  FROM purchase_orders po
  LEFT JOIN countries c ON c.id = po.country_id
  WHERE po.id = p_purchase_order_id
    AND po.deleted_at IS NULL;

  v_order_rate_to_base := CASE
    WHEN v_order_currency = v_base_currency THEN 1
    ELSE COALESCE(NULLIF(v_order_exchange_rate, 0), 1)
  END;

  -- Order total, in the PURCHASE currency: prefer the canonical original-currency
  -- column; fall back (legacy orders only) to un-converting order_total.
  v_total := CASE
    WHEN v_total_goods_original > 0 THEN v_total_goods_original
    WHEN v_total_goods_usd > 0 THEN v_total_goods_usd
    WHEN v_order_rate_to_base > 1 THEN ROUND(v_order_total_raw / v_order_rate_to_base, 4)
    ELSE v_order_total_raw
  END;

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

-- 2. Sales Orders: mirror purchase_orders' original/local/usd goods-total split, so the
--    sales booking wizard and transfer route have the same unambiguous field to read
--    that purchase already has.
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS total_goods_original numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_goods_local numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_goods_usd numeric(18,4) DEFAULT 0;

-- 3. sales_order_payments: mirror purchase_order_payments' original/base-currency split
--    (original_currency_code, currency_name, base_currency_amount) — required so
--    post_sales_order_payment can record both the transaction-currency amount and its
--    base-currency equivalent, exactly like the purchase-side function already does.
ALTER TABLE public.sales_order_payments
  ADD COLUMN IF NOT EXISTS original_currency_code text,
  ADD COLUMN IF NOT EXISTS currency_name text,
  ADD COLUMN IF NOT EXISTS base_currency_amount numeric(18,4);

-- 4. post_sales_order_payment: previously posted p_amount to the Roznamcha lines with NO
--    currency conversion at all (unlike the purchase-side function). That alone did not
--    double-convert (because sales_order_wizard.jsx, like the purchase wizard, was
--    already handing it an already-converted order_total) — but it silently posted a
--    base-currency amount mislabeled with the original currency code, and gave sales
--    orders no correct way to ever post a genuine original-currency payment amount.
--    Rewritten to convert exactly once, mirroring post_purchase_order_payment.
CREATE OR REPLACE FUNCTION public.post_sales_order_payment(p_sales_order_id uuid, p_payment_kind text, p_entry_date date, p_amount numeric, p_currency_code text, p_exchange_rate numeric, p_debit_ledger_id uuid, p_credit_ledger_id uuid, p_reference_no text, p_narration text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order sales_orders%rowtype;
  v_payment_id uuid;
  v_roz_type roznamcha_type;
  v_journal text;
  v_voucher text;
  v_entry_id uuid;
  v_lines jsonb;
  v_existing_entry_id uuid;
  v_source_transaction_id uuid;
  v_txn_currency text;
  v_base_currency text;
  v_order_currency text;
  v_order_rate numeric;
  v_fx_rate numeric;
  v_base_amount numeric;
  v_orig_note text := '';
  v_line_desc text;
begin
  select * into v_order
  from sales_orders
  where id = p_sales_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Sales order not found';
  end if;

  if coalesce(p_payment_kind, 'booking') = 'booking' then
    select id into v_existing_entry_id
    from roznamcha_entries
    where source_module = 'sales'
      and source_transaction_type = 'sales_transfer_to_payment'
      and source_transaction_id = p_sales_order_id
      and deleted_at is null
      and status <> 'cancelled'
    limit 1;

    if v_existing_entry_id is not null then
      raise exception 'This sales order has already been posted to Roznamcha (entry %). Duplicate posting is not allowed.', v_existing_entry_id;
    end if;
  end if;

  -- Resolve currencies exactly like post_purchase_order_payment: p_amount is in the
  -- order's OWN currency (currency_code) unless a different transaction currency is
  -- explicitly supplied, and it is converted to the base currency exactly once.
  v_order_currency := upper(trim(coalesce(v_order.currency_code, 'USD')));
  v_txn_currency := upper(trim(coalesce(p_currency_code, v_order_currency, 'USD')));

  select upper(trim(coalesce(c.currency_code, v_order_currency)))
    into v_base_currency
  from countries c
  where c.id = v_order.country_id;
  v_base_currency := coalesce(v_base_currency, v_order_currency, 'USD');

  v_order_rate := case
    when v_order_currency = v_base_currency then 1
    else coalesce(nullif(v_order.exchange_rate, 0), 1)
  end;

  if v_txn_currency = v_base_currency then
    v_fx_rate := 1;
  elsif v_txn_currency = v_order_currency then
    v_fx_rate := case
      when coalesce(p_exchange_rate, 0) > 0 and p_exchange_rate <> 1 then p_exchange_rate
      else v_order_rate
    end;
  else
    v_fx_rate := case when coalesce(p_exchange_rate, 0) > 0 then p_exchange_rate else 1 end;
  end if;
  if coalesce(v_fx_rate, 0) <= 0 then v_fx_rate := 1; end if;

  v_base_amount := round(coalesce(p_amount, 0) * v_fx_rate, 4);

  if v_txn_currency <> v_base_currency then
    v_orig_note := ' | Orig: ' || v_txn_currency || ' ' ||
                   trim(to_char(coalesce(p_amount, 0), 'FM999999999990.00')) || ' @ ' ||
                   trim(to_char(v_fx_rate, 'FM999999990.999999')) || ' ' || v_base_currency;
  end if;
  v_line_desc := coalesce(nullif(trim(p_narration), ''), 'Sales payment') || v_orig_note;

  v_roz_type := case
    when v_order.city_branch_id is not null then 'branch'::roznamcha_type
    when v_order.country_id is not null then 'country'::roznamcha_type
    else 'super_admin'::roznamcha_type
  end;

  v_journal := concat('SO-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_voucher := concat('SOPAY-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));

  -- Every roznamcha line is in the BASE currency and labelled with it, matching
  -- post_purchase_order_payment's own fix for the identical "AED shown as USD" issue.
  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', v_line_desc,
      'debit', v_base_amount,
      'credit', 0,
      'currency', v_base_currency,
      'exchangeRate', 1
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', v_line_desc,
      'debit', 0,
      'credit', v_base_amount,
      'currency', v_base_currency,
      'exchangeRate', 1
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
    p_reference_no,
    v_line_desc,
    v_lines,
    true
  );

  v_source_transaction_id := case when coalesce(p_payment_kind, 'booking') = 'booking' then v_order.id else v_entry_id end;

  update roznamcha_entries
  set
    source_module = 'sales',
    source_transaction_type = case coalesce(p_payment_kind, 'booking')
      when 'booking' then 'sales_transfer_to_payment'
      when 'advance' then 'sales_advance_payment'
      when 'remaining' then 'sales_remaining_payment'
      when 'credit' then 'sales_credit_payment'
      else 'sales_payment'
    end,
    source_transaction_id = v_source_transaction_id,
    source_reference_no = nullif(trim(coalesce(p_reference_no, '')), ''),
    original_currency_code = v_txn_currency,
    currency_name = v_txn_currency,
    base_currency_amount = v_base_amount,
    entry_category = 'business'
  where id = v_entry_id;

  insert into sales_order_payments (
    sales_order_id,
    roznamcha_entry_id,
    payment_kind,
    payment_date,
    amount,
    currency_code,
    exchange_rate,
    original_currency_code,
    currency_name,
    base_currency_amount,
    status,
    remarks,
    created_by,
    created_at
  )
  values (
    p_sales_order_id,
    v_entry_id,
    p_payment_kind,
    p_entry_date,
    p_amount,           -- original amount, in the transaction currency
    v_txn_currency,     -- the transaction currency
    v_fx_rate,          -- real base-per-txn rate, frozen (never a misleading 1)
    v_txn_currency,
    v_txn_currency,
    v_base_amount,      -- value in the base currency (= amount * rate)
    'posted',
    nullif(trim(coalesce(p_reference_no,'')), ''),
    auth.uid(),
    now()
  )
  returning id into v_payment_id;

  perform recalc_sales_order_payment_totals(p_sales_order_id);

  return v_payment_id;
end $function$;

-- 5. recalc_sales_order_payment_totals: previously compared order_total directly against
--    the raw SUM of sales_order_payments.amount, implicitly assuming both were in the
--    same currency. Now that post_sales_order_payment stores amount in the TRANSACTION
--    currency and base_currency_amount in the base currency, compare like-for-like in
--    the order's own currency, mirroring recalc_purchase_order_payment_totals.
CREATE OR REPLACE FUNCTION public.recalc_sales_order_payment_totals(p_sales_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total numeric(18,4);
  v_paid numeric(18,4);
  v_rem numeric(18,4);
  v_status text;
  v_order_currency text;
  v_order_rate numeric;
  v_order_total_raw numeric(18,4);
  v_total_goods_original numeric(18,4);
  v_total_goods_usd numeric(18,4);
begin
  select coalesce(order_total,0),
         coalesce(total_goods_original,0),
         coalesce(total_goods_usd,0),
         upper(trim(coalesce(currency_code, 'USD'))),
         coalesce(nullif(exchange_rate,0), 1)
    into v_order_total_raw, v_total_goods_original, v_total_goods_usd, v_order_currency, v_order_rate
  from sales_orders
  where id = p_sales_order_id
    and deleted_at is null;

  -- Order total, in the order's OWN currency: prefer the canonical original-currency
  -- column; fall back (legacy orders only) to un-converting order_total.
  v_total := case
    when v_total_goods_original > 0 then v_total_goods_original
    when v_total_goods_usd > 0 then v_total_goods_usd
    when v_order_rate > 1 then round(v_order_total_raw / v_order_rate, 4)
    else v_order_total_raw
  end;

  select coalesce(sum(
    case when upper(trim(coalesce(currency_code, v_order_currency))) = v_order_currency
      then amount
      else round(coalesce(base_currency_amount, amount * coalesce(nullif(exchange_rate,0),1)) / nullif(v_order_rate, 0), 4)
    end
  ), 0)
    into v_paid
  from sales_order_payments
  where sales_order_id = p_sales_order_id
    and deleted_at is null
    and status = 'posted';

  v_rem := greatest(v_total - v_paid, 0);

  if v_total <= 0 then
    v_status := 'pending';
  elsif v_rem = 0 then
    v_status := 'paid';
  elsif v_paid > 0 then
    v_status := 'partially_paid';
  else
    v_status := 'pending';
  end if;

  update sales_orders
  set paid_amount = v_paid,
      remaining_amount = v_rem,
      payment_status = v_status,
      updated_at = now()
  where id = p_sales_order_id;
end $function$;
