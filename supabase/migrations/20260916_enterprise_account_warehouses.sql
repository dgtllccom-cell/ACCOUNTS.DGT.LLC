-- Dedicated junction table for enterprise_accounts <-> warehouses (Account Setup's
-- canonical Account). The pre-existing `account_warehouses` table belongs to the
-- separate legacy chart-of-accounts-style `accounts` system (FK account_id ->
-- accounts(id), with real rows already in use) — reusing it for enterprise_accounts
-- caused every real Account Setup warehouse link to fail FK_VIOLATION, since
-- enterprise_accounts.id values don't exist in accounts. This table mirrors the same
-- shape but targets the correct table, without touching the legacy one's data.
create table if not exists enterprise_account_warehouses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references enterprise_accounts(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  company_id uuid references country_company_profiles(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint enterprise_account_warehouses_unique unique (account_id, warehouse_id)
);

create index if not exists enterprise_account_warehouses_account_idx on enterprise_account_warehouses (account_id);
create index if not exists enterprise_account_warehouses_warehouse_idx on enterprise_account_warehouses (warehouse_id);

alter table enterprise_account_warehouses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'enterprise_account_warehouses' and policyname = 'eaw_read_all') then
    create policy eaw_read_all on enterprise_account_warehouses for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'enterprise_account_warehouses' and policyname = 'eaw_write_all') then
    create policy eaw_write_all on enterprise_account_warehouses for all to authenticated using (true) with check (true);
  end if;
end $$;
