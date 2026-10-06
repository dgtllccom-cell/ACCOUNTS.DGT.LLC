-- Customer Order workflow 1A/1B/1C hardening.
--
-- 1) clearing_customer_orders.goods_items (jsonb): the full per-item goods manifest
--    (name, HS code, brand/quality, size, origin, unit, qty, gross/tare/net, currency,
--    rate, amount, warehouse, quality report). Until now only name/qty/remarks survived
--    in clearing_customer_order_loading_allocations, so reopening a saved order lost the
--    detail the user entered in step 1C. cargo_details stays the free-text cargo note.
--
-- 2) Normalise jsonb values that older workflow code stored as JSON *text*
--    (`${JSON.stringify(x)}::jsonb` double-encodes into a jsonb string). Only rows whose
--    string content is a JSON object are rewritten; everything else is untouched.
--
-- Additive + idempotent. No rows deleted.

alter table public.clearing_customer_orders
  add column if not exists goods_items jsonb;

comment on column public.clearing_customer_orders.goods_items is
  'Full per-item goods manifest saved from step 1C (array of goods item objects).';

update public.clearing_customer_orders
   set truck_details = (truck_details #>> '{}')::jsonb
 where jsonb_typeof(truck_details) = 'string'
   and (truck_details #>> '{}') ~ '^\s*\{';

update public.erp_activity_events
   set metadata = (metadata #>> '{}')::jsonb
 where jsonb_typeof(metadata) = 'string'
   and (metadata #>> '{}') ~ '^\s*\{';

update public.inter_country_transfers
   set metadata = (metadata #>> '{}')::jsonb
 where jsonb_typeof(metadata) = 'string'
   and (metadata #>> '{}') ~ '^\s*\{';
