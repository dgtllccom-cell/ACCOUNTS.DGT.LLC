-- Country-to-Country Sale — mirrors 20260821_purchase_orders_destination_scope.sql
-- (the existing, already-working Country-to-Country Purchase feature) onto sales_orders.
--
-- ADDITIVE only. sales_orders already has ONE scope (country_id/country_branch_id/
-- city_branch_id — the selling/source side). This adds an OPTIONAL destination scope so a
-- sale can be made by a source country/branch on behalf of a different destination
-- country/branch (e.g. Selling Country Pakistan/Branch Chaman, Destination Country UAE/
-- Branch Dubai), while remaining the SAME sales_orders row throughout its lifecycle (no
-- second sale, no parallel table). Existing same-country sales orders are unaffected —
-- these columns default to NULL.

alter table sales_orders
  add column if not exists dest_country_id uuid references countries(id),
  add column if not exists dest_country_branch_id uuid references country_branches(id),
  add column if not exists dest_city_branch_id uuid references city_branches(id);

-- Only enforced when a destination is actually set — a plain same-country sale (all three
-- dest columns NULL) is unaffected. When set, the destination must differ from the source at
-- whichever level is most specific (identical pattern to purchase_orders_dest_differs_source_chk).
alter table sales_orders
  add constraint sales_orders_dest_differs_source_chk check (
    coalesce(dest_city_branch_id, dest_country_branch_id, dest_country_id) is null
    or coalesce(dest_city_branch_id, dest_country_branch_id, dest_country_id)
       <> coalesce(city_branch_id, country_branch_id, country_id)
  );

create index if not exists sales_orders_dest_scope_idx
  on sales_orders (dest_country_id, dest_country_branch_id, dest_city_branch_id)
  where deleted_at is null and dest_country_id is not null;
