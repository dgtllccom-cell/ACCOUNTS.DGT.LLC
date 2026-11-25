-- Sales loading is operational and cannot update purchase loading or post ledgers.
create table public.sales_loading_records (
  id uuid primary key default gen_random_uuid(),
  entry_no bigint generated always as identity unique,
  sales_order_id uuid not null references public.sales_orders(id) on delete restrict,
  sales_booking_no text not null,
  container_number text not null check (length(container_number) between 1 and 160),
  container_type text not null,
  loading_date date not null,
  received_date date,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  goods jsonb not null check (jsonb_typeof(goods) = 'array' and jsonb_array_length(goods) > 0),
  created_by uuid not null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_loading_order_container unique(sales_order_id, container_number),
  constraint sales_loading_date_order check (received_date is null or received_date >= loading_date)
);

-- Internal API only. Don’t expose customer or shipment data through PostgREST.
alter table public.sales_loading_records enable row level security;
revoke all on public.sales_loading_records from public, anon, authenticated;
revoke all on sequence public.sales_loading_records_entry_no_seq from public, anon, authenticated;
