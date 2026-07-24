-- Enterprise ERP/FMS: Product Master Architecture
-- Centralized Product Master for multi-country, multi-city, multi-branch,
-- multilingual, inventory, purchase, and sales integration.

create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  category_code text,
  category_name text not null,
  description text,
  original_language_code text not null default 'en' references languages(code),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists product_categories_unique_idx
  on product_categories (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(category_name))
  where deleted_at is null;

create table if not exists product_brands (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  brand_code text,
  brand_name text not null,
  description text,
  original_language_code text not null default 'en' references languages(code),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists product_brands_unique_idx
  on product_brands (coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(brand_name))
  where deleted_at is null;

create table if not exists product_units (
  id uuid primary key default gen_random_uuid(),
  unit_code text not null,
  unit_name text not null,
  base_unit_code text,
  conversion_factor numeric(18, 8) not null default 1,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint product_units_conversion_positive_chk check (conversion_factor > 0)
);

create unique index if not exists product_units_code_unique_idx
  on product_units (upper(unit_code))
  where deleted_at is null;

insert into product_units (unit_code, unit_name, base_unit_code, conversion_factor)
values
  ('KG', 'Kilogram', 'KG', 1),
  ('TON', 'Ton', 'KG', 1000),
  ('BAG', 'Bag', 'KG', 1),
  ('CARTON', 'Carton', 'KG', 1),
  ('BOX', 'Box', 'KG', 1),
  ('PCS', 'Piece', 'PCS', 1)
on conflict do nothing;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  sku text,
  country_id uuid not null references countries(id),
  state_province_id uuid references states_provinces(id),
  city_id uuid references cities(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  category_id uuid references product_categories(id),
  brand_id uuid references product_brands(id),
  unit_id uuid references product_units(id),
  product_name text not null,
  product_description text,
  product_specifications jsonb not null default '{}'::jsonb,
  hs_code text,
  size text,
  origin_country_id uuid references countries(id),
  image_url text,
  original_language_code text not null default 'en' references languages(code),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint products_country_branch_scope_chk check (
    country_branch_id is null or country_id is not null
  )
);

create unique index if not exists products_country_code_unique_idx
  on products (country_id, upper(product_code))
  where deleted_at is null;

create index if not exists products_scope_idx
  on products (country_id, state_province_id, city_id, country_branch_id, city_branch_id)
  where deleted_at is null;

create index if not exists products_name_search_idx
  on products (country_id, lower(product_name))
  where deleted_at is null;

create index if not exists products_sku_search_idx
  on products (country_id, lower(sku))
  where sku is not null and deleted_at is null;

create index if not exists products_hs_search_idx
  on products (country_id, lower(hs_code))
  where hs_code is not null and deleted_at is null;

create table if not exists product_translations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  language_code text not null references languages(code),
  product_name text not null,
  product_description text,
  product_category text,
  product_brand text,
  product_specifications text,
  is_machine_generated boolean not null default true,
  corrected_by uuid references profiles(id),
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists product_translations_product_language_idx
  on product_translations (product_id, language_code)
  where deleted_at is null;

create index if not exists product_translations_name_search_idx
  on product_translations (language_code, lower(product_name))
  where deleted_at is null;

create table if not exists product_country_mapping (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  country_id uuid not null references countries(id),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists product_country_mapping_unique_idx
  on product_country_mapping (product_id, country_id)
  where deleted_at is null;

create table if not exists product_city_mapping (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  country_id uuid not null references countries(id),
  state_province_id uuid references states_provinces(id),
  city_id uuid not null references cities(id),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists product_city_mapping_unique_idx
  on product_city_mapping (product_id, city_id)
  where deleted_at is null;

create table if not exists product_branch_mapping (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  country_id uuid not null references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint product_branch_mapping_one_branch_chk check (
    country_branch_id is not null or city_branch_id is not null
  )
);

create unique index if not exists product_branch_mapping_country_branch_unique_idx
  on product_branch_mapping (product_id, country_branch_id)
  where country_branch_id is not null and deleted_at is null;

create unique index if not exists product_branch_mapping_city_branch_unique_idx
  on product_branch_mapping (product_id, city_branch_id)
  where city_branch_id is not null and deleted_at is null;

-- Warehouse and inventory link tables are intentionally nullable-text/uuid-ready
-- because the Warehouse module table is still planned in this codebase.
create table if not exists product_warehouse_mapping (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  country_id uuid not null references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  warehouse_id uuid,
  warehouse_code text,
  warehouse_name text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists product_warehouse_mapping_scope_idx
  on product_warehouse_mapping (product_id, country_id, country_branch_id, city_branch_id)
  where deleted_at is null;

create table if not exists product_inventory_balances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  country_id uuid not null references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  warehouse_id uuid,
  quantity_on_hand numeric(18, 4) not null default 0,
  quantity_reserved numeric(18, 4) not null default 0,
  quantity_available numeric(18, 4) generated always as (quantity_on_hand - quantity_reserved) stored,
  unit_id uuid references product_units(id),
  updated_at timestamptz not null default now(),
  constraint product_inventory_non_negative_chk check (quantity_on_hand >= 0 and quantity_reserved >= 0)
);

create unique index if not exists product_inventory_balances_unique_idx
  on product_inventory_balances (
    product_id,
    country_id,
    coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create or replace function sync_product_scope_mappings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into product_country_mapping (product_id, country_id, created_by)
  values (new.id, new.country_id, new.created_by)
  on conflict do nothing;

  if new.city_id is not null then
    insert into product_city_mapping (product_id, country_id, state_province_id, city_id, created_by)
    values (new.id, new.country_id, new.state_province_id, new.city_id, new.created_by)
    on conflict do nothing;
  end if;

  if new.country_branch_id is not null then
    insert into product_branch_mapping (product_id, country_id, country_branch_id, created_by)
    values (new.id, new.country_id, new.country_branch_id, new.created_by)
    on conflict do nothing;
  end if;

  if new.city_branch_id is not null then
    insert into product_branch_mapping (product_id, country_id, city_branch_id, created_by)
    values (new.id, new.country_id, new.city_branch_id, new.created_by)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists products_sync_scope_mappings_trg on products;
create trigger products_sync_scope_mappings_trg
after insert or update of country_id, state_province_id, city_id, country_branch_id, city_branch_id
on products
for each row
when (new.deleted_at is null)
execute function sync_product_scope_mappings();

alter table products enable row level security;
alter table product_categories enable row level security;
alter table product_brands enable row level security;
alter table product_units enable row level security;
alter table product_translations enable row level security;
alter table product_country_mapping enable row level security;
alter table product_city_mapping enable row level security;
alter table product_branch_mapping enable row level security;
alter table product_warehouse_mapping enable row level security;
alter table product_inventory_balances enable row level security;

create policy products_scope_read on products
  for select
  using (
    can_access_country(country_id)
    and (country_branch_id is null or can_access_country_branch(country_branch_id))
    and (city_branch_id is null or can_access_city_branch(city_branch_id))
  );

create policy product_categories_scope_read on product_categories
  for select
  using (country_id is null or can_access_country(country_id));

create policy product_brands_scope_read on product_brands
  for select
  using (country_id is null or can_access_country(country_id));

create policy product_units_read on product_units
  for select
  using (true);

create policy product_translations_read on product_translations
  for select
  using (
    exists (
      select 1 from products p
      where p.id = product_translations.product_id
        and p.deleted_at is null
        and can_access_country(p.country_id)
        and (p.country_branch_id is null or can_access_country_branch(p.country_branch_id))
        and (p.city_branch_id is null or can_access_city_branch(p.city_branch_id))
    )
  );

create policy product_country_mapping_read on product_country_mapping
  for select
  using (can_access_country(country_id));

create policy product_city_mapping_read on product_city_mapping
  for select
  using (can_access_country(country_id));

create policy product_branch_mapping_read on product_branch_mapping
  for select
  using (
    can_access_country(country_id)
    and (country_branch_id is null or can_access_country_branch(country_branch_id))
    and (city_branch_id is null or can_access_city_branch(city_branch_id))
  );

create policy product_warehouse_mapping_read on product_warehouse_mapping
  for select
  using (
    can_access_country(country_id)
    and (country_branch_id is null or can_access_country_branch(country_branch_id))
    and (city_branch_id is null or can_access_city_branch(city_branch_id))
  );

create policy product_inventory_balances_read on product_inventory_balances
  for select
  using (
    can_access_country(country_id)
    and (country_branch_id is null or can_access_country_branch(country_branch_id))
    and (city_branch_id is null or can_access_city_branch(city_branch_id))
  );

insert into permissions (resource, action, description)
values
  ('products', 'create', 'Create product master records'),
  ('products', 'read', 'View product master records'),
  ('products', 'update', 'Update product master records'),
  ('products', 'delete', 'Delete product master records'),
  ('product_categories', 'create', 'Create product categories'),
  ('product_categories', 'read', 'View product categories'),
  ('product_categories', 'update', 'Update product categories'),
  ('product_brands', 'create', 'Create product brands'),
  ('product_brands', 'read', 'View product brands'),
  ('product_brands', 'update', 'Update product brands'),
  ('product_units', 'read', 'View product units'),
  ('inventory', 'read', 'View inventory balances')
on conflict (resource, action) do nothing;

notify pgrst, 'reload schema';
