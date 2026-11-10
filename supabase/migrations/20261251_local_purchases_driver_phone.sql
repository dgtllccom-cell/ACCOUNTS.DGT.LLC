-- Adds the missing driver_phone column to local_purchases.
-- purchase-lane-service.ts (ensureLaneFromLocalPurchase) reads lp.driver_phone with a fallback to
-- loading_details->'entries'->0->>'driverPhone'. Production raised "column lp.driver_phone does not exist".
-- Additive and nullable: no default, no backfill, no existing row or value is changed.
-- Existing records keep their loading_details fallback exactly as before.

alter table public.local_purchases
  add column if not exists driver_phone text;

comment on column public.local_purchases.driver_phone is
  'Driver mobile number for the local purchase load. Null for older records (the loading_details fallback applies).';
