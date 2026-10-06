-- Organizes the EXISTING multi-country Shipping Customer Order (clearing_customer_orders
-- + clearing_customer_order_legs, built in 20261120_shipping_customer_order_upgrade.sql)
-- for real multi-country operations: per-leg responsible user, per-leg documents, a
-- fuller customs field set, lightweight per-leg expense capture, per-leg task-handoff
-- linkage (reusing the existing generic user_tasks engine), and multi-warehouse
-- loading allocations for a single goods line. Additive only — no column dropped/renamed.

-- ── clearing_customer_order_legs: responsible user, documents, fuller customs, expense ──

alter table public.clearing_customer_order_legs
  add column if not exists responsible_user_id uuid references public.profiles(id),
  add column if not exists documents jsonb not null default '[]'::jsonb,

  -- Customs: bill_of_entry_no/pgm_number/declaration_reference were previously all
  -- overloaded onto the one generic customs_receipt_ref field — split out as distinct
  -- columns so a real Bill of Entry number and a PGM number can both be recorded.
  add column if not exists bill_of_entry_no text,
  add column if not exists pgm_number text,
  add column if not exists declaration_reference text,
  add column if not exists tax_amount numeric,
  add column if not exists other_charges numeric,
  -- Independent customs clearance status — the existing `status` column tracks the
  -- LEG'S TRANSPORT lifecycle (pending..completed) and only loosely implies customs
  -- state via 'customs_pending'/'cleared'; this tracks customs clearance itself,
  -- which can be pending while the leg's transport status has already moved on.
  add column if not exists customs_status text not null default 'not_applicable'
    check (customs_status in ('not_applicable','pending','submitted','cleared','held','rejected')),

  -- Lightweight per-leg cost capture (planning estimate vs actual). Real ledger-posted
  -- expenses for a leg already have a path: clearing_payment_bills.leg_id (added in
  -- 20261120_shipping_customer_order_upgrade.sql) lets a payment bill be scoped to a
  -- leg, and the EXISTING bill_expenses/AddExpenseBillButton engine posts against that
  -- bill — reused as-is, not duplicated. These two columns are only a quick reference
  -- figure for the leg card, not a second accounting system.
  add column if not exists estimated_expense_amount numeric,
  add column if not exists actual_expense_amount numeric,
  add column if not exists expense_currency text,

  -- Points at the CURRENTLY OPEN user_tasks row assigned for this leg (the existing,
  -- already-built generic task-assignment engine — user_tasks/user_task_events, see
  -- 20261018_user_tasks.sql — is reused via its polymorphic related_record_table/
  -- related_record_id link; this column is a fast-lookup pointer to whichever task
  -- is presently active for the leg, cleared/replaced as the leg is handed to the
  -- next responsible user).
  add column if not exists current_task_id uuid references public.user_tasks(id);

create index if not exists idx_clearing_customer_order_legs_responsible_user
  on public.clearing_customer_order_legs (responsible_user_id)
  where deleted_at is null;

create index if not exists idx_clearing_customer_order_legs_current_task
  on public.clearing_customer_order_legs (current_task_id)
  where deleted_at is null;

-- ── multi-warehouse loading allocations: one goods line, many source warehouses ────
-- clearing_customer_orders keeps its single goods_id/goods_name/goods_quantity as the
-- ORDER TOTAL (unchanged) — this table lets that total be sourced from more than one
-- warehouse/location without splitting the order or the goods line itself.

create table if not exists public.clearing_customer_order_loading_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.clearing_customer_orders(id) on delete cascade,
  row_serial integer not null default 1,

  warehouse_id uuid references public.warehouses(id),
  -- Free-text fallback for a source that isn't in the Warehouse Master yet
  -- (e.g. "Customer Warehouse" pickup) — mirrors the existing pattern used by
  -- clearing_customer_order_legs.from_location_text for the same reason.
  source_location_text text,

  quantity numeric not null default 0,
  unit text,
  remarks text,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_clearing_customer_order_loading_allocations_order
  on public.clearing_customer_order_loading_allocations (order_id, row_serial)
  where deleted_at is null;

-- ── register new free-text columns for the 5-language translation engine ──────────

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('clearing_customer_order_legs', 'bill_of_entry_no', 'transliterate'),
  ('clearing_customer_order_legs', 'pgm_number', 'transliterate'),
  ('clearing_customer_order_legs', 'declaration_reference', 'transliterate'),
  ('clearing_customer_order_loading_allocations', 'source_location_text', 'transliterate'),
  ('clearing_customer_order_loading_allocations', 'remarks', 'translate')
on conflict (table_name, field_name) do nothing;

select public.attach_translation_triggers();
