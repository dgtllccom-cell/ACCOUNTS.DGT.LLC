-- Fix duplicate Purchase/Sales Bill transfer posting at the root cause, and add a persisted
-- entry_category column so Roznamcha reports can filter by type (Business/Bank/Cash/Invoice/Transfer).
--
-- Part 1: Idempotency guard.
--   Purchase Bill transfer (app/api/erp/purchases/orders/[id]/transfer/route.ts) called
--   post_purchase_booking_transfer -> post_purchase_order_payment -> post_roznamcha_entry with no
--   check for an existing posting, so re-transferring the same bill created a second roznamcha_entries
--   + roznamcha_lines + purchase_order_payments set. This adds a DB-level guard inside the RPC itself
--   (so ANY caller is protected, not just the one route) plus a partial unique index as a hard backstop.
--
-- Part 2: entry_category column.
--   The manual Cash Entry form already lets users pick Business/Bank/Cash/Invoice/Transfer
--   (sent to the API as `roznamchaCategory`), but the API silently dropped it. This persists it so
--   the new Roznamcha reports can filter by type using real data instead of client-side heuristics.

BEGIN;

-- ── Part 1a: partial unique index (defense in depth backstop) ──────────────────────────
create unique index if not exists roznamcha_entries_source_unique_idx
  on roznamcha_entries (source_module, source_transaction_type, source_transaction_id)
  where deleted_at is null and status <> 'cancelled' and source_transaction_id is not null;

-- ── Part 1b: guard inside post_purchase_order_payment itself ───────────────────────────
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
  v_reference_no text;
  v_debit_currency text;
  v_credit_currency text;
  v_existing_entry_id uuid;
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
$$;

-- ── Part 1c: same idempotency guard + traceability for Sales Bill transfer ─────────────
-- post_sales_order_payment never linked the roznamcha_entries row it creates back to the sales
-- order (no source_module/source_transaction_id were ever set, unlike the purchase equivalent),
-- so there was no way to trace a Roznamcha posting back to its Sales Bill, and the unique index
-- above could not protect sales postings either. This adds both.
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
  v_existing_entry_id uuid;
begin
  select * into v_order
  from sales_orders
  where id = p_sales_order_id
    and deleted_at is null;

  if not found then
    raise exception 'Sales order not found';
  end if;

  -- Idempotency guard: mirrors the purchase-side guard above.
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

  update roznamcha_entries
  set
    source_module = 'sales',
    source_transaction_type = 'sales_transfer_to_payment',
    source_transaction_id = v_order.id,
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
end $$;

-- ── Part 2: entry_category column ───────────────────────────────────────────────────────
alter table roznamcha_entries add column if not exists entry_category text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'roznamcha_entries_entry_category_check'
  ) then
    alter table roznamcha_entries
      add constraint roznamcha_entries_entry_category_check
      check (entry_category is null or entry_category in ('business', 'bank', 'cash', 'invoice', 'transfer'));
  end if;
end $$;

create index if not exists roznamcha_entries_entry_category_idx
  on roznamcha_entries (entry_category)
  where deleted_at is null;

-- Backfill any historical rows (safe no-op today on this project: 0 purchase/sales-sourced rows exist),
-- ported from the client-side classification in features/roznamcha/components/cash-entry-form.tsx
-- (getRoznamchaCategoryLabel), so this migration is also safe to run against environments that do
-- have historical data.
update roznamcha_entries re
set entry_category = 'transfer'
where entry_category is null
  and re.source_module = 'local_purchase';

update roznamcha_entries re
set entry_category = 'business'
where entry_category is null
  and re.source_module in ('purchase', 'sales');

update roznamcha_entries re
set entry_category = case
  when rl.payment_entry_type in ('bank_cheque', 'bank_deposit') then 'bank'
  when rl.payment_entry_type in ('cash_payment', 'cash_receipt') then 'cash'
  when rl.payment_entry_type = 'transfer' then 'transfer'
  else 'business'
end
from (
  select distinct on (roznamcha_entry_id) roznamcha_entry_id, payment_entry_type
  from roznamcha_lines
  order by roznamcha_entry_id, id
) rl
where re.entry_category is null
  and rl.roznamcha_entry_id = re.id;

update roznamcha_entries
set entry_category = 'business'
where entry_category is null;

COMMIT;
