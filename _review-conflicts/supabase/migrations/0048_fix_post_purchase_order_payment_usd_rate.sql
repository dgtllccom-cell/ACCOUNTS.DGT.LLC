-- Fix post_purchase_order_payment usd_rate double multiplication
--
-- The database function post_roznamcha_entry calculates usd_amount as:
--   usd_amount = round((line_debit + line_credit) * line_usd_rate, 4)
-- Since line_debit and line_credit are passed in local currency (e.g. AED),
-- line_usd_rate must be the reciprocal (e.g. 1 / 3.67) to convert it to USD.
--
-- We replace post_purchase_order_payment to pass 1 / p_exchange_rate as the line exchangeRate.

create or replace function post_purchase_order_payment(
  p_purchase_order_id uuid,
  p_kind purchase_order_payment_kind,
  p_entry_date date,
  p_amount numeric,
  p_currency_code text,
  p_exchange_rate numeric,
  p_debit_ledger_id uuid,
  p_credit_ledger_id uuid,
  p_reference_no text,
  p_narration text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order purchase_orders%rowtype;
  v_po_payment_id uuid;
  v_roz_type roznamcha_type;
  v_journal text;
  v_voucher text;
  v_entry_id uuid;
  v_lines jsonb;
  v_line_rate numeric;
begin
  select * into v_order
  from purchase_orders
  where id = p_purchase_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Purchase order not found';
  end if;

  -- Determine posting type (keeps existing Roznamcha rules).
  v_roz_type := case
    when v_order.city_branch_id is not null then 'branch'::roznamcha_type
    when v_order.country_id is not null then 'country'::roznamcha_type
    else 'super_admin'::roznamcha_type
  end;

  -- Scope checks and period lock checks are enforced inside post_roznamcha_entry via assert_* calls.
  v_journal := concat('PO-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_voucher := concat('POPAY-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));

  -- Convert the local rate to a reciprocal rate for the Roznamcha lines.
  v_line_rate := case when coalesce(p_exchange_rate, 1) = 0 then 1 else 1 / p_exchange_rate end;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', nullif(trim(coalesce(p_narration,'')), ''),
      'debit', p_amount,
      'credit', 0,
      'currency', upper(trim(coalesce(p_currency_code,'USD'))),
      'exchangeRate', v_line_rate
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', nullif(trim(coalesce(p_narration,'')), ''),
      'debit', 0,
      'credit', p_amount,
      'currency', upper(trim(coalesce(p_currency_code,'USD'))),
      'exchangeRate', v_line_rate
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
    null,
    p_reference_no,
    p_narration,
    v_lines
  );

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
    created_by,
    created_at,
    updated_at
  )
  values (
    p_purchase_order_id,
    p_kind,
    p_entry_date,
    p_amount,
    upper(trim(coalesce(p_currency_code,'USD'))),
    p_exchange_rate,
    p_debit_ledger_id,
    p_credit_ledger_id,
    v_entry_id,
    'posted',
    nullif(trim(coalesce(p_reference_no,'')), ''),
    nullif(trim(coalesce(p_narration,'')), ''),
    auth.uid(),
    now(),
    now()
  )
  returning id into v_po_payment_id;

  -- recalculate totals
  perform recalc_purchase_order_payment_totals(p_purchase_order_id);

  return v_po_payment_id;
end;
$$;
