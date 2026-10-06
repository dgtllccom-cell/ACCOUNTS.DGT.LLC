create table if not exists shipping_bl_records (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  purchase_order_id uuid references purchase_orders(id),
  sales_order_id uuid,
  loading_record_id uuid,
  roznamcha_entry_id uuid references roznamcha_entries(id),
  ledger_id uuid references ledgers(id),
  created_by uuid references profiles(id),
  shipping_line_name text not null,
  bl_number text not null,
  container_number text,
  vessel_name text,
  voyage_number text,
  loading_port text,
  discharge_port text,
  eta date,
  etd date,
  shipment_status text not null default 'draft',
  account_number text,
  debit numeric(18,4) not null default 0,
  credit numeric(18,4) not null default 0,
  currency_code text not null default 'USD',
  report_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shipping_bl_records_currency_chk check (char_length(currency_code) = 3),
  constraint shipping_bl_records_amount_chk check (debit >= 0 and credit >= 0)
);

create unique index if not exists shipping_bl_records_bl_number_idx
  on shipping_bl_records (bl_number)
  where deleted_at is null;

create index if not exists shipping_bl_records_country_idx on shipping_bl_records(country_id, created_at desc);
create index if not exists shipping_bl_records_country_branch_idx on shipping_bl_records(country_branch_id, created_at desc);
create index if not exists shipping_bl_records_city_branch_idx on shipping_bl_records(city_branch_id, created_at desc);
create index if not exists shipping_bl_records_status_idx on shipping_bl_records(shipment_status);

alter table shipping_bl_records enable row level security;

drop policy if exists shipping_bl_records_scope_read on shipping_bl_records;
create policy shipping_bl_records_scope_read on shipping_bl_records
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

drop policy if exists shipping_bl_records_scope_write on shipping_bl_records;
create policy shipping_bl_records_scope_write on shipping_bl_records
  for all using (
    is_super_admin()
    or (country_id is not null and can_manage_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  )
  with check (
    is_super_admin()
    or (country_id is not null and can_manage_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );
