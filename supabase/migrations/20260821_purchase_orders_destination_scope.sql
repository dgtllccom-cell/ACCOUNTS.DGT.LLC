-- Country-to-Country Purchase — Phase 1: destination scope on purchase_orders.
--
-- ADDITIVE only. purchase_orders already has ONE scope (country_id/country_branch_id/
-- city_branch_id — the purchasing/source side). This adds an OPTIONAL destination scope so a
-- purchase can be made by a source country/branch on behalf of a different destination
-- country/branch, while remaining the SAME purchase_orders row throughout its lifecycle (no
-- second purchase, no parallel table). Existing same-country purchase orders are unaffected —
-- these columns default to NULL.
--
-- Naming/pattern matches the existing origin/dest columns on shipping_expense_transfers
-- (20260819_shipping_intercountry_transfer.sql) and the source/destination CHECK pattern on
-- inter_branch_ledger_transfers (0020_branch_ledger_inter_branch_accounting.sql).

alter table purchase_orders
  add column if not exists dest_country_id uuid references countries(id),
  add column if not exists dest_country_branch_id uuid references country_branches(id),
  add column if not exists dest_city_branch_id uuid references city_branches(id);

-- Only enforced when a destination is actually set — a plain same-country purchase (all three
-- dest columns NULL) is unaffected. When set, the destination must differ from the source at
-- whichever level is most specific (mirrors inter_branch_ledger_transfers_source_destination_chk).
alter table purchase_orders
  add constraint purchase_orders_dest_differs_source_chk check (
    coalesce(dest_city_branch_id, dest_country_branch_id, dest_country_id) is null
    or coalesce(dest_city_branch_id, dest_country_branch_id, dest_country_id)
       <> coalesce(city_branch_id, country_branch_id, country_id)
  );

create index if not exists purchase_orders_dest_scope_idx
  on purchase_orders (dest_country_id, dest_country_branch_id, dest_city_branch_id)
  where deleted_at is null and dest_country_id is not null;
