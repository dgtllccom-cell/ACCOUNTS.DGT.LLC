-- Add ledger_posting_status to sales_orders if it doesn't exist
alter table if exists sales_orders
  add column if not exists ledger_posting_status text not null default 'unposted';

-- Recalculate sales order payment totals and update order status
create or replace function recalc_sales_order_payment_totals(p_sales_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(18,2);
  v_paid numeric(18,2);
  v_rem numeric(18,2);
  v_status text;
begin
  select coalesce(order_total,0) into v_total
  from sales_orders
  where id = p_sales_order_id
    and deleted_at is null;

  select coalesce(sum(amount),0) into v_paid
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
end $$;

-- Post a sales order payment:
-- Creates a balanced Roznamcha entry (debit + credit) and records it.
create or replace function post_sales_order_payment(
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
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order sales_orders%rowtype;
  v_payment_id uuid;
  v_roz_type roznamcha_type;
  v_journal text;
  v_voucher text;
  v_entry_id uuid;
  v_lines jsonb;
begin
  select * into v_order
  from sales_orders
  where id = p_sales_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Sales order not found';
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
    null,
    p_reference_no,
    p_narration,
    v_lines
  );

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
end $$;

-- Wrapper function for post_sales_order_payment that accepts an explicit actor_id
create or replace function post_sales_booking_transfer(
  p_actor_id           uuid,
  p_sales_order_id     uuid,
  p_payment_kind       text,
  p_entry_date         date,
  p_amount             numeric,
  p_currency_code      text,
  p_exchange_rate      numeric,
  p_debit_ledger_id    uuid,
  p_credit_ledger_id   uuid,
  p_reference_no       text,
  p_narration          text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result uuid;
begin
  -- Inject the actor into the JWT claims
  if p_actor_id is not null then
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_actor_id::text, 'role', 'authenticated')::text,
      true  -- only for this transaction
    );
  end if;

  v_result := post_sales_order_payment(
    p_sales_order_id,
    p_payment_kind,
    p_entry_date,
    p_amount,
    p_currency_code,
    p_exchange_rate,
    p_debit_ledger_id,
    p_credit_ledger_id,
    p_reference_no,
    p_narration
  );

  return v_result;
end;
$$;

-- Grant permissions to authenticated and service_role
grant execute on function post_sales_booking_transfer(
  uuid, uuid, text, date, numeric, text, numeric, uuid, uuid, text, text
) to authenticated, service_role;
