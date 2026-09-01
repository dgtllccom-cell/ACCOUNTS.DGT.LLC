-- ============================================================================
-- 20261024 — Truck Registration as an ERP-wide master + By Road order linkage
--
-- 1. trucks is a CENTRAL master: a truck registered from ANY country/branch is
--    searchable and reusable everywhere (subject to shipping_records permission).
--    Enforce a single GLOBAL unique truck number (case-insensitive) so the same
--    vehicle is never registered twice. The old per-country unique index is
--    replaced. (Both DEV and PROD trucks tables are currently empty — safe.)
--
-- 2. clearing_customer_orders (Clearing Agent → New Order → By Road) can now
--    attach either a PERMANENT/registered truck (truck_id → trucks, snapshot
--    kept) or a TEMPORARY truck (quick-entry fields only, truck_id NULL).
--    Original accounting / workflow columns are untouched.
--
-- Idempotent / re-runnable.
-- ============================================================================

-- ── 1) trucks → global master ───────────────────────────────────────────────
do $blk$
declare dup_count int;
begin
  select count(*) into dup_count from (
    select lower(btrim(truck_number)) n
    from public.trucks where deleted_at is null and coalesce(btrim(truck_number),'') <> ''
    group by 1 having count(*) > 1
  ) d;

  -- retire the per-country unique index
  execute 'drop index if exists public.trucks_number_unique_idx';

  if dup_count = 0 then
    execute $q$
      create unique index if not exists trucks_number_global_uidx
        on public.trucks (lower(btrim(truck_number)))
        where deleted_at is null and coalesce(btrim(truck_number),'') <> ''
    $q$;
    raise notice '20261024: global unique truck-number index created';
  else
    -- data has cross-scope duplicates — fall back to a non-unique lookup index and
    -- let the API layer de-duplicate; a follow-up data cleanup is required.
    execute 'create index if not exists trucks_number_lookup_idx on public.trucks (lower(btrim(truck_number))) where deleted_at is null';
    raise warning '20261024: % duplicate truck number group(s) — skipped global unique index, using lookup index', dup_count;
  end if;
end
$blk$;

-- fast search for the New Order truck picker (prefix ILIKE uses this btree)
create index if not exists trucks_number_search_idx
  on public.trucks (lower(truck_number)) where deleted_at is null;
create index if not exists trucks_status_active_idx
  on public.trucks (status) where deleted_at is null;

-- ── 2) clearing_customer_orders → truck linkage ────────────────────────────
alter table public.clearing_customer_orders
  add column if not exists truck_id uuid references public.trucks(id),
  add column if not exists truck_registration_type text
    check (truck_registration_type in ('registered','temporary')),
  add column if not exists truck_number text,
  add column if not exists truck_driver_name text,
  add column if not exists truck_driver_mobile text,
  add column if not exists truck_owner_name text,
  add column if not exists truck_transport_company text,
  add column if not exists truck_details jsonb;

create index if not exists clearing_customer_orders_truck_idx
  on public.clearing_customer_orders (truck_id) where deleted_at is null;

comment on column public.clearing_customer_orders.truck_details is
  'Snapshot of the selected truck at order time (registered) or the quick-entry values (temporary).';
