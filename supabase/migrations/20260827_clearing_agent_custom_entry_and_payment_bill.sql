-- Sub-phase B: two clearing-agent screens (Agent Custom Declaration Entry, Clearing Agent
-- Payment Bill) have shipped UI + API routes since before this table ever existed. Their GET/POST
-- handlers only ever hit a Postgres "relation does not exist" error, which they silently
-- swallowed (GET returned an empty list, POST faked a success response with an in-memory
-- id that was never actually persisted) — the screens looked functional but wrote nothing.
--
-- Architecture matches the sibling clearing-agent truck-loading tables from
-- 20260731_clearing_agent_truck_forms.sql: uuid pk, country/branch scope (required for
-- permission isolation — the existing route never set these, which is fixed alongside this
-- migration), soft delete, created_by/timestamps. Free-text party fields (agent_name,
-- consignee_name, consignor_name) are kept as display/print snapshots; real FK columns are
-- added alongside them onto the Clearing Agent and Person masters, per the same pattern used
-- everywhere else in Sub-phase B.

create table if not exists clearing_agent_custom_entries (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  entry_no text,
  customs_declaration_no text,
  declaration_type text not null default 'import',
  agent_name text,
  agent_id uuid references clearing_agents(id),
  customs_station text,
  consignee_name text,
  consignee_person_id uuid references customers(id),
  consignor_name text,
  consignor_person_id uuid references customers(id),
  hscode text,
  goods_description text,
  assessed_value numeric(18, 4) not null default 0,
  duty_paid numeric(18, 4) not null default 0,
  currency_code text not null default 'USD',
  clearance_status text not null default 'submitted',
  remarks text,
  status text not null default 'active',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists clearing_agent_custom_entries_entry_no_idx
  on clearing_agent_custom_entries (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(entry_no))
  where deleted_at is null and entry_no is not null;
create index if not exists clearing_agent_custom_entries_scope_idx
  on clearing_agent_custom_entries (country_id, country_branch_id, city_branch_id, created_at)
  where deleted_at is null;
alter table clearing_agent_custom_entries enable row level security;

create table if not exists clearing_payment_bills (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  bill_no text,
  order_no text,
  bl_number text,
  gd_number text,
  agent_name text,
  agent_id uuid references clearing_agents(id),
  port_name text,
  customs_duty numeric(18, 4) not null default 0,
  port_charges numeric(18, 4) not null default 0,
  demurrage_charges numeric(18, 4) not null default 0,
  clearance_fee numeric(18, 4) not null default 0,
  freight_charges numeric(18, 4) not null default 0,
  other_charges numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  currency_code text not null default 'USD',
  payment_status text not null default 'pending',
  payment_method text not null default 'bank_transfer',
  remarks text,
  status text not null default 'active',
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists clearing_payment_bills_bill_no_idx
  on clearing_payment_bills (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(bill_no))
  where deleted_at is null and bill_no is not null;
create index if not exists clearing_payment_bills_scope_idx
  on clearing_payment_bills (country_id, country_branch_id, city_branch_id, created_at)
  where deleted_at is null;
alter table clearing_payment_bills enable row level security;

notify pgrst, 'reload schema';
