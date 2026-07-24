-- Core ERP module database completion.
-- Safe additive migration: creates missing production tables used by Sales,
-- Shipping Line, Shipment Documents, and page-to-table tracking.

create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  customer_account_id uuid references enterprise_accounts(id),
  customer_ledger_id uuid references ledgers(id),
  purchase_order_id uuid references purchase_orders(id),
  sales_order_no text not null,
  sales_contract_no text,
  order_date date not null default current_date,
  customer_name text,
  account_number text,
  manual_reference_number text,
  customer_number text,
  country_serial_number text,
  branch_serial_number text,
  product_summary text,
  quantity numeric(18, 3) not null default 0,
  total_weight numeric(18, 3) not null default 0,
  currency_code text not null default 'USD',
  exchange_rate numeric(18, 6) not null default 1,
  order_total numeric(18, 2) not null default 0,
  paid_amount numeric(18, 2) not null default 0,
  remaining_amount numeric(18, 2) not null default 0,
  sales_status text not null default 'draft',
  payment_status text not null default 'pending',
  delivery_status text not null default 'pending',
  workflow_state jsonb not null default '{}'::jsonb,
  form_data jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists sales_orders_no_unique
  on sales_orders(sales_order_no)
  where deleted_at is null;

create index if not exists sales_orders_scope_idx
  on sales_orders(country_id, country_branch_id, city_branch_id, created_at desc)
  where deleted_at is null;

create index if not exists sales_orders_account_lookup_idx
  on sales_orders(account_number, manual_reference_number, customer_number)
  where deleted_at is null;

create table if not exists sales_order_payments (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  ledger_posting_batch_id uuid references ledger_posting_batches(id),
  roznamcha_entry_id uuid references roznamcha_entries(id),
  payment_kind text not null default 'receipt',
  payment_date date not null default current_date,
  amount numeric(18, 2) not null default 0,
  currency_code text not null default 'USD',
  exchange_rate numeric(18, 6) not null default 1,
  account_number text,
  manual_reference_number text,
  customer_number text,
  status text not null default 'posted',
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sales_order_payments_order_idx
  on sales_order_payments(sales_order_id, payment_date desc)
  where deleted_at is null;

create table if not exists shipping_line_records (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  purchase_order_id uuid references purchase_orders(id),
  sales_order_id uuid references sales_orders(id),
  account_id uuid references enterprise_accounts(id),
  ledger_id uuid references ledgers(id),
  shipping_line_name text not null,
  vessel_name text,
  voyage_number text,
  shipping_reference_no text,
  container_numbers text[] not null default array[]::text[],
  port_of_loading text,
  port_of_discharge text,
  eta date,
  etd date,
  shipment_status text not null default 'draft',
  account_number text,
  manual_reference_number text,
  customer_number text,
  country_serial_number text,
  branch_serial_number text,
  workflow_state jsonb not null default '{}'::jsonb,
  form_data jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists shipping_line_records_scope_idx
  on shipping_line_records(country_id, country_branch_id, city_branch_id, created_at desc)
  where deleted_at is null;

create index if not exists shipping_line_records_po_so_idx
  on shipping_line_records(purchase_order_id, sales_order_id)
  where deleted_at is null;

create table if not exists shipment_documents (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  purchase_order_id uuid references purchase_orders(id),
  sales_order_id uuid references sales_orders(id),
  shipping_line_record_id uuid references shipping_line_records(id),
  shipping_bl_record_id uuid references shipping_bl_records(id),
  document_type text not null,
  document_no text,
  document_date date,
  file_url text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists shipment_documents_link_idx
  on shipment_documents(purchase_order_id, sales_order_id, shipping_line_record_id, shipping_bl_record_id)
  where deleted_at is null;

create table if not exists erp_page_database_bindings (
  id uuid primary key default gen_random_uuid(),
  route_path text not null,
  module_code text not null,
  primary_table text not null,
  api_route text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists erp_page_database_bindings_route_idx
  on erp_page_database_bindings(route_path, module_code);

alter table sales_orders enable row level security;
alter table sales_order_payments enable row level security;
alter table shipping_line_records enable row level security;
alter table shipment_documents enable row level security;
alter table erp_page_database_bindings enable row level security;

insert into erp_page_database_bindings(route_path, module_code, primary_table, api_route, notes)
values
  ('/dashboard/purchase/new-purchase-booking-order', 'purchase', 'purchase_orders', '/api/erp/purchases/orders', 'Purchase lifecycle uses purchase_orders.form_data.workflow'),
  ('/dashboard/purchase/purchase-booking-journal-report', 'purchase_report', 'purchase_orders', '/api/erp/purchases/booking-journal-report', 'Scope-based purchase register/report'),
  ('/dashboard/purchase/purchase-loading-records', 'purchase_loading', 'purchase_loading_records', '/api/erp/purchases/loading-records', 'Standalone purchase loading records'),
  ('/dashboard/sales/sales-order', 'sales', 'sales_orders', '/api/erp/sales/orders', 'Sales order production table created in 0028'),
  ('/dashboard/sales/sales-confirm', 'sales_confirm', 'sales_orders', '/api/erp/sales/orders', 'Sales confirmation should read sales_orders.workflow_state'),
  ('/dashboard/shipping-line/shipment-details', 'shipping_line', 'shipping_line_records', '/api/erp/shipping/line-records', 'Shipping line production table created in 0028'),
  ('/dashboard/shipping-line/shipment-report', 'shipping_report', 'shipping_line_records', '/api/erp/shipping/line-records', 'Shipment reports should read shipping_line_records'),
  ('/dashboard/purchase/bill-of-lading', 'bill_of_lading', 'shipping_bl_records', '/api/erp/shipping/bl-records', 'B/L remains linked to purchase workflow'),
  ('/dashboard/accounts', 'accounts', 'enterprise_accounts', '/api/erp/accounting/reports/accounts/general', 'Account register'),
  ('/dashboard/roznamcha/cash-entry', 'roznamcha_cash', 'roznamcha_entries', '/api/erp/roznamcha', 'Unified cash entry')
on conflict (route_path, module_code) do update set
  primary_table = excluded.primary_table,
  api_route = excluded.api_route,
  notes = excluded.notes,
  updated_at = now();

insert into erp_schema_migrations(name, status, applied_at)
values ('0028_core_module_database_completion', 'applied', now())
on conflict (name) do update set
  status = excluded.status,
  applied_at = excluded.applied_at;
