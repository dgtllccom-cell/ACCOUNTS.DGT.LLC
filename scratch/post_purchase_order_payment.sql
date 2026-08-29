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
  v_currency text;
  v_exchange_rate numeric;
  v_base_amount numeric;
  v_reference_no text;
  v_debit_currency text;
  v_credit_currency text;
  v_existing_entry_id uuid;
  v_source_transaction_id uuid;
begin
  select * into v_order
  from purchase_orders
  where id = p_purchase_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Purchase order not found';
  end if;

  -- Idempotency guard: a purchase order may only have one active (non-cancelled) roznamcha posting
  -- for the 'booking' kind. This blocks duplicate postings from re-transfer / double submission,
  -- regardless of which caller (API route, RPC, future integration) invokes this function.
  -- Advance/remaining/credit payments are legitimately repeatable and are NOT guarded here.
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

  -- Lookup the ledger final currency
  select coalesce(currency, 'PKR') into v_debit_currency from ledgers where id = p_debit_ledger_id;
  select coalesce(currency, 'PKR') into v_credit_currency from ledgers where id = p_credit_ledger_id;

  v_currency := upper(trim(coalesce(p_currency_code, v_order.currency_code, 'USD')));
  v_exchange_rate := case when coalesce(p_exchange_rate, 0) <= 0 then 1 else p_exchange_rate end;
  v_base_amount := round(coalesce(p_amount, 0) * v_exchange_rate, 4);
  v_reference_no := coalesce(nullif(trim(p_reference_no), ''), v_order.purchase_order_no);

  v_roz_type := case
    when v_order.city_branch_id is not null or v_order.country_branch_id is not null then 'branch'::roznamcha_type
    when v_order.country_id is not null then 'country'::roznamcha_type
    else 'super_admin'::roznamcha_type
  end;

  v_journal := concat('PO-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_voucher := concat('POPAY-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_line_rate := 1; -- The roznamcha line is explicitly in the final base currency, so multiplier is 1.

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', coalesce(nullif(trim(p_narration), ''), 'Purchase payment debit'),
      'debit', v_base_amount,
      'credit', 0,
      'currency', coalesce(v_debit_currency, v_currency),
      'usdRate', v_line_rate
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', coalesce(nullif(trim(p_narration), ''), 'Purchase payment credit'),
      'debit', 0,
      'credit', v_base_amount,
      'currency', coalesce(v_credit_currency, v_currency),
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
    coalesce(nullif(trim(p_narration), ''), concat('Purchase payment for ', v_reference_no)),
    v_lines,
    true
  );

  -- Only the 'booking' kind reuses the order's own id (so the pre-check above can find it and
  -- block a second booking); every repeatable kind gets the entry's own unique id instead, so
  -- the unique index below never falsely collides between two separate legitimate payments.
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
    original_currency_code = v_currency,
    currency_name = v_currency,
    base_currency_amount = v_base_amount,
    entry_category = 'business'
  where id = v_entry_id;

  insert into purchase_order_payments (
    purchase_order_id,
    kind,
    entry_date,
    amount,
    currency_code,
    exchange_rate,
    debit_ledger_id,
    credit_ledger_id,
    roznamcha_entry_id,
    status,
    reference_no,
    narration,
    source_module,
    source_transaction_type,
    source_reference_no,
    original_currency_code,
    currency_name,
    base_currency_amount,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_order.id,
    p_kind,
    p_entry_date,
    p_amount,
    v_currency,
    case
      when v_currency = upper(trim(coalesce(v_order.currency_code, 'USD'))) then 1
      else coalesce(nullif(v_order.exchange_rate, 0), p_exchange_rate, 1)
    end,
    p_debit_ledger_id,
    p_credit_ledger_id,
    v_entry_id,
    'posted',
    v_reference_no,
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
    v_currency,
    v_currency,
    v_base_amount,
    auth.uid(),
    now(),
    now()
  )
  returning id into v_po_payment_id;

  perform recalc_purchase_order_payment_totals(v_order.id);

  return v_po_payment_id;
end;
$function$

