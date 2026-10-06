-- ============================================================================
-- 20261025 — Configurable Low-Stock / Re-order levels + Barcode on the product
--            master. Additive only. Uses the real product_inventory_balances
--            data for low-stock detection — no dummy thresholds.
--
-- - products.min_stock_level  : the floor; at/below this the product is "low".
-- - products.reorder_level    : trigger point to raise a purchase / restock.
--   (a product with NEITHER configured is simply never flagged — the previous
--    hard-coded "<= 10" magic number is removed in code.)
-- - products.barcode / barcode_type : central barcode for label print + lookup.
--
-- Idempotent / re-runnable.
-- ============================================================================

alter table public.products
  add column if not exists min_stock_level numeric,
  add column if not exists reorder_level   numeric,
  add column if not exists barcode          text,
  add column if not exists barcode_type     text not null default 'CODE128'
    check (barcode_type in ('CODE128','EAN13','UPC','QR'));

-- one barcode value per country (barcodes are unique within an operating country;
-- the same physical product in two countries may legitimately carry the country's
-- own barcode). Partial: only enforced for live rows that actually have a barcode.
create unique index if not exists products_barcode_country_uidx
  on public.products (country_id, lower(btrim(barcode)))
  where deleted_at is null and coalesce(btrim(barcode),'') <> '';

create index if not exists products_reorder_idx
  on public.products (country_id) where deleted_at is null and (min_stock_level is not null or reorder_level is not null);

-- A branch/warehouse-level low-stock view over the REAL inventory balances.
-- (quantity_available already accounts for reservations.)
create or replace view public.product_low_stock_v as
select
  b.id                       as balance_id,
  b.product_id,
  p.product_name,
  p.sku,
  p.barcode,
  b.country_id,
  b.country_branch_id,
  b.city_branch_id,
  b.warehouse_id,
  b.quantity_on_hand,
  b.quantity_reserved,
  b.quantity_available,
  p.min_stock_level,
  p.reorder_level,
  case
    when p.reorder_level is not null and b.quantity_available <= p.reorder_level then 'reorder'
    when p.min_stock_level is not null and b.quantity_available <= p.min_stock_level then 'low'
    else 'ok'
  end as stock_status,
  greatest(
    coalesce(p.reorder_level, p.min_stock_level, 0) - b.quantity_available,
    0
  ) as suggested_restock_qty,
  b.updated_at
from public.product_inventory_balances b
join public.products p on p.id = b.product_id and p.deleted_at is null
where (p.min_stock_level is not null or p.reorder_level is not null);

comment on view public.product_low_stock_v is
  'Branch/warehouse rows whose available quantity is at/below the product''s configured min-stock or reorder level (real product_inventory_balances data).';
