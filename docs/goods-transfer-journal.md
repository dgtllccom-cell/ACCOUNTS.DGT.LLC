# Goods Transfer Journal (Local Purchase → where the goods physically go)

Financial posting and physical goods movement are **two separate steps**.

1. **Local Purchase** (unchanged): confirm → accept → post. Posts the purchase and the selected payment condition to
   Roznamcha / Ledger (DR purchase/inventory, CR supplier-payable or cash/bank). A later supplier payment is posted by
   the existing Payment Journals against the payable ledger and never re-posts the purchase.
2. **Goods Transfer Journal** (`/dashboard/purchase/local-purchase/[id]/goods-transfer`): decides where the posted goods go.
   It never repeats or alters the purchase posting.

A full-screen **Lifecycle Report** (`/dashboard/purchase/local-purchase/[id]`, View / A4 Print / PDF) shows the whole story.

## One permanent identity

`purchase_lots` — one row per purchased line (purchase + line + goods + lot), created once when the purchase is posted
(or lazily for already-posted purchases). The quantity, goods and line of a lot can never change (DB trigger). Warehouse,
Local Sales and Export never recreate goods: they move the same lot. Each lot remembers the posted purchase ledger, the
payable ledger, the Roznamcha entry, original cost and landed cost (charges flagged "Add to landed cost", shared by net
weight — the same basis as the Voucher).

## Stock states

`lot_stock` holds the lot's quantity by state and place: `available`, `reserved`, `loading`, `in_transit`, `sold`,
`exported`. A deferred constraint trigger guarantees that the rows of a lot **always sum to the quantity purchased**, and
`qty >= 0` is a CHECK. `lot_movements` is append-only (UPDATE/DELETE raise).

Warehouse stock is mirrored into `product_inventory_balances` + `stock_movements` (the existing Inventory screens), and the
legacy sale-source lists subtract the lot-managed part so the same stock is never offered twice.

## Purposes

| Purpose | Effect | Accounting |
|---|---|---|
| Own Warehouse | available → warehouse / rack (rack→rack keeps total) | none |
| Another DGT Warehouse (same country) | available → In Transit → Received at destination | none |
| Third-Party Warehouse | available at a labelled third-party place (DGT-owned) | storage charge recorded, **not** auto-posted |
| Hold | decision recorded | none |
| Local Market Sale | opens the Local Sales wizard pre-filled; draft **reserves**; final posting **deducts once** | Sales Order posting (customer/sales) + human-confirmed cost of sales |
| Export to Customer | same wizard, export mode; reserved → loading → in transit → exported at final billing/dispatch | same + export requirements enforced |
| Export to Another DGT Country Branch | **Inter-Country Trade** (below) | source sale + cost; destination purchase on receipt |

## Cost of sales

Posted by an explicit, human-confirmed action ("Post cost of sales"): DR a chosen cost-of-sales ledger / CR the lot's own
purchase (inventory) ledger, at the lot's **posted** cost per unit × quantity — so the inventory account nets to zero. Once
only (unique entry per transfer). Ledgers are never auto-created.

## Inter-Country Trade

DGT keeps separate books per country, so a movement to another country is a trade, not a stock transfer. One
`inter_country_trades` row (`ICT-YYYY-NNNNNN`) links both sides:

* **Source country, at confirmation:** stock available → exported (once); an Export Sales Order (`<ref>-S`);
  DR inter-country receivable / CR export sales; DR cost of sales / CR inventory.
* **Destination country:** a linked Purchase (`<ref>`, status `in_transit`, nothing posted, no stock). On an **authorized
  receipt** it is posted (DR inventory / CR intercompany payable, amount converted **once** with the approved rate),
  becomes a normal posted purchase with its own lot (`source_lot_id` → original lot) and warehouse stock +qty.
* The destination purchase cannot be posted by hand through the old transfer path. One trade = one source sale + one
  destination purchase (unique indexes). Cancel before receipt reverses both source postings and returns the stock.

## Duplicate / double-click protection

Transfers carry an idempotency key (`unique(lot_id, key)`); every operation locks the lot row (`FOR UPDATE`) inside a
transaction; sales reservations are idempotent per (order, lot, place); final deduction finds no `confirmed` transfer on a
repeat; the UI also locks its submit button.

## Tests

`scripts/e2e-goods-transfer.mjs` (+ `-part2.mjs`) drive the real API and DEV database (refuses any other database):
purchase → posting → lots, own/DGT/third-party warehouse, rack move, partial and multiple transfers, over-quantity,
parallel identical and racing requests, cancel/return, local sale, export, cost of sales, inter-country send/receive/cancel,
multi-currency, country isolation, reconciliation and balanced entries.

## Known limits

* A **posted** sale cannot be returned from here (it needs the Sales credit-note workflow); draft sales, warehouse
  transfers, third-party custody and not-yet-received trades can be cancelled/returned with an audited reversal.
* A received inter-country trade is returned with a new trade in the opposite direction.
* Customs, BL and shipment-tracking documents stay in Shipping / Clearing; export orders expose Loading / In Transit
  stock states and the sale's own shipping fields.
* The third-party storage charge is recorded for the expense workflow, not auto-posted.
