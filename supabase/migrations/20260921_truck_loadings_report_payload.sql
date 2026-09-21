-- Truck Loading: the form's Parties/Booking, BL/Route, and most of the
-- Goods/Carrier tabs (~35 fields) had no column to land in at all and were
-- silently discarded by the API's FIELDS/NUM allowlist on every save. Rather
-- than add ~35 narrow columns for a still-evolving form, add one flexible
-- catch-all — the same pattern already proven on shipping_bl_records
-- (0017_shipping_bl_records.sql) for the identical problem.

alter table public.truck_loadings
  add column if not exists report_payload jsonb not null default '{}'::jsonb;

insert into public.erp_schema_migrations (name, status)
values ('20260921_truck_loadings_report_payload', 'applied')
on conflict (name) do update set status='applied', applied_at=now();
