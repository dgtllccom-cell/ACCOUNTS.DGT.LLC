# Stock Journal — Purchase Booking & Local Purchase → Sale / Export

One screen (`/dashboard/purchase/stock/*`), one service (`lib/services/stock-journal-service.ts`), one pure model
(`lib/stock-journal/model.ts`). No second stock system: physical warehouse stock stays in `product_inventory_balances` +
`stock_movements` (the same tables Inventory and Destination Receiving use); the authorized decisions live in
`journal_stock_transfers`; Local Purchase goods are read from `purchase_lots` / `lot_stock` and confirmed in their own
Goods Transfer Journal.

## Why bookings were missing (root causes)
1. **Production** had no `journal_stock_transfers` table (migration 20261015 was never applied), so the whole
   `GET /api/erp/inventory/journal-stock` failed. Created (if missing) by `20261235_stock_journal_integration.sql`.
2. Most DEV bookings hold `form_data` / `report_payload` as a **JSON string** inside the jsonb column (some as a
   spread-string object), so the booked quantity read as 0 and the booking vanished. The same blind spot made the Purchase
   Loading route refuse every loading on such a booking ("exceeds the remaining purchase quantity"). `parseJsonish` fixes both.
3. A booking with no goods / quantity yet (Draft) was dropped; it now appears as Booking Stock (quantity 0, flagged).
4. The old read route ignored the session scope (country/branch from the query string); the old transfer route had no scope
   check, no idempotency and wrote a second STOCK_IN. Both replaced.

## Stages (a quantity lives in exactly one at a time)
`booking` (booked − loaded) → `transit` (loaded − received − damage − shortage) → `receiving` (received, customs open) →
`ready` (received + customs cleared) → `available` / `reserved` (confirmed) → `sold` (issued).
Booking confirmation, invoice (ledger) status and payment status are **separate** indicators; payment completed turns the
payment dot black and never moves stock.

## Events (all transactional, row-locked, idempotent)
- Receiving — existing route `POST /purchases/loading-records/:id/receive` (+ damaged / shortage / customs).
- Confirm Stock — `POST /inventory/journal-stock/confirm` (authorized user, customs cleared, ≤ received − confirmed).
  Warehouse (same warehouse = allocation only; other warehouse = move out/in), Local Market (allocation), Export / Direct Sale
  (reserve in `quantity_reserved`, so the Sales wizard cannot sell it again).
- Goods Issue / Dispatch / Delivery — `POST .../issue` is the ONLY physical deduction (once). The sales posting route also
  issues allocations linked to its sales booking.
- Reverse — `POST .../reverse` (reason required) before issue; restores reservation / warehouse move.
- Customs — `POST .../customs` when no Clearing order carries the container / B/L.

## Payment rule for Confirmed Stock
A loading's quantity is eligible for Confirm Stock only when it is received, customs-cleared and — for Advance / Endorsement bills — that loading's
Remaining Payment is complete (`lib/services/purchase-loading-payment-service.ts`, pure rules in `lib/purchases/loaded-payable.ts`). The row shows
Paid / Balance, a held row is tagged "Awaiting Remaining Payment", and `confirmStock` refuses it server-side (`409 PAYMENT_NOT_COMPLETE`). Credit and
other conditions are not held by this rule. Advance money is allocated to loadings by quantity share; every Remaining payment is tied to its loading.
End-to-end check: `scripts/dev/advance-to-confirmed-stock-e2e.mjs` (DEV only, throw-away USD 100,000 / 2,000-carton bill).

## Verification
`scripts/e2e-stock-journal.mjs` (53 API checks) and `scripts/e2e-stock-journal-ui.mjs` (desktop EN/UR/AR/FA/PS, iPhone,
Samsung, iPad EN/UR, wide EN) run on the DEV database only and clean up after themselves.
