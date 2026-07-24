-- Custom Purchase Booking Reports
create table if not exists purchase_order_reports (
  id uuid primary key default uuid_generate_v4(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  report_name text not null,
  description text,
  notes text,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table purchase_order_reports enable row level security;
create policy purchase_order_reports_policy on purchase_order_reports for all using (true);
