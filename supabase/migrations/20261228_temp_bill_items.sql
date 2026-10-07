-- Additive: multi-item line table for Arzi (temporary) bills, so the entry form can show a
-- goods item table like Local Purchase. Tracking only — NO ledger/roznamcha/journal/stock posting.
-- Each item: { goodsId, goodsName, quantity, weightCartons, unit, rate, amount }.
-- The existing aggregate columns (quantity/weight_cartons/rate/amount/goods_name) stay the bill totals.
alter table public.temp_bill
  add column if not exists items jsonb not null default '[]'::jsonb;

comment on column public.temp_bill.items is
  'Repeatable goods line items for an Arzi temporary bill (tracking only, no accounting/stock posting).';
