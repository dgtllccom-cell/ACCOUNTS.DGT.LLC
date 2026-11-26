-- Keyset paging and authorized location choices read only posted bookings.
create index sales_loading_scope_recent_idx on public.sales_orders (created_at desc, id desc)
  where deleted_at is null and ledger_posting_status in ('posted','transferred');
create index sales_loading_scope_country_idx on public.sales_orders (country_id, created_at desc, id desc)
  where deleted_at is null and ledger_posting_status in ('posted','transferred');
create index sales_loading_scope_city_idx on public.sales_orders (city_branch_id, created_at desc, id desc)
  where deleted_at is null and ledger_posting_status in ('posted','transferred');
create index sales_loading_scope_main_idx on public.sales_orders (country_branch_id, created_at desc, id desc)
  where deleted_at is null and ledger_posting_status in ('posted','transferred');
create index sales_loading_scope_locations_idx on public.sales_orders (country_id, country_branch_id, city_branch_id)
  where deleted_at is null and ledger_posting_status in ('posted','transferred');
create index sales_loading_booking_date_idx on public.sales_loading_records (sales_order_id, loading_date desc, entry_no desc);
