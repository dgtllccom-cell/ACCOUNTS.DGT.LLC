-- Add missing serials to roznamcha_entries
alter table roznamcha_entries
  add column if not exists main_branch_transaction_serial text,
  add column if not exists city_branch_transaction_serial text,
  add column if not exists entry_serial_number text;

-- Add missing serials to roznamcha_lines
alter table roznamcha_lines
  add column if not exists main_branch_transaction_serial text,
  add column if not exists city_branch_transaction_serial text,
  add column if not exists entry_serial_number text;

-- Add missing serials to purchase_orders
alter table purchase_orders
  add column if not exists super_admin_serial_number text,
  add column if not exists country_transaction_serial_number text,
  add column if not exists branch_transaction_serial_number text,
  add column if not exists main_branch_transaction_serial text,
  add column if not exists city_branch_transaction_serial text;

-- Add indexes for roznamcha
create index if not exists roznamcha_entries_main_branch_serial_idx on roznamcha_entries (main_branch_transaction_serial) where main_branch_transaction_serial is not null and deleted_at is null;
create index if not exists roznamcha_entries_city_branch_serial_idx on roznamcha_entries (city_branch_transaction_serial) where city_branch_transaction_serial is not null and deleted_at is null;
create unique index if not exists roznamcha_entries_entry_serial_idx on roznamcha_entries (entry_serial_number) where entry_serial_number is not null and deleted_at is null;

-- Add indexes for purchase_orders
create unique index if not exists purchase_orders_super_admin_serial_idx on purchase_orders (super_admin_serial_number) where super_admin_serial_number is not null and deleted_at is null;
create index if not exists purchase_orders_country_transaction_serial_idx on purchase_orders (country_transaction_serial_number) where country_transaction_serial_number is not null and deleted_at is null;
create index if not exists purchase_orders_branch_transaction_serial_idx on purchase_orders (branch_transaction_serial_number) where branch_transaction_serial_number is not null and deleted_at is null;

-- Update the check constraint on transaction_serial_sequences scope_type
alter table transaction_serial_sequences drop constraint if exists transaction_serial_sequences_scope_type_check;

-- Register migration
insert into erp_schema_migrations(name, status, applied_at)
values ('0032_erp_serial_system', 'applied', now())
on conflict (name)
do update set status = excluded.status, applied_at = excluded.applied_at;
