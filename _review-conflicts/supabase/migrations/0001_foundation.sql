create extension if not exists "pgcrypto";

create type account_kind as enum ('asset', 'liability', 'equity', 'income', 'expense');
create type account_status as enum ('active', 'archived');
create type branch_scope as enum ('company', 'branch');
create type document_status as enum ('draft', 'posted', 'cancelled');
create type ledger_direction as enum ('debit', 'credit');
create type permission_action as enum ('create', 'read', 'update', 'delete', 'post', 'approve', 'export');

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  base_currency text not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index companies_name_idx on companies (name) where deleted_at is null;

create table branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index branches_company_code_idx on branches (company_id, code) where deleted_at is null;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  default_company_id uuid references companies(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index roles_company_name_idx on roles (company_id, name) where deleted_at is null;

create table permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action permission_action not null,
  description text
);

create unique index permissions_resource_action_idx on permissions (resource, action);

insert into permissions (resource, action, description)
values
  ('companies', 'read', 'View company records'),
  ('branches', 'read', 'View branch records'),
  ('users', 'read', 'View users and memberships'),
  ('users', 'update', 'Manage user memberships'),
  ('roles', 'read', 'View roles'),
  ('roles', 'update', 'Manage roles and permissions'),
  ('accounts', 'create', 'Create accounts'),
  ('accounts', 'read', 'View accounts'),
  ('accounts', 'update', 'Update accounts'),
  ('journal_entries', 'create', 'Create journal entries'),
  ('journal_entries', 'read', 'View journal entries'),
  ('journal_entries', 'update', 'Edit draft journal entries'),
  ('journal_entries', 'post', 'Post balanced journal entries'),
  ('ledger', 'read', 'View ledger records'),
  ('reports', 'read', 'View reports'),
  ('reports', 'export', 'Export reports'),
  ('attachments', 'create', 'Upload attachments'),
  ('attachments', 'read', 'View attachments')
on conflict (resource, action) do nothing;

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  role_id uuid not null references roles(id),
  scope branch_scope not null default 'company',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memberships_branch_scope_chk check (
    (scope = 'company' and branch_id is null) or (scope = 'branch' and branch_id is not null)
  )
);

create index memberships_user_company_idx on memberships (user_id, company_id);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  parent_id uuid references accounts(id),
  code text not null,
  name text not null,
  kind account_kind not null,
  currency text not null,
  status account_status not null default 'active',
  is_control_account boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index accounts_company_code_idx on accounts (company_id, code) where deleted_at is null;
create index accounts_company_kind_idx on accounts (company_id, kind);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  entry_no text not null,
  entry_date date not null,
  status document_status not null default 'draft',
  memo text,
  source_type text not null default 'journal',
  source_id uuid,
  posted_at timestamptz,
  posted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index journal_entries_company_no_idx on journal_entries (company_id, entry_no) where deleted_at is null;
create index journal_entries_company_date_idx on journal_entries (company_id, entry_date);

create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references accounts(id),
  description text,
  debit numeric(18, 4) not null default 0,
  credit numeric(18, 4) not null default 0,
  constraint journal_lines_one_positive_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  journal_entry_id uuid not null references journal_entries(id),
  journal_line_id uuid not null references journal_lines(id),
  account_id uuid not null references accounts(id),
  entry_date date not null,
  direction ledger_direction not null,
  amount numeric(18, 4) not null,
  currency text not null,
  exchange_rate numeric(18, 8) not null default 1,
  base_amount numeric(18, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ledger_entries_amount_positive check (amount > 0 and base_amount > 0)
);

create unique index ledger_entries_journal_line_idx on ledger_entries (journal_line_id);
create index ledger_entries_account_date_idx on ledger_entries (account_id, entry_date);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  branch_id uuid references branches(id),
  owner_table text not null,
  owner_id uuid not null,
  bucket text not null,
  path text not null,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  actor_id uuid references profiles(id),
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create or replace function is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from memberships
    where memberships.company_id = target_company_id
      and memberships.user_id = auth.uid()
      and memberships.is_active = true
      and memberships.deleted_at is null
  );
$$;

create or replace function has_company_permission(
  target_company_id uuid,
  target_resource text,
  target_action permission_action
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from memberships m
    join role_permissions rp on rp.role_id = m.role_id
    join permissions p on p.id = rp.permission_id
    where m.company_id = target_company_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.deleted_at is null
      and p.resource = target_resource
      and p.action = target_action
  );
$$;

create or replace function post_journal_entry(target_journal_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_record journal_entries%rowtype;
  debit_total numeric(18, 4);
  credit_total numeric(18, 4);
begin
  select * into entry_record
  from journal_entries
  where id = target_journal_entry_id
  for update;

  if not found then
    raise exception 'Journal entry not found';
  end if;

  if entry_record.status <> 'draft' then
    raise exception 'Only draft journal entries can be posted';
  end if;

  if not has_company_permission(entry_record.company_id, 'journal_entries', 'post') then
    raise exception 'Missing permission to post journal entries';
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into debit_total, credit_total
  from journal_lines
  where journal_entry_id = target_journal_entry_id;

  if debit_total <= 0 or debit_total <> credit_total then
    raise exception 'Journal entry is not balanced';
  end if;

  insert into ledger_entries (
    company_id,
    branch_id,
    journal_entry_id,
    journal_line_id,
    account_id,
    entry_date,
    direction,
    amount,
    currency,
    exchange_rate,
    base_amount
  )
  select
    entry_record.company_id,
    entry_record.branch_id,
    entry_record.id,
    jl.id,
    jl.account_id,
    entry_record.entry_date,
    case when jl.debit > 0 then 'debit'::ledger_direction else 'credit'::ledger_direction end,
    greatest(jl.debit, jl.credit),
    a.currency,
    1,
    greatest(jl.debit, jl.credit)
  from journal_lines jl
  join accounts a on a.id = jl.account_id
  where jl.journal_entry_id = target_journal_entry_id;

  update journal_entries
  set status = 'posted',
      posted_at = now(),
      posted_by = auth.uid(),
      updated_at = now()
  where id = target_journal_entry_id;

  insert into audit_logs (company_id, actor_id, action, entity_table, entity_id, after)
  values (
    entry_record.company_id,
    auth.uid(),
    'post',
    'journal_entries',
    target_journal_entry_id,
    jsonb_build_object('status', 'posted', 'debit_total', debit_total, 'credit_total', credit_total)
  );
end;
$$;

create or replace function create_company_workspace(
  company_name text,
  legal_name text,
  base_currency text,
  branch_name text,
  branch_code text,
  owner_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_company_id uuid;
  new_branch_id uuid;
  owner_role_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if trim(company_name) = '' or trim(branch_name) = '' or trim(branch_code) = '' then
    raise exception 'Company and branch details are required';
  end if;

  insert into companies (name, legal_name, base_currency)
  values (trim(company_name), nullif(trim(legal_name), ''), upper(trim(base_currency)))
  returning id into new_company_id;

  insert into branches (company_id, name, code)
  values (new_company_id, trim(branch_name), upper(trim(branch_code)))
  returning id into new_branch_id;

  insert into profiles (id, full_name, default_company_id)
  values (current_user_id, trim(owner_full_name), new_company_id)
  on conflict (id) do update
    set full_name = excluded.full_name,
        default_company_id = excluded.default_company_id,
        updated_at = now();

  insert into roles (company_id, name, description, is_system)
  values (new_company_id, 'Owner', 'Full company administration and posting access.', true)
  returning id into owner_role_id;

  insert into role_permissions (role_id, permission_id)
  select owner_role_id, id
  from permissions;

  insert into memberships (user_id, company_id, role_id, scope)
  values (current_user_id, new_company_id, owner_role_id, 'company');

  insert into accounts (company_id, code, name, kind, currency, is_control_account)
  values
    (new_company_id, '1000', 'Cash and bank', 'asset', upper(trim(base_currency)), true),
    (new_company_id, '1100', 'Accounts receivable', 'asset', upper(trim(base_currency)), true),
    (new_company_id, '1200', 'Inventory', 'asset', upper(trim(base_currency)), true),
    (new_company_id, '2000', 'Accounts payable', 'liability', upper(trim(base_currency)), true),
    (new_company_id, '3000', 'Owner equity', 'equity', upper(trim(base_currency)), true),
    (new_company_id, '4000', 'Sales revenue', 'income', upper(trim(base_currency)), true),
    (new_company_id, '5000', 'Cost of goods sold', 'expense', upper(trim(base_currency)), true);

  insert into audit_logs (company_id, actor_id, action, entity_table, entity_id, after)
  values (
    new_company_id,
    current_user_id,
    'create_workspace',
    'companies',
    new_company_id,
    jsonb_build_object('company_name', trim(company_name), 'branch_id', new_branch_id)
  );

  return new_company_id;
end;
$$;

create or replace function create_account(
  target_company_id uuid,
  target_branch_id uuid,
  parent_account_id uuid,
  account_code text,
  account_name text,
  account_kind_value account_kind,
  account_currency text,
  is_control boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
begin
  if not has_company_permission(target_company_id, 'accounts', 'create') then
    raise exception 'Missing permission to create accounts';
  end if;

  if trim(account_code) = '' or trim(account_name) = '' then
    raise exception 'Account code and name are required';
  end if;

  if target_branch_id is not null and not exists (
    select 1 from branches
    where id = target_branch_id
      and company_id = target_company_id
      and deleted_at is null
  ) then
    raise exception 'Branch does not belong to the target company';
  end if;

  if parent_account_id is not null and not exists (
    select 1 from accounts
    where id = parent_account_id
      and company_id = target_company_id
      and deleted_at is null
  ) then
    raise exception 'Parent account does not belong to the target company';
  end if;

  insert into accounts (
    company_id,
    branch_id,
    parent_id,
    code,
    name,
    kind,
    currency,
    is_control_account
  )
  values (
    target_company_id,
    target_branch_id,
    parent_account_id,
    trim(account_code),
    trim(account_name),
    account_kind_value,
    upper(trim(account_currency)),
    is_control
  )
  returning id into new_account_id;

  insert into audit_logs (company_id, actor_id, action, entity_table, entity_id, after)
  values (
    target_company_id,
    auth.uid(),
    'create',
    'accounts',
    new_account_id,
    jsonb_build_object('code', trim(account_code), 'name', trim(account_name), 'kind', account_kind_value)
  );

  return new_account_id;
end;
$$;

alter table companies enable row level security;
alter table branches enable row level security;
alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table memberships enable row level security;
alter table accounts enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table ledger_entries enable row level security;
alter table attachments enable row level security;
alter table audit_logs enable row level security;

create policy companies_member_read on companies for select using (is_company_member(id));
create policy branches_member_read on branches for select using (is_company_member(company_id));
create policy roles_member_read on roles for select using (is_company_member(company_id));
create policy memberships_member_read on memberships for select using (is_company_member(company_id));
create policy accounts_member_read on accounts for select using (is_company_member(company_id));
create policy journals_member_read on journal_entries for select using (is_company_member(company_id));
create policy journal_lines_member_read on journal_lines for select using (
  exists (
    select 1
    from journal_entries je
    where je.id = journal_lines.journal_entry_id
      and is_company_member(je.company_id)
  )
);
create policy ledger_member_read on ledger_entries for select using (is_company_member(company_id));
create policy attachments_member_read on attachments for select using (is_company_member(company_id));
create policy audit_member_read on audit_logs for select using (company_id is not null and is_company_member(company_id));
create policy profiles_self_read on profiles for select using (id = auth.uid());

create policy accounts_manage on accounts
  for all using (has_company_permission(company_id, 'accounts', 'update'))
  with check (has_company_permission(company_id, 'accounts', 'create'));

create policy journals_create on journal_entries
  for insert with check (has_company_permission(company_id, 'journal_entries', 'create'));

create policy journals_update on journal_entries
  for update using (status = 'draft' and has_company_permission(company_id, 'journal_entries', 'update'))
  with check (status = 'draft' and has_company_permission(company_id, 'journal_entries', 'update'));

create policy journal_lines_create on journal_lines
  for insert with check (
    exists (
      select 1
      from journal_entries je
      where je.id = journal_lines.journal_entry_id
        and je.status = 'draft'
        and has_company_permission(je.company_id, 'journal_entries', 'create')
    )
  );

create policy journal_lines_update on journal_lines
  for update using (
    exists (
      select 1
      from journal_entries je
      where je.id = journal_lines.journal_entry_id
        and je.status = 'draft'
        and has_company_permission(je.company_id, 'journal_entries', 'update')
    )
  )
  with check (
    exists (
      select 1
      from journal_entries je
      where je.id = journal_lines.journal_entry_id
        and je.status = 'draft'
        and has_company_permission(je.company_id, 'journal_entries', 'update')
    )
  );

create policy attachment_create on attachments
  for insert with check (has_company_permission(company_id, 'attachments', 'create'));
