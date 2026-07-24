create table if not exists tax_codes (
  id uuid primary key default gen_random_uuid(),
  tax_name text not null,
  tax_pct numeric not null default 0,
  country_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tax_codes enable row level security;

create policy "Enable read access for authenticated users on tax_codes"
  on tax_codes for select
  to authenticated
  using (true);

create policy "Enable insert access for authenticated users on tax_codes"
  on tax_codes for insert
  to authenticated
  with check (true);

create policy "Enable delete access for authenticated users on tax_codes"
  on tax_codes for delete
  to authenticated
  using (true);

create policy "Enable update access for authenticated users on tax_codes"
  on tax_codes for update
  to authenticated
  using (true)
  with check (true);
