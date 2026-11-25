# Sales Loading: pagination and safe scope

- The server selects at most 200 authorized posted Sales Bookings per request, newest created first. A precise creation timestamp plus UUID is a stable continuation key; each continuation binds the request's session location scope, language, financial visibility and narrow filters. Every request is re-authorized. Direct links to a booking query only its saved UUID within that scope.
- The register accepts complete pages up to 10 pages (2,000 bookings maximum) or 5,000 loading records. An oversized page is not partially published. Where the scope exceeds the bound, it withholds register totals and asks the user to narrow (country, main/city branch, booking, container, loading date or actual receiving date). Free-text, goods, role-scoped status and route refinements are applied only to the fetched scope.
- Locations for filter choices come from the authorized scope independently of the visible page. A stale response, mismatched scope, duplicate booking/record, unlinked record or stalled cursor is rejected; previous rows and write capabilities are cleared when reloading.
- Loading records have RLS enabled and no public/anon/authenticated grants, with scope checked against their Sales Booking by the application. The additive index migration operates only on `sales_orders` and `sales_loading_records`; validate in authenticated TESTING and schedule production index creation appropriately before deployment. No Purchase tables or configurations are changed.

For the Local Sales view, `/dashboard/sales/sales-loading?source=local`, the
same ERP permission, country/branch scope and limits apply. The source is
included in the cursor scope; a cursor from one document kind cannot read the
other. Local Sales uses explicit Local Purchase source or the same non-export
managed-lot classification as the Local Sales register. Both views show posted/transferred Cash, Credit and Account Transfer. Invoice
sales are eligible only with an active finalized Commercial, Export or Tax
invoice in the Invoice Register linked to the original sale by ID and source
table. Advance and other payment types are excluded. The rule prefers the
original transfer trace to later receipts. Legacy Account Transfer orders
routed through the generic Advance journal are recognized only by an exact
stored Account Transfer label; an actual Advance does not become eligible
just because it is paid or has a different bill's invoice.
Local Loading does not collect money or set payment status. It stores loading
and receiving in the existing Sales Loading table by the original order ID
and bill number. Apply the existing Sales Loading schema and paging migrations
before testing this view against a database; no new migration is introduced.
