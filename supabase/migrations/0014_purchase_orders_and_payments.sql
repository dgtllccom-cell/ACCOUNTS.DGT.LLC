-- ERP/FMS: Purchase Orders + Payment Parameters (Advance / Remaining / Credit)
-- This migration adds a minimal, DB-backed purchase order foundation and
-- a transaction-safe payment posting function that writes to Roznamcha + Ledgers.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'purchase_order_status') then
    create type purchase_order_status as enum ('pending', 'partial', 'completed', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'purchase_order_payment_kind') then
    create type purchase_order_payment_kind as enum ('advance', 'remaining', 'credit');
  end if;
end $$;

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  -- Enterprise scope (isolation)
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),

  purchase_order_no text not null,
  purchase_contract_no text,

  supplier_company_id uuid references companies(id),

  currency_code text not null default 'USD',
  exchange_rate numeric(18, 8) not null default 1,
  order_total numeric(18, 4) not null default 0,

  advance_paid numeric(18, 4) not null default 0,
  remaining_paid numeric(18, 4) not null default 0,
  credit_amount numeric(18, 4) not null default 0,
  remaining_due numeric(18, 4) not null default 0,

  payment_status purchase_order_status not null default 'pending',
  ledger_posting_status document_status not null default 'draft',

  -- Flexible payload until full PO schema is modeled
  form_data jsonb,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists purchase_orders_scope_idx
  on purchase_orders (country_id, country_branch_id, city_branch_id)
  where deleted_at is null;

create unique index if not exists purchase_orders_no_unique
  on purchase_orders (purchase_order_no)
  where deleted_at is null;

create table if not exists purchase_order_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  kind purchase_order_payment_kind not null,

  entry_date date not null,
  amount numeric(18, 4) not null,
  currency_code text not null default 'USD',
  exchange_rate numeric(18, 8) not null default 1,

  debit_ledger_id uuid not null references ledgers(id),
  credit_ledger_id uuid not null references ledgers(id),

  roznamcha_entry_id uuid references roznamcha_entries(id),
  status document_status not null default 'draft',
  reference_no text,
  narration text,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists purchase_order_payments_order_idx
  on purchase_order_payments (purchase_order_id)
  where deleted_at is null;

create index if not exists purchase_order_payments_kind_idx
  on purchase_order_payments (kind, entry_date)
  where deleted_at is null;

-- Recalculate payment totals and derived status for a purchase order.
create or replace function recalc_purchase_order_payment_totals(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(18,4);
  v_adv numeric(18,4);
  v_rem numeric(18,4);
  v_cr numeric(18,4);
  v_due numeric(18,4);
  v_status purchase_order_status;
begin
  select coalesce(order_total,0) into v_total
  from purchase_orders
  where id = p_purchase_order_id
    and deleted_at is null;

  select
    coalesce(sum(case when kind='advance' then amount else 0 end),0),
    coalesce(sum(case when kind='remaining' then amount else 0 end),0),
    coalesce(sum(case when kind='credit' then amount else 0 end),0)
  into v_adv, v_rem, v_cr
  from purchase_order_payments
  where purchase_order_id = p_purchase_order_id
    and deleted_at is null
    and status = 'posted';

  v_due := greatest(v_total - v_adv - v_rem - v_cr, 0);

  if v_total <= 0 then
    v_status := 'pending';
  elsif v_due = 0 then
    v_status := 'completed';
  elsif (v_adv + v_rem + v_cr) > 0 then
    v_status := 'partial';
  else
    v_status := 'pending';
  end if;

  update purchase_orders
  set advance_paid = v_adv,
      remaining_paid = v_rem,
      credit_amount = v_cr,
      remaining_due = v_due,
      payment_status = v_status,
      updated_at = now()
  where id = p_purchase_order_id;
end $$;

-- Post a purchase order payment:
-- Creates a balanced Roznamcha entry (debit + credit) and records it.
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

  perform recalc_purchase_order_payment_totals(p_purchase_order_id);

  return v_po_payment_id;
end $$;

alter table purchase_orders enable row level security;
alter table purchase_order_payments enable row level security;

-- Read within scope.
create policy purchase_orders_read on purchase_orders
  for select
  using (
    (country_id is null and is_super_admin())
    or (country_id is not null and can_access_country(country_id))
  );

create policy purchase_orders_insert on purchase_orders
  for insert
  with check (
    (country_id is null and is_super_admin())
    or (country_id is not null and can_access_country(country_id))
  );

create policy purchase_orders_update on purchase_orders
  for update
  using (
    (country_id is null and is_super_admin())
    or (country_id is not null and can_access_country(country_id))
  )
  with check (
    (country_id is null and is_super_admin())
    or (country_id is not null and can_access_country(country_id))
  );

create policy purchase_order_payments_read on purchase_order_payments
  for select
  using (
    exists (
      select 1 from purchase_orders o
      where o.id = purchase_order_payments.purchase_order_id
        and o.deleted_at is null
        and (
          (o.country_id is null and is_super_admin())
          or (o.country_id is not null and can_access_country(o.country_id))
        )
    )
  );

create policy purchase_order_payments_write on purchase_order_payments
  for insert
  with check (
    exists (
      select 1 from purchase_orders o
      where o.id = purchase_order_payments.purchase_order_id
        and o.deleted_at is null
        and (
          (o.country_id is null and is_super_admin())
          or (o.country_id is not null and can_access_country(o.country_id))
        )
    )
  );
