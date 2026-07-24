-- 0045_multi_currency_accounting.sql
-- Phase 2: Relational tables for Purchase Items & Expenses and Multi-Currency tracking

-- Enum removed to prevent Drizzle migration conflicts. Using text for expense_type.

-- 1. Alter purchase_orders to add specific currency and accounting fields
alter table purchase_orders
  add column if not exists purchase_currency text not null default 'USD',
  add column if not exists payment_currency text not null default 'USD',
  add column if not exists total_goods_original numeric(18,4) not null default 0,
  add column if not exists total_goods_local numeric(18,4) not null default 0,
  add column if not exists total_goods_usd numeric(18,4) not null default 0,
  add column if not exists total_expenses_original numeric(18,4) not null default 0,
  add column if not exists total_expenses_local numeric(18,4) not null default 0,
  add column if not exists total_expenses_usd numeric(18,4) not null default 0,
  add column if not exists landed_cost_original numeric(18,4) not null default 0,
  add column if not exists landed_cost_local numeric(18,4) not null default 0,
  add column if not exists landed_cost_usd numeric(18,4) not null default 0;

-- 2. Create purchase_order_items table
create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  
  -- Item Details
  product_id uuid references products(id),
  goods_name text not null,
  hs_code text,
  size text,
  brand text,
  origin text,
  
  -- Quantities
  quantity numeric(18,4) not null default 0,
  unit_name text not null,
  unit_weight numeric(18,4) not null default 0,
  gross_weight numeric(18,4) not null default 0,
  net_weight numeric(18,4) not null default 0,
  
  -- Pricing & Currency
  rate_original numeric(18,4) not null default 0,
  rate_local numeric(18,4) not null default 0,
  rate_usd numeric(18,4) not null default 0,
  
  total_original numeric(18,4) not null default 0,
  total_local numeric(18,4) not null default 0,
  total_usd numeric(18,4) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_order_items_po_idx on purchase_order_items(purchase_order_id);

-- 3. Create purchase_order_expenses table
create table if not exists purchase_order_expenses (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  expense_type text not null,
  
  ledger_id uuid references ledgers(id),
  description text,
  
  expense_currency text not null default 'USD',
  exchange_rate numeric(18,8) not null default 1,
  
  amount_original numeric(18,4) not null default 0,
  amount_local numeric(18,4) not null default 0,
  amount_usd numeric(18,4) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_order_expenses_po_idx on purchase_order_expenses(purchase_order_id);

-- 4. RLS Policies
alter table purchase_order_items enable row level security;
alter table purchase_order_expenses enable row level security;

create policy purchase_order_items_read on purchase_order_items
  for select using (
    exists (
      select 1 from purchase_orders o
      where o.id = purchase_order_items.purchase_order_id
        and o.deleted_at is null
        and (
          (o.country_id is null and is_super_admin())
          or (o.country_id is not null and can_access_country(o.country_id))
        )
    )
  );

create policy purchase_order_items_write on purchase_order_items
  for all using (
    exists (
      select 1 from purchase_orders o
      where o.id = purchase_order_items.purchase_order_id
        and o.deleted_at is null
        and (
          (o.country_id is null and is_super_admin())
          or (o.country_id is not null and can_access_country(o.country_id))
        )
    )
  );

create policy purchase_order_expenses_read on purchase_order_expenses
  for select using (
    exists (
      select 1 from purchase_orders o
      where o.id = purchase_order_expenses.purchase_order_id
        and o.deleted_at is null
        and (
          (o.country_id is null and is_super_admin())
          or (o.country_id is not null and can_access_country(o.country_id))
        )
    )
  );

create policy purchase_order_expenses_write on purchase_order_expenses
  for all using (
    exists (
      select 1 from purchase_orders o
      where o.id = purchase_order_expenses.purchase_order_id
        and o.deleted_at is null
        and (
          (o.country_id is null and is_super_admin())
          or (o.country_id is not null and can_access_country(o.country_id))
        )
    )
  );

INSERT INTO public.erp_schema_migrations (name, status, applied_at)
VALUES ('0045_multi_currency_accounting', 'applied', now())
ON CONFLICT (name) DO UPDATE
  SET status = excluded.status,
      applied_at = excluded.applied_at;

NOTIFY pgrst, 'reload schema';
