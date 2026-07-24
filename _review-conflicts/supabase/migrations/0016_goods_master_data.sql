-- Enterprise ERP/FMS: Centralized Goods / Products Master Data
-- - One-time goods entry, reusable across Purchase/Sales/Inventory modules
-- - Search by goods name, product code, HS code, brand

create table if not exists goods (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  goods_name text not null,
  product_code text,
  hs_code text,
  size text,
  brand text,
  origin_country_id uuid references countries(id),
  image_url text,
  original_language_code text not null default 'en' references languages(code),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists goods_country_idx
  on goods (country_id)
  where deleted_at is null;

create index if not exists goods_name_search_idx
  on goods (country_id, lower(goods_name))
  where deleted_at is null;

create index if not exists goods_code_search_idx
  on goods (country_id, lower(product_code))
  where product_code is not null and deleted_at is null;

create index if not exists goods_hs_search_idx
  on goods (country_id, lower(hs_code))
  where hs_code is not null and deleted_at is null;

create index if not exists goods_brand_search_idx
  on goods (country_id, lower(brand))
  where brand is not null and deleted_at is null;

create unique index if not exists goods_unique_per_country
  on goods (country_id, lower(goods_name), coalesce(lower(product_code), ''))
  where deleted_at is null;

create or replace function create_goods(
  p_country_id uuid,
  p_goods_name text,
  p_product_code text,
  p_hs_code text,
  p_size text,
  p_brand text,
  p_origin_country_id uuid,
  p_image_url text,
  p_original_language_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_goods_id uuid;
begin
  if trim(coalesce(p_goods_name, '')) = '' then
    raise exception 'Goods name is required';
  end if;

  insert into goods (
    country_id,
    goods_name,
    product_code,
    hs_code,
    size,
    brand,
    origin_country_id,
    image_url,
    original_language_code
  )
  values (
    p_country_id,
    trim(p_goods_name),
    nullif(trim(coalesce(p_product_code, '')), ''),
    nullif(trim(coalesce(p_hs_code, '')), ''),
    nullif(trim(coalesce(p_size, '')), ''),
    nullif(trim(coalesce(p_brand, '')), ''),
    p_origin_country_id,
    nullif(trim(coalesce(p_image_url, '')), ''),
    coalesce(nullif(trim(p_original_language_code), ''), 'en')
  )
  returning id into new_goods_id;

  return new_goods_id;
end;
$$;

alter table goods enable row level security;

create policy goods_scope_read on goods
  for select
  using (can_access_country(country_id));

-- write access is restricted to Super Admin / allowed roles via service layer (security definer RPC).

