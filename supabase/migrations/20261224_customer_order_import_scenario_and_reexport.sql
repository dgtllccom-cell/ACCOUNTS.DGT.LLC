-- Customer Order 1A: (a) which import scenario the order is, (b) allow "re_export" as a customs operation.
-- Additive and idempotent. Existing rows and constraints' accepted values are unchanged.

-- (a) Import scenario: collect goods from the foreign origin, or clear goods that have already
--     arrived at the entry border / port. NULL for non-import orders and for pre-existing orders.
alter table public.clearing_customer_orders
  add column if not exists import_scenario text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clearing_customer_orders_import_scenario_check'
      and conrelid = 'public.clearing_customer_orders'::regclass
  ) then
    alter table public.clearing_customer_orders
      add constraint clearing_customer_orders_import_scenario_check
      check (import_scenario is null or import_scenario in ('collect_from_origin', 'arrived_at_entry'));
  end if;
end $$;

-- (b) Per-leg customs operation: add 're_export' to the allowed values.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'clearing_customer_order_legs_clearance_type_check'
      and conrelid = 'public.clearing_customer_order_legs'::regclass
  ) then
    alter table public.clearing_customer_order_legs
      drop constraint clearing_customer_order_legs_clearance_type_check;
  end if;
  alter table public.clearing_customer_order_legs
    add constraint clearing_customer_order_legs_clearance_type_check
    check (clearance_type is null or clearance_type in ('import', 'export', 'transit', 're_export'));
end $$;
