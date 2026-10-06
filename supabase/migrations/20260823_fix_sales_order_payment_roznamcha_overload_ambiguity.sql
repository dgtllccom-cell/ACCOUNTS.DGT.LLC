-- post_roznamcha_entry has two overloads: an 11-arg original and a 12-arg version with a
-- trailing p_bypass_ledger_scope boolean DEFAULT, added later (used by
-- post_purchase_order_payment, which already passes all 12 args explicitly — see its call site).
-- post_sales_order_payment was never updated to match and still calls it with only 11 args,
-- which is genuinely ambiguous between the two overloads (the 12-arg one accepts 11 args via its
-- default), so every sales payment/booking post has been failing with
-- "function post_roznamcha_entry(...) is not unique". This mirrors the exact fix already applied
-- to the purchase-side function; no other logic changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.post_sales_order_payment(
  p_sales_order_id uuid,
  p_payment_kind text,
  p_entry_date date,
  p_amount numeric,
  p_currency_code text,
  p_exchange_rate numeric,
  p_debit_ledger_id uuid,
  p_credit_ledger_id uuid,
  p_reference_no text,
  p_narration text
)
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
begin
  select * into v_order
  from sales_orders
  where id = p_sales_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Sales order not found';
  end if;

  -- Idempotency guard: mirrors the purchase-side guard — only the initial 'booking' posting is
  -- restricted to one-per-order. Advance/remaining/credit payments are legitimately repeatable
  -- and must not be blocked by an earlier payment of the same kind.
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

  -- Determine posting type
  v_roz_type := case
    when v_order.city_branch_id is not null then 'branch'::roznamcha_type
    when v_order.country_id is not null then 'country'::roznamcha_type
    else 'super_admin'::roznamcha_type
  end;

  v_journal := concat('SO-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_voucher := concat('SOPAY-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', nullif(trim(coalesce(p_narration,'')), ''),
      'debit', p_amount,
      'credit', 0,
      'currency', upper(trim(coalesce(p_currency_code,'USD'))),
      'exchangeRate', p_exchange_rate
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', nullif(trim(coalesce(p_narration,'')), ''),
      'debit', 0,
      'credit', p_amount,
      'currency', upper(trim(coalesce(p_currency_code,'USD'))),
      'exchangeRate', p_exchange_rate
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
    p_narration,
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
    p_amount,
    upper(trim(coalesce(p_currency_code,'USD'))),
    p_exchange_rate,
    'posted',
    nullif(trim(coalesce(p_reference_no,'')), ''),
    auth.uid(),
    now()
  )
  returning id into v_payment_id;

  perform recalc_sales_order_payment_totals(p_sales_order_id);

  return v_payment_id;
end $function$;

COMMIT;
