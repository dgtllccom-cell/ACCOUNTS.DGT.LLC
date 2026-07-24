-- Account identity and ERP accounting linkage metadata.
-- Keeps account number as the system-wide source key while adding customer,
-- serial, branch sequence, and history fields for reports and account lookup.

alter table enterprise_accounts
  add column if not exists account_number text,
  add column if not exists customer_number text,
  add column if not exists account_serial_number bigint,
  add column if not exists creation_date timestamptz,
  add column if not exists branch_code text,
  add column if not exists branch_account_sequence bigint;

with numbered as (
  select
    id,
    case
      when count(*) over (partition by code) = 1 then code
      else code || '-' || lpad(row_number() over (order by created_at, id)::text, 4, '0')
    end as generated_account_number,
    row_number() over (order by created_at, id) as global_seq,
    row_number() over (
      partition by scope, country_id, country_branch_id, city_branch_id
      order by created_at, id
    ) as branch_seq
  from enterprise_accounts
)
update enterprise_accounts ea
set
  account_number = coalesce(nullif(ea.account_number, ''), numbered.generated_account_number),
  customer_number = coalesce(nullif(ea.customer_number, ''), 'CUST-' || numbered.generated_account_number),
  account_serial_number = coalesce(ea.account_serial_number, numbered.global_seq),
  creation_date = coalesce(ea.creation_date, ea.created_at),
  branch_code = coalesce(
    nullif(ea.branch_code, ''),
    case
      when ea.scope = 'super_admin' then 'SUPER'
      when ea.scope = 'country' then 'COUNTRY'
      when ea.scope = 'main_branch' then 'MAIN'
      when ea.scope = 'city_branch' then 'CITY'
      else 'BRANCH'
    end
  ),
  branch_account_sequence = coalesce(ea.branch_account_sequence, numbered.branch_seq)
from numbered
where numbered.id = ea.id
  and (
    ea.account_number is null
    or ea.customer_number is null
    or ea.account_serial_number is null
    or ea.creation_date is null
    or ea.branch_code is null
    or ea.branch_account_sequence is null
  );

alter table enterprise_accounts
  alter column account_number set not null,
  alter column customer_number set not null,
  alter column account_serial_number set not null,
  alter column creation_date set not null,
  alter column branch_code set not null,
  alter column branch_account_sequence set not null;

create unique index if not exists enterprise_accounts_account_number_idx
  on enterprise_accounts(account_number)
  where deleted_at is null;

create unique index if not exists enterprise_accounts_customer_number_idx
  on enterprise_accounts(customer_number)
  where deleted_at is null;

create index if not exists enterprise_accounts_branch_sequence_idx
  on enterprise_accounts(scope, country_id, country_branch_id, city_branch_id, branch_account_sequence)
  where deleted_at is null;

create table if not exists enterprise_account_history (
  id uuid primary key default gen_random_uuid(),
  enterprise_account_id uuid not null references enterprise_accounts(id) on delete cascade,
  account_number text not null,
  event_type text not null,
  event_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  debit_total numeric(18, 4) not null default 0,
  credit_total numeric(18, 4) not null default 0,
  current_balance numeric(18, 4) not null default 0,
  last_transaction_at timestamptz,
  details jsonb not null default '{}'::jsonb
);

create index if not exists enterprise_account_history_account_idx
  on enterprise_account_history(enterprise_account_id, event_at desc);

insert into enterprise_account_history (
  enterprise_account_id,
  account_number,
  event_type,
  event_at,
  created_by,
  debit_total,
  credit_total,
  current_balance,
  last_transaction_at,
  details
)
select
  ea.id,
  ea.account_number,
  'created',
  ea.creation_date,
  ea.created_by,
  0,
  0,
  ea.current_balance,
  null,
  jsonb_build_object(
    'customerNumber', ea.customer_number,
    'accountSerialNumber', ea.account_serial_number,
    'branchCode', ea.branch_code,
    'branchAccountSequence', ea.branch_account_sequence
  )
from enterprise_accounts ea
where not exists (
  select 1
  from enterprise_account_history h
  where h.enterprise_account_id = ea.id
    and h.event_type = 'created'
);

notify pgrst, 'reload schema';
