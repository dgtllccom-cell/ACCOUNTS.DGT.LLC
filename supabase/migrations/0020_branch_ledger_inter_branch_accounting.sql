-- Enterprise ERP/FMS: Branch ledger and inter-branch accounting foundation.
-- Adds branch/user/country-company identification to postings and a safe
-- inter-branch transaction register without changing existing posting APIs.

alter table ledger_posting_batches
  add column if not exists country_company_profile_id uuid references country_company_profiles(id),
  add column if not exists transaction_type text not null default 'ledger_posting',
  add column if not exists source_country_branch_id uuid references country_branches(id),
  add column if not exists source_city_branch_id uuid references city_branches(id),
  add column if not exists destination_country_branch_id uuid references country_branches(id),
  add column if not exists destination_city_branch_id uuid references city_branches(id),
  add column if not exists branch_name_snapshot text,
  add column if not exists user_name_snapshot text,
  add column if not exists approval_status text not null default 'not_required',
  add column if not exists approved_by uuid references profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists modification_history jsonb not null default '[]'::jsonb;

alter table ledger_posting_lines
  add column if not exists branch_name_snapshot text,
  add column if not exists user_name_snapshot text,
  add column if not exists ledger_name_snapshot text,
  add column if not exists reference_no_snapshot text,
  add column if not exists remarks text;

create table if not exists inter_branch_ledger_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null,
  country_id uuid not null references countries(id),
  country_company_profile_id uuid references country_company_profiles(id),
  source_country_branch_id uuid references country_branches(id),
  source_city_branch_id uuid references city_branches(id),
  destination_country_branch_id uuid references country_branches(id),
  destination_city_branch_id uuid references city_branches(id),
  source_ledger_id uuid not null references ledgers(id),
  destination_ledger_id uuid not null references ledgers(id),
  amount numeric(18, 4) not null,
  currency text not null,
  exchange_rate numeric(18, 8) not null default 1,
  reference_no text,
  remarks text,
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'posted', 'rejected', 'cancelled')),
  ledger_posting_batch_id uuid references ledger_posting_batches(id),
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inter_branch_amount_positive_chk check (amount > 0),
  constraint inter_branch_currency_chk check (char_length(currency) = 3),
  constraint inter_branch_source_destination_chk check (
    coalesce(source_city_branch_id, source_country_branch_id) is not null
    and coalesce(destination_city_branch_id, destination_country_branch_id) is not null
    and coalesce(source_city_branch_id, source_country_branch_id) <> coalesce(destination_city_branch_id, destination_country_branch_id)
  )
);

create unique index if not exists inter_branch_ledger_transfers_no_idx
  on inter_branch_ledger_transfers (transfer_no)
  where deleted_at is null;

create index if not exists inter_branch_ledger_transfers_country_status_idx
  on inter_branch_ledger_transfers (country_id, status, created_at desc)
  where deleted_at is null;

create table if not exists ledger_transaction_audit_trail (
  id uuid primary key default gen_random_uuid(),
  ledger_posting_batch_id uuid references ledger_posting_batches(id) on delete cascade,
  ledger_posting_line_id uuid references ledger_posting_lines(id) on delete cascade,
  inter_branch_transfer_id uuid references inter_branch_ledger_transfers(id) on delete cascade,
  country_id uuid references countries(id),
  country_company_profile_id uuid references country_company_profiles(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  ledger_id uuid references ledgers(id),
  actor_id uuid references profiles(id),
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledger_transaction_audit_trail_scope_idx
  on ledger_transaction_audit_trail (country_id, country_branch_id, city_branch_id, created_at desc);

create or replace view branch_ledger_transaction_report as
select
  b.id as batch_id,
  l.id as line_id,
  b.country_id,
  ccp.company_name as country_company_name,
  b.country_company_profile_id,
  b.country_branch_id,
  b.city_branch_id,
  coalesce(cb.name, cityb.name, b.branch_name_snapshot) as branch_name,
  b.created_by as user_id,
  coalesce(p.full_name, b.user_name_snapshot) as user_name,
  b.entry_date,
  b.created_at,
  b.transaction_type,
  b.reference_no,
  led.name as ledger_name,
  led.code as ledger_code,
  l.debit,
  l.credit,
  l.currency,
  l.usd_rate,
  l.usd_amount,
  b.approval_status,
  b.status,
  b.narration
from ledger_posting_batches b
join ledger_posting_lines l on l.batch_id = b.id
join ledgers led on led.id = l.ledger_id
left join country_company_profiles ccp on ccp.id = b.country_company_profile_id
left join country_branches cb on cb.id = b.country_branch_id
left join city_branches cityb on cityb.id = b.city_branch_id
left join profiles p on p.id = b.created_by
where b.deleted_at is null;

insert into permissions (resource, action, description)
values
  ('inter_branch_transfers', 'create', 'Create inter-branch accounting transfers'),
  ('inter_branch_transfers', 'read', 'View inter-branch accounting transfers'),
  ('inter_branch_transfers', 'update', 'Update inter-branch accounting transfers'),
  ('inter_branch_transfers', 'approve', 'Approve inter-branch accounting transfers')
on conflict (resource, action) do nothing;

alter table inter_branch_ledger_transfers enable row level security;
alter table ledger_transaction_audit_trail enable row level security;

create policy inter_branch_ledger_transfers_read_scope
  on inter_branch_ledger_transfers for select
  using (
    is_super_admin()
    or can_access_country(country_id)
    or (source_country_branch_id is not null and can_access_country_branch(source_country_branch_id))
    or (source_city_branch_id is not null and can_access_city_branch(source_city_branch_id))
    or (destination_country_branch_id is not null and can_access_country_branch(destination_country_branch_id))
    or (destination_city_branch_id is not null and can_access_city_branch(destination_city_branch_id))
  );

create policy inter_branch_ledger_transfers_write_scope
  on inter_branch_ledger_transfers for all
  using (
    is_super_admin()
    or (source_country_branch_id is not null and can_access_country_branch(source_country_branch_id))
    or (source_city_branch_id is not null and can_access_city_branch(source_city_branch_id))
  )
  with check (
    is_super_admin()
    or (source_country_branch_id is not null and can_access_country_branch(source_country_branch_id))
    or (source_city_branch_id is not null and can_access_city_branch(source_city_branch_id))
  );

create policy ledger_transaction_audit_trail_read_scope
  on ledger_transaction_audit_trail for select
  using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    or actor_id = auth.uid()
  );
