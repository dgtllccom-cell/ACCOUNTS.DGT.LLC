-- ============================================================================
-- STEP 1A: Super Admin Accounting + Country Investment Ledger
-- STEP 1B: Country Account Auto-Creation & Branch Auto-Linking
-- STEP 1C: Inter-Country Transfers
-- STEP 1F: Serial Architecture Enhancement (global_reference_id)
-- ============================================================================

-- 1A. Super Admin Capital Accounts
-- Records: Opening Capital, Additional Investment, Capital Returned,
-- Owner Drawings, Annual P&L. Protected by RLS so only super_admin can write.
create table if not exists public.super_admin_capital_accounts (
  id uuid default gen_random_uuid() not null primary key,
  account_type text not null check (account_type in (
    'opening_capital', 'additional_investment', 'capital_returned',
    'owner_drawings', 'annual_profit_loss'
  )),
  country_id uuid references public.countries(id),
  description text,
  amount numeric(18,4) not null default 0,
  currency text not null default 'USD',
  exchange_rate numeric(18,8) not null default 1,
  base_amount numeric(18,4) not null default 0,
  reference_no text,
  narration text,
  financial_period_id uuid references public.financial_periods(id),
  ledger_posting_batch_id uuid references public.ledger_posting_batches(id),
  roznamcha_entry_id uuid,
  global_reference_id text,
  posted_by uuid references public.profiles(id),
  status text not null default 'posted' check (status in ('draft','posted','cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists super_admin_capital_accounts_type_idx
  on public.super_admin_capital_accounts (account_type, country_id)
  where deleted_at is null;

create index if not exists super_admin_capital_accounts_country_idx
  on public.super_admin_capital_accounts (country_id)
  where deleted_at is null and country_id is not null;

create unique index if not exists super_admin_capital_accounts_ref_idx
  on public.super_admin_capital_accounts (global_reference_id)
  where global_reference_id is not null and deleted_at is null;

-- RLS: Only super_admin can write
alter table public.super_admin_capital_accounts enable row level security;

drop policy if exists super_admin_capital_read on public.super_admin_capital_accounts;
create policy super_admin_capital_read on public.super_admin_capital_accounts
  for select using (true);

drop policy if exists super_admin_capital_write on public.super_admin_capital_accounts;
create policy super_admin_capital_write on public.super_admin_capital_accounts
  for all using (public.is_super_admin());

-- 1A. Country Investment Ledger
-- Summarizes each country's investment position per financial period.
create table if not exists public.country_investment_ledger (
  id uuid default gen_random_uuid() not null primary key,
  country_id uuid not null references public.countries(id),
  financial_period_id uuid references public.financial_periods(id),
  opening_investment numeric(18,4) not null default 0,
  additional_investment numeric(18,4) not null default 0,
  capital_returned numeric(18,4) not null default 0,
  net_investment numeric(18,4) not null default 0,
  income_total numeric(18,4) not null default 0,
  expense_total numeric(18,4) not null default 0,
  annual_profit_loss numeric(18,4) not null default 0,
  closing_position numeric(18,4) not null default 0,
  currency text not null default 'USD',
  last_calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists country_investment_ledger_country_period_idx
  on public.country_investment_ledger (country_id, financial_period_id)
  where deleted_at is null;

alter table public.country_investment_ledger enable row level security;

drop policy if exists country_investment_ledger_read on public.country_investment_ledger;
create policy country_investment_ledger_read on public.country_investment_ledger
  for select using (true);

drop policy if exists country_investment_ledger_write on public.country_investment_ledger;
create policy country_investment_ledger_write on public.country_investment_ledger
  for all using (public.is_super_admin());


-- ============================================================================
-- 1B. Country Accounts (auto-created when a Country is created)
-- ============================================================================
create table if not exists public.country_accounts (
  id uuid default gen_random_uuid() not null primary key,
  country_id uuid not null references public.countries(id),
  main_account_ledger_id uuid references public.ledgers(id),
  inter_country_ledger_id uuid references public.ledgers(id),
  investment_ledger_id uuid references public.ledgers(id),
  status text not null default 'active' check (status in ('active','inactive','closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists country_accounts_country_idx
  on public.country_accounts (country_id) where deleted_at is null;

alter table public.country_accounts enable row level security;

drop policy if exists country_accounts_read on public.country_accounts;
create policy country_accounts_read on public.country_accounts
  for select using (true);

drop policy if exists country_accounts_write on public.country_accounts;
create policy country_accounts_write on public.country_accounts
  for all using (public.is_super_admin());

-- Trigger: auto-create country account ledgers when a country is created
create or replace function public.auto_create_country_account()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_main_ledger_id uuid;
  v_inter_ledger_id uuid;
  v_invest_ledger_id uuid;
  v_currency text;
begin
  -- Skip if a country_account already exists
  if exists (select 1 from public.country_accounts where country_id = NEW.id and deleted_at is null) then
    return NEW;
  end if;

  v_currency := coalesce(NEW.currency_code, 'USD');

  -- Create Main Country Account ledger
  insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
  values ('country', NEW.id, 'CT-MAIN-' || coalesce(NEW.iso2, left(NEW.name, 3)),
          NEW.name || ' Main Account', v_currency, 'debit')
  returning id into v_main_ledger_id;

  -- Create Inter-Country Account ledger
  insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
  values ('country', NEW.id, 'CT-INTER-' || coalesce(NEW.iso2, left(NEW.name, 3)),
          NEW.name || ' Inter-Country Account', v_currency, 'debit')
  returning id into v_inter_ledger_id;

  -- Create Investment Account ledger
  insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
  values ('country', NEW.id, 'CT-INVEST-' || coalesce(NEW.iso2, left(NEW.name, 3)),
          NEW.name || ' Investment Account', 'USD', 'credit')
  returning id into v_invest_ledger_id;

  -- Create the country_accounts record
  insert into public.country_accounts (country_id, main_account_ledger_id, inter_country_ledger_id, investment_ledger_id)
  values (NEW.id, v_main_ledger_id, v_inter_ledger_id, v_invest_ledger_id);

  return NEW;
end;
$$;

drop trigger if exists trg_auto_create_country_account on public.countries;
create trigger trg_auto_create_country_account
  after insert on public.countries
  for each row
  execute function public.auto_create_country_account();


-- Trigger: auto-link new branch to country accounting structure
create or replace function public.auto_link_branch_to_country()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_country_account record;
  v_country_name text;
begin
  -- Find the country account
  select * into v_country_account
  from public.country_accounts
  where country_id = NEW.country_id and deleted_at is null
  limit 1;

  -- If no country account exists (shouldn't happen with the trigger above), skip
  if v_country_account is null then
    return NEW;
  end if;

  -- Get country name for ledger naming
  select name into v_country_name from public.countries where id = NEW.country_id limit 1;

  -- Create branch-level cash and bank ledgers linked to the country via parent_ledger_id
  insert into public.ledgers (scope, country_id, country_branch_id, code, name, currency, normal_balance, parent_ledger_id)
  values ('main_branch', NEW.country_id, NEW.id,
          'BR-CASH-' || NEW.code, NEW.name || ' Cash',
          NEW.local_currency, 'debit', v_country_account.main_account_ledger_id)
  on conflict do nothing;

  insert into public.ledgers (scope, country_id, country_branch_id, code, name, currency, normal_balance, parent_ledger_id)
  values ('main_branch', NEW.country_id, NEW.id,
          'BR-BANK-' || NEW.code, NEW.name || ' Bank',
          NEW.local_currency, 'debit', v_country_account.main_account_ledger_id)
  on conflict do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_link_branch_to_country on public.country_branches;
create trigger trg_auto_link_branch_to_country
  after insert on public.country_branches
  for each row
  execute function public.auto_link_branch_to_country();


-- ============================================================================
-- 1C. Inter-Country Transfers
-- ============================================================================
create table if not exists public.inter_country_transfers (
  id uuid default gen_random_uuid() not null primary key,
  transfer_no text not null,
  -- Source
  source_country_id uuid not null references public.countries(id),
  source_country_branch_id uuid references public.country_branches(id),
  source_city_branch_id uuid references public.city_branches(id),
  source_bank_cash_ledger_id uuid references public.ledgers(id),
  source_party_ledger_id uuid references public.ledgers(id),
  -- Destination
  dest_country_id uuid not null references public.countries(id),
  dest_country_branch_id uuid references public.country_branches(id),
  dest_city_branch_id uuid references public.city_branches(id),
  dest_bank_cash_ledger_id uuid references public.ledgers(id),
  dest_party_ledger_id uuid references public.ledgers(id),
  -- Amount & Currency
  amount numeric(18,4) not null check (amount > 0),
  original_currency text not null,
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  final_currency text not null,
  final_amount numeric(18,4) not null,
  direction text not null default 'debit' check (direction in ('debit','credit')),
  -- Description
  narration text,
  remarks text,
  -- Workflow
  status text not null default 'pending' check (status in (
    'pending','accepted','rejected','returned','cancelled'
  )),
  rejection_reason text,
  -- Users
  sender_user_id uuid references public.profiles(id),
  receiver_user_id uuid references public.profiles(id),
  -- Accounting Links (sender side)
  sender_roznamcha_entry_id uuid,
  sender_ledger_posting_batch_id uuid references public.ledger_posting_batches(id),
  -- Accounting Links (receiver side — set on acceptance)
  receiver_roznamcha_entry_id uuid,
  receiver_ledger_posting_batch_id uuid references public.ledger_posting_batches(id),
  -- Idempotency
  idempotency_key text,
  -- Audit
  edit_history jsonb not null default '[]'::jsonb,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  rejected_at timestamptz,
  rejected_by uuid references public.profiles(id),
  -- Serials
  global_reference_id text,
  super_admin_serial text,
  source_country_serial text,
  source_branch_serial text,
  dest_country_serial text,
  dest_branch_serial text,
  entry_serial text,
  -- Timestamps
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists inter_country_transfers_no_idx
  on public.inter_country_transfers (transfer_no) where deleted_at is null;

create unique index if not exists inter_country_transfers_idempotency_idx
  on public.inter_country_transfers (idempotency_key) where idempotency_key is not null and deleted_at is null;

-- Prevent double posting: only one receiver_roznamcha_entry_id per transfer
create unique index if not exists inter_country_transfers_one_posting_idx
  on public.inter_country_transfers (id) where receiver_roznamcha_entry_id is not null and deleted_at is null;

create index if not exists inter_country_transfers_dest_idx
  on public.inter_country_transfers (dest_country_id, status, created_at desc) where deleted_at is null;

create index if not exists inter_country_transfers_source_idx
  on public.inter_country_transfers (source_country_id, created_at desc) where deleted_at is null;

create unique index if not exists inter_country_transfers_ref_idx
  on public.inter_country_transfers (global_reference_id)
  where global_reference_id is not null and deleted_at is null;

alter table public.inter_country_transfers enable row level security;

drop policy if exists inter_country_transfers_read on public.inter_country_transfers;
create policy inter_country_transfers_read on public.inter_country_transfers
  for select using (true);

drop policy if exists inter_country_transfers_write on public.inter_country_transfers;
create policy inter_country_transfers_write on public.inter_country_transfers
  for all using (true);


-- ============================================================================
-- 1F. Serial Architecture Enhancement — add global_reference_id columns
-- ============================================================================
alter table public.roznamcha_entries
  add column if not exists global_reference_id text;
create unique index if not exists roznamcha_entries_global_ref_idx
  on public.roznamcha_entries (global_reference_id)
  where global_reference_id is not null and deleted_at is null;

alter table public.ledger_posting_batches
  add column if not exists global_reference_id text;
create unique index if not exists ledger_posting_batches_global_ref_idx
  on public.ledger_posting_batches (global_reference_id)
  where global_reference_id is not null and deleted_at is null;

alter table public.purchase_orders
  add column if not exists global_reference_id text;
create unique index if not exists purchase_orders_global_ref_idx
  on public.purchase_orders (global_reference_id)
  where global_reference_id is not null and deleted_at is null;

alter table public.sales_orders
  add column if not exists global_reference_id text;
create unique index if not exists sales_orders_global_ref_idx
  on public.sales_orders (global_reference_id)
  where global_reference_id is not null and deleted_at is null;

-- Add shipping line scope columns to shipping_expense_transfers
alter table public.shipping_expense_transfers
  add column if not exists inter_country_mode boolean not null default false;
alter table public.shipping_expense_transfers
  add column if not exists source_shipping_line_id uuid;
alter table public.shipping_expense_transfers
  add column if not exists dest_shipping_line_id uuid;
alter table public.shipping_expense_transfers
  add column if not exists global_reference_id text;

create unique index if not exists shipping_expense_transfers_global_ref_idx
  on public.shipping_expense_transfers (global_reference_id)
  where global_reference_id is not null and deleted_at is null;


-- ============================================================================
-- 2B. General Brand Print Settings (for Step 2, but table needed early)
-- ============================================================================
create table if not exists public.general_brand_print_settings (
  id uuid default gen_random_uuid() not null primary key,
  parent_business_group_id uuid references public.parent_business_groups(id),
  brand_name text,
  logo_url text,
  registration_number text,
  tax_number text,
  tagline text,
  headquarters text,
  phone text,
  email text,
  website text,
  header_note text,
  footer_terms text,
  prepared_by_label text default 'Prepared By',
  checked_by_label text default 'Checked By',
  approved_by_label text default 'Approved By',
  signature_options jsonb not null default '[]'::jsonb,
  default_orientation text not null default 'portrait' check (default_orientation in ('portrait','landscape','auto')),
  default_paper_size text not null default 'A4',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.general_brand_print_settings enable row level security;

drop policy if exists general_brand_print_settings_read on public.general_brand_print_settings;
create policy general_brand_print_settings_read on public.general_brand_print_settings
  for select using (true);

drop policy if exists general_brand_print_settings_write on public.general_brand_print_settings;
create policy general_brand_print_settings_write on public.general_brand_print_settings
  for all using (public.is_super_admin());
