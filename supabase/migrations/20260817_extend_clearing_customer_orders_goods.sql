-- Extend clearing customer orders with canonical Goods Master references.
-- This keeps Shipping/Clearing on the existing ERP Goods Master instead of a
-- parallel Shipping-specific item table.

alter table if exists public.clearing_customer_orders
  add column if not exists goods_id uuid references public.goods(id),
  add column if not exists goods_variation_id uuid references public.goods_variations(id),
  add column if not exists goods_name text,
  add column if not exists goods_chs_code text,
  add column if not exists goods_variation_label text,
  add column if not exists goods_brand text,
  add column if not exists goods_size text,
  add column if not exists goods_origin_country_name text;

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('clearing_customer_orders', 'goods_name', 'translate'),
  ('clearing_customer_orders', 'goods_variation_label', 'translate'),
  ('clearing_customer_orders', 'goods_brand', 'translate'),
  ('clearing_customer_orders', 'goods_size', 'translate'),
  ('clearing_customer_orders', 'goods_origin_country_name', 'transliterate')
on conflict (table_name, field_name) do nothing;

