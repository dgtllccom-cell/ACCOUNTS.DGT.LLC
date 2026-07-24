-- Multi-country transaction traceability hardening.
-- Safe additive migration: keeps existing purchase flow and extends the same
-- global/country/branch serial model to Sales plus explicit source metadata
-- on Roznamcha journal entries.

alter table if exists sales_orders
  add column if not exists super_admin_serial_number text,
  add column if not exists country_transaction_serial_number text,
  add column if not exists branch_transaction_serial_number text,
  add column if not exists original_currency_code text,
  add column if not exists currency_name text,
  add column if not exists base_currency_amount numeric(18, 4);

create unique index if not exists sales_orders_super_admin_serial_idx
  on sales_orders (super_admin_serial_number)
  where super_admin_serial_number is not null and deleted_at is null;

create index if not exists sales_orders_country_transaction_serial_idx
  on sales_orders (country_transaction_serial_number)
  where country_transaction_serial_number is not null and deleted_at is null;

create index if not exists sales_orders_branch_transaction_serial_idx
  on sales_orders (branch_transaction_serial_number)
  where branch_transaction_serial_number is not null and deleted_at is null;

alter table if exists roznamcha_entries
  add column if not exists source_module text,
  add column if not exists source_transaction_type text,
  add column if not exists source_transaction_id uuid,
  add column if not exists source_reference_no text,
  add column if not exists original_currency_code text,
  add column if not exists currency_name text,
  add column if not exists base_currency_amount numeric(18, 4);

create index if not exists roznamcha_entries_source_trace_idx
  on roznamcha_entries (source_module, source_transaction_type, source_transaction_id)
  where deleted_at is null;

alter table if exists purchase_order_payments
  add column if not exists source_module text,
  add column if not exists source_transaction_type text,
  add column if not exists source_reference_no text,
  add column if not exists original_currency_code text,
  add column if not exists currency_name text,
  add column if not exists base_currency_amount numeric(18, 4);

create index if not exists purchase_order_payments_source_trace_idx
  on purchase_order_payments (source_module, source_transaction_type, source_reference_no)
  where deleted_at is null;

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
  v_lines jsonb;
  v_entry_id uuid;
  v_line_rate numeric;
  v_currency text;
  v_exchange_rate numeric;
  v_base_amount numeric;
begin
  select * into v_order
  from purchase_orders
  where id = p_purchase_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Purchase order not found';
  end if;

  if p_debit_ledger_id is null or p_credit_ledger_id is null then
    raise exception 'Debit and credit ledgers are required';
  end if;

  if p_debit_ledger_id = p_credit_ledger_id then
    raise exception 'Debit and credit ledgers must be different';
  end if;

  v_currency := upper(trim(coalesce(p_currency_code, v_order.currency_code, 'USD')));
  v_exchange_rate := case when coalesce(p_exchange_rate, 0) <= 0 then 1 else p_exchange_rate end;
  v_base_amount := round(coalesce(p_amount, 0) * v_exchange_rate, 4);

  v_roz_type := case
    when v_order.city_branch_id is not null or v_order.country_branch_id is not null then 'branch'::roznamcha_type
    when v_order.country_id is not null then 'country'::roznamcha_type
    else 'super_admin'::roznamcha_type
  end;

  v_journal := concat('PO-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_voucher := concat('POPAY-', to_char(now(), 'YYYYMMDD'), '-', substr(replace(gen_random_uuid()::text,'-',''),1,6));

  -- post_roznamcha_entry stores usd_amount as amount * usdRate. Purchase
  -- screens pass local currency per 1 USD, so store the reciprocal as the
  -- line conversion rate.
  v_line_rate := case when v_exchange_rate = 0 then 1 else 1 / v_exchange_rate end;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'paymentEntryType', 'debit',
      'ledgerId', p_debit_ledger_id,
      'description', coalesce(nullif(trim(p_narration), ''), 'Purchase payment debit'),
      'debit', p_amount,
      'credit', 0,
      'currency', v_currency,
      'usdRate', v_line_rate
    ),
    jsonb_build_object(
      'paymentEntryType', 'credit',
      'ledgerId', p_credit_ledger_id,
      'description', coalesce(nullif(trim(p_narration), ''), 'Purchase payment credit'),
      'debit', 0,
      'credit', p_amount,
      'currency', v_currency,
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
    coalesce(nullif(trim(p_reference_no), ''), v_order.purchase_order_no),
    coalesce(nullif(trim(p_narration), ''), concat('Purchase payment for ', v_order.purchase_order_no)),
    v_lines,
    true
  );

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
    source_transaction_id = v_order.id,
    source_reference_no = v_order.purchase_order_no,
    original_currency_code = v_currency,
    currency_name = v_currency,
    base_currency_amount = v_base_amount
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
    v_exchange_rate,
    p_debit_ledger_id,
    p_credit_ledger_id,
    v_entry_id,
    'posted',
    coalesce(nullif(trim(p_reference_no), ''), v_order.purchase_order_no),
    nullif(trim(coalesce(p_narration, '')), ''),
    'purchase',
    case p_kind
      when 'booking' then 'purchase_booking_transfer'
      when 'advance' then 'purchase_advance_payment'
      when 'remaining' then 'purchase_remaining_payment'
      when 'credit' then 'purchase_credit_payment'
      else 'purchase_payment'
    end,
    v_order.purchase_order_no,
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
$$;

insert into erp_schema_migrations(name, status, applied_at)
values ('0056_multi_country_transaction_traceability', 'applied', now())
on conflict (name)
do update set status = excluded.status, applied_at = excluded.applied_at;
