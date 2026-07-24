create table if not exists transaction_serial_sequences (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global', 'country', 'branch')),
  scope_key text not null,
  prefix text not null,
  next_value bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_type, scope_key)
);

create or replace function next_transaction_serial(
  p_scope_type text,
  p_scope_key text,
  p_prefix text
)
returns text
language plpgsql
security definer
as $$
declare
  v_next bigint;
  v_prefix text;
begin
  v_prefix := upper(regexp_replace(coalesce(nullif(trim(p_prefix), ''), 'TXN'), '[^A-Z0-9]', '', 'g'));
  if v_prefix = '' then
    v_prefix := 'TXN';
  end if;

  insert into transaction_serial_sequences (scope_type, scope_key, prefix, next_value)
  values (p_scope_type, p_scope_key, v_prefix, 2)
  on conflict (scope_type, scope_key)
  do update set
    next_value = transaction_serial_sequences.next_value + 1,
    prefix = excluded.prefix,
    updated_at = now()
  returning transaction_serial_sequences.next_value - 1 into v_next;

  return v_prefix || '-' || lpad(v_next::text, 6, '0');
end;
$$;

alter table roznamcha_entries
  add column if not exists super_admin_serial_number text,
  add column if not exists country_transaction_serial_number text,
  add column if not exists branch_transaction_serial_number text;

alter table roznamcha_lines
  add column if not exists super_admin_serial_number text,
  add column if not exists country_transaction_serial_number text,
  add column if not exists branch_transaction_serial_number text;

create unique index if not exists roznamcha_entries_super_admin_serial_idx
  on roznamcha_entries (super_admin_serial_number)
  where super_admin_serial_number is not null and deleted_at is null;

create index if not exists roznamcha_entries_country_transaction_serial_idx
  on roznamcha_entries (country_transaction_serial_number)
  where country_transaction_serial_number is not null and deleted_at is null;

create index if not exists roznamcha_entries_branch_transaction_serial_idx
  on roznamcha_entries (branch_transaction_serial_number)
  where branch_transaction_serial_number is not null and deleted_at is null;

create index if not exists roznamcha_lines_transaction_serials_idx
  on roznamcha_lines (super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number);

insert into erp_schema_migrations(name, status, applied_at)
values ('0029_roznamcha_transaction_serials', 'applied', now())
on conflict (name)
do update set status = excluded.status, applied_at = excluded.applied_at;
