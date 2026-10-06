-- Standalone Purchase Loading Records.
-- This module is intentionally separate from purchase_orders. A purchase order
-- link is optional and must be selected explicitly by the user.

create table if not exists public.purchase_loading_records (
  id uuid primary key default gen_random_uuid(),
  country_id uuid null references public.countries(id) on delete set null,
  country_branch_id uuid null references public.country_branches(id) on delete set null,
  city_branch_id uuid null references public.city_branches(id) on delete set null,
  purchase_order_id uuid null references public.purchase_orders(id) on delete set null,
  loading_record_no text not null unique,
  purchase_order_no text null,
  container_number text not null,
  container_type text null,
  loading_status text not null default 'pending'
    check (loading_status in ('draft', 'pending', 'loaded', 'received', 'cancelled')),
  loaded_at timestamptz null,
  loading_location text null,
  receiving_location text null,
  shipment_status text null,
  carrier_name text null,
  remarks text null,
  report_payload jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists purchase_loading_records_country_idx
  on public.purchase_loading_records(country_id)
  where deleted_at is null;

create index if not exists purchase_loading_records_branch_idx
  on public.purchase_loading_records(country_branch_id, city_branch_id)
  where deleted_at is null;

create index if not exists purchase_loading_records_status_idx
  on public.purchase_loading_records(loading_status)
  where deleted_at is null;

create index if not exists purchase_loading_records_container_idx
  on public.purchase_loading_records(container_number)
  where deleted_at is null;
