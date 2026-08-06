-- Migration for Clearing Agent Customer Orders with 5-Language Storage
create table if not exists public.clearing_customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id uuid references public.customers(id),
  customer_name text not null,
  route_name text,
  shipment_type text not null default 'FCL',
  transport_mode text not null default 'by_sea',
  movement_type text not null default 'import',
  loading_country_id uuid references public.countries(id),
  loading_country_name text,
  receiving_country_id uuid references public.countries(id),
  receiving_country_name text,
  loading_port_id uuid references public.ports(id),
  loading_port_name text,
  destination_port_id uuid references public.ports(id),
  destination_port_name text,
  cargo_details text,
  expected_loading_date timestamptz,
  remarks text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_clearing_customer_orders_status
  on public.clearing_customer_orders (status, created_at desc)
  where deleted_at is null;

-- Register fields into multilingual field registry
insert into public.translation_field_registry (table_name, field_name, mode) values
  ('clearing_customer_orders', 'customer_name', 'transliterate'),
  ('clearing_customer_orders', 'route_name', 'translate'),
  ('clearing_customer_orders', 'loading_country_name', 'transliterate'),
  ('clearing_customer_orders', 'receiving_country_name', 'transliterate'),
  ('clearing_customer_orders', 'loading_port_name', 'transliterate'),
  ('clearing_customer_orders', 'destination_port_name', 'transliterate'),
  ('clearing_customer_orders', 'cargo_details', 'translate')
on conflict (table_name, field_name) do nothing;

-- Provision 5 dedicated language tables and attach triggers
select public.attach_translation_triggers();
