-- Country-to-Country Purchase — Phases 3 & 4: Transportation + Destination Receiving/Stock.
--
-- Extends purchase_loading_records (the EXISTING partial-loading engine — see
-- 0024_purchase_loading_records.sql + 0072_purchase_loading_financial_columns.sql, which
-- already tracks loaded_quantity/total_quantity/loading_percentage per purchase_order_id) —
-- rather than building a parallel table. Destination scope is NOT duplicated here: it's read
-- via purchase_order_id -> purchase_orders.dest_country_id/dest_country_branch_id/dest_city_branch_id
-- (added in 20260821_purchase_orders_destination_scope.sql).

-- ── Part 1: Transportation ──────────────────────────────────────────────────
alter table purchase_loading_records
  add column if not exists transport_mode text check (transport_mode in ('By Road', 'By Sea', 'By Air')),
  add column if not exists transport_company text,
  add column if not exists vehicle_no text,
  add column if not exists truck_id uuid references trucks(id),
  add column if not exists driver_name text,
  add column if not exists driver_mobile text,
  add column if not exists shipping_line text,
  add column if not exists transport_reference text,          -- BL number / road manifest / AWB
  add column if not exists departure_date date,
  add column if not exists expected_arrival_date date,
  add column if not exists actual_arrival_date date,
  add column if not exists transport_expense_amount numeric(18,4) not null default 0,
  add column if not exists transport_expense_currency text not null default 'USD',
  add column if not exists transport_expense_id uuid references purchase_order_expenses(id),
  add column if not exists transport_remarks text;

-- ── Part 2: Quantity lifecycle — In Transit / Receiving ─────────────────────
-- Existing enum: draft/pending/loaded/received/cancelled. Add the missing intermediate stages
-- (Loaded -> Dispatched -> In Transit -> Arrived -> Partially/Fully Received) additively —
-- 'received' is kept as the terminal "fully received" value so nothing existing breaks.
alter table purchase_loading_records drop constraint if exists purchase_loading_records_loading_status_check;
alter table purchase_loading_records add constraint purchase_loading_records_loading_status_check
  check (loading_status in (
    'draft', 'pending', 'loaded', 'dispatched', 'in_transit',
    'partially_received', 'received', 'cancelled'
  ));

alter table purchase_loading_records
  add column if not exists received_quantity numeric(18,4) not null default 0,
  add column if not exists received_at timestamptz,
  add column if not exists received_by uuid references profiles(id),
  add column if not exists receiving_warehouse_id uuid references warehouses(id),
  add column if not exists receiving_goods_id uuid references goods(id),
  add column if not exists receiving_remarks text;

-- Prevent over-loading and over-receiving at the database level, not just app validation.
alter table purchase_loading_records drop constraint if exists plr_loaded_not_exceeding_total_chk;
alter table purchase_loading_records add constraint plr_loaded_not_exceeding_total_chk
  check (total_quantity = 0 or loaded_quantity <= total_quantity);

alter table purchase_loading_records drop constraint if exists plr_received_not_exceeding_loaded_chk;
alter table purchase_loading_records add constraint plr_received_not_exceeding_loaded_chk
  check (received_quantity <= loaded_quantity);

create index if not exists plr_transport_mode_idx
  on purchase_loading_records(transport_mode)
  where deleted_at is null;

-- ── Part 3: Stock movements traceability back to the purchase/receiving stage ──
alter table stock_movements
  add column if not exists purchase_order_id uuid references purchase_orders(id),
  add column if not exists loading_record_id uuid references purchase_loading_records(id);

create index if not exists stock_movements_purchase_order_idx
  on stock_movements(purchase_order_id)
  where deleted_at is null and purchase_order_id is not null;

create index if not exists stock_movements_loading_record_idx
  on stock_movements(loading_record_id)
  where deleted_at is null and loading_record_id is not null;
