-- Extend canonical clearing customer orders with the business fields requested
-- for the left-entry / right-report customer-order workflow.
alter table if exists public.clearing_customer_orders
  add column if not exists exporter_name text,
  add column if not exists importer_name text,
  add column if not exists notify_party_required boolean not null default false,
  add column if not exists notify_party_name text,
  add column if not exists buyer_name text,
  add column if not exists loading_source text,
  add column if not exists loading_source_name text;

create table if not exists public.clearing_customer_order_parties (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.clearing_customer_orders(id) on delete cascade,
  role_key text not null check (role_key in ('supplier', 'importer', 'exporter', 'notify_party', 'buyer')),
  party_customer_id uuid references public.customers(id),
  party_customer_name text not null,
  party_company_id uuid references public.companies(id),
  party_company_name text,
  selected_address_text text,
  selected_address_source text,
  country_id uuid references public.countries(id),
  country_branch_id uuid references public.country_branches(id),
  city_branch_id uuid references public.city_branches(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_clearing_customer_order_parties_order_role
  on public.clearing_customer_order_parties (order_id, role_key)
  where deleted_at is null;

create index if not exists idx_clearing_customer_order_parties_party
  on public.clearing_customer_order_parties (role_key, party_customer_id, created_at desc)
  where deleted_at is null;

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('clearing_customer_orders', 'exporter_name', 'transliterate'),
  ('clearing_customer_orders', 'importer_name', 'transliterate'),
  ('clearing_customer_orders', 'notify_party_name', 'transliterate'),
  ('clearing_customer_orders', 'buyer_name', 'transliterate'),
  ('clearing_customer_orders', 'loading_source_name', 'transliterate'),
  ('clearing_customer_order_parties', 'party_customer_name', 'transliterate'),
  ('clearing_customer_order_parties', 'party_company_name', 'transliterate'),
  ('clearing_customer_order_parties', 'selected_address_text', 'translate')
on conflict (table_name, field_name) do nothing;
