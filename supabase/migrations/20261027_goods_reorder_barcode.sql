-- ============================================================================
-- 20261027 — Re-order / min-stock / barcode on the GOODS master.
--
-- The ERP has two item masters that share row ids for stocked items:
--   - goods                     : the rich CHS master (live data-entry UI)
--   - products                  : the FK anchor for product_inventory_balances
--                                 (a "shadow" row is upserted on stock receive)
-- product_low_stock_v (20261025) keys on `products`. This migration puts the
-- SAME re-order config on `goods` so it can be entered from the goods UI; the
-- purchase-receive flow mirrors it onto the products shadow row.
--
-- Additive & idempotent.
-- ============================================================================

alter table public.goods
  add column if not exists min_stock_level numeric,
  add column if not exists reorder_level   numeric,
  add column if not exists barcode          text,
  add column if not exists barcode_type     text not null default 'CODE128'
    check (barcode_type in ('CODE128','EAN13','UPC','QR'));

create unique index if not exists goods_barcode_uidx
  on public.goods (lower(btrim(barcode)))
  where deleted_at is null and coalesce(btrim(barcode),'') <> '';

-- one-time: push any goods thresholds already set onto existing products shadow rows
update public.products p
   set min_stock_level = coalesce(p.min_stock_level, g.min_stock_level),
       reorder_level   = coalesce(p.reorder_level,   g.reorder_level),
       barcode         = coalesce(p.barcode,         g.barcode)
  from public.goods g
 where g.id = p.id
   and (g.min_stock_level is not null or g.reorder_level is not null or g.barcode is not null);
