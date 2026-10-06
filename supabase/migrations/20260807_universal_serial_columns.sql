-- Universal 4-level serial columns (Global / Country / Branch / Entry) on every
-- core form table, so allocateFormSerials() can be wired into each create route.
-- Additive + idempotent. The serial engine is next_entity_serial() (open to any
-- entity_type) — this only adds the storage columns; API wiring is per-form.

do $$
declare
  tbl text;
  form_tables text[] := array[
    'customers',
    'purchase_orders', 'purchase_order_payments', 'local_purchases',
    'sales_orders', 'sales_order_payments',
    'journal_entries', 'ledger_entries', 'roznamcha_entries',
    'transactions', 'money_exchange_entries', 'expenses_bills',
    'employees', 'enterprise_accounts', 'banks', 'goods', 'products'
  ];
begin
  foreach tbl in array form_tables loop
    if to_regclass('public.'||tbl) is not null then
      execute format('alter table public.%I add column if not exists super_admin_serial text', tbl);
      execute format('alter table public.%I add column if not exists country_serial text', tbl);
      execute format('alter table public.%I add column if not exists branch_serial text', tbl);
      execute format('alter table public.%I add column if not exists entry_serial text', tbl);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
