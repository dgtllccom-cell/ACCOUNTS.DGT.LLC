# General Warehouse Register + P/S Tracking — Implementation Contract (8 Nov 2026)

## Scope and decision
Implement the General Warehouse Register using ONLY the existing ERP's canonical warehouse, lot and journal tables/services. **No parallel inventory table, duplicate purchase bill, ledger or stock movement.** The present Loading and Payment conditions must remain unchanged. This document is a product/engineering contract, **not a claim of completed implementation or deployment**.

## Existing code — inspect before edits
- `features/purchases/components/purchase-loading-records-view.tsx`: loading booking.
- `features/consignment/components/loading-consignment-view.tsx`, `lib/consignment/loading-consignment-rules.ts`, `lib/consignment/loading-consignment-service.ts`: consignment loading queue. Current rules allow direct warehouse/re-export disposition; reconcile with the required confirm gate.
- `features/purchases/components/purchase-transit-lane-view.tsx`, `lib/services/purchase-lane-service.ts`, `lib/purchases/lane-rules.ts`: P/S General Transfer Journal / lane events.
- `features/journal/components/journal-booking-stock-dashboard.tsx`, `lib/services/stock-journal-service.ts`, `docs/stock-journal.md`: existing confirmed stock and payment/receiving gates.
- `lib/services/purchase-warehouse-stock.ts`: canonical warehouse stock posting; `product_inventory_balances` + `stock_movements`.
- `features/sales/components/sales-stock-panel.tsx`: existing Sales stock picker.
- `components/layout/digital-dock-premium-sidebar.tsx`: ONLY canonical sidebar.

## Business flow
1. Purchase Booking / Local Purchase booking establishes original bill, goods, currency/amount, lots.
2. Loading Booking saves an individual genuine loading record: one original bill can contain several trucks/containers, with distinct stable loading keys. It becomes visible automatically in Consignment and P/S General Transfer Journal; never generate extra stock.
3. Preserve established Advance/Remaining/Credit/payment rules; payment state and physical movement state are distinct. Do not silently convert outstanding credit to paid or bypass required payment proof.
4. Confirm Stock requires all current applicable payment, receiving, customs and verification gates, with partial quantities correctly supported; do not count unconfirmed loads as available physical stock.
5. Only confirmed, eligible quantity can be directed **either** to an actual Warehouse **or** directly to Re-Export staging when goods do not physically enter a warehouse. Warehouse transfers post via the canonical stock service exactly once. Re-Export staging reserves eligible quantity; actual export dispatch/completion generates the issue/outbound movement exactly once, not at mere selection.
6. Warehouse stock can be allocated to Sales Booking / Local Sales at lot/container/quantity granularity. Sales reservation reduces free-to-sell; physical stock decreases only on actual issue/delivery. Linking a sale to a purchase must never create another purchase stock row.
7. Journal always shows current location and current business status, plus immutable chronological events: Loaded, In Transit, Payment Pending, Received, Confirmed, Warehouse, Re-Export Reserved/Dispatched, Sale Reserved/Delivered, Completed. A single scalar status is insufficient; track payment, movement and stock availability independently.

## General Warehouse Register UI
- A compact table-first, responsive page under **Purchase, Sales & Trade > Stock > General Warehouse Register**, with **white/neutral plain sidebar text and icon, no red background or colored marker**. Do not show a dead menu link before its route/API/permissions exist.
- Server-scoped rows for Super Admin (all), Country Admin (own country), Branch Admin (own branch), Users (permission-assigned scope). Enforce at API/data layer, not merely UI.
- Cards: Confirmed Quantity, Physically Available, Reserved for Sales, Re-Export Pending, Sold/Issued, Re-Export Dispatched. Clearly label totals by unit (BAG vs CARTON etc); do not sum incompatible goods units.
- Primary columns: Original Purchase Bill, Source Type, Country, Branch, Goods, Brand, Size, Lot, Container/Loading No, Warehouse/Current Location, Confirmed Qty, Available Qty, Sales Reserved, Re-Export Reserved, Sold/Issued, Re-Export Dispatched, Gross/Net Weight, Purchase Currency & Amount, Exchange Rate, Final Currency & Amount, Last Movement.
- Expand bill to see **all trucks/containers**, receipt, payments, allocations, related Sales and Export document links, audit trail; for 5 containers keep 5 distinguishable identities, and allow partial sale per container.
- Show allocation and balance equations per physical source/lot; transfer and sale rows must reconcile and never exceed eligible quantity.
- Display a clear status chip on each row, with separate payment and physical movement indicators.
- Provide search, filters by country/branch/warehouse/goods/status, compact A4 Print/PDF, and 5 languages (English/Urdu/Arabic/Farsi/Pashto), RTL for Urdu/Arabic/Farsi/Pashto.

## P/S General Transfer Journal
This is the canonical **read-first tracking and movement history** for Purchase Booking, Local Purchase, Sales Booking and Local Sales. It must show source bill, country/branch, goods, size/brand/lot, loaded/confirmed/current available quantities, monetary totals in their respective currencies, payment state, live location, warehouse/export/sale movements, and complete drill-down. Physical transfers should use the authorized existing action/service, not silently create new stock from a report.

## Known defect to reproduce
Production screenshot of `/dashboard/purchase/purchase-transit-lane` displays `column lp.driver_phone does not exist`. Check live schema and query aliases first. `purchase_lane_loads.driver_phone` in code does NOT prove that `lp.driver_phone` exists on the specific queried table. Fix by using the correct source/column or explicit migration validated in DEV, without loss of existing data.

## Integrity acceptance tests
- Multiple trucks/containers under a single bill, duplicate save/retry idempotency, partially loaded and partially paid bills.
- Advance/Remaining/Credit and proof gates; no premature Confirm Stock; proper due balances.
- Confirm Stock → Warehouse; Confirm Stock → Re-Export; export reservation vs dispatch; Warehouse → Sale; partial sale, duplicate sale prevention; warehouse and export reversals.
- Quantities balance at bill, lot, container and warehouse levels. No negative quantity or double stock posting. Audited who/when/from/to for every movement.
- RBAC API denial and cross-country isolation; all five languages, RTL, desktop/iPad/mobile, A4 printing.
- Existing three live URLs agree: /dashboard/purchase/purchase-loading-records, /dashboard/purchase/purchase-transit-lane, /dashboard/consignment.

## Implementation and deployment gate
Develop on a feature branch, test with representative DEV data and existing migration/stock-integrity scripts, run typecheck/build, verify browser flows and role access. Backup prior to migration; deploy EPS/DEV and live-verify; only then deploy Production with rollback and live smoke tests. Never delete production stock/payment data. Report PR/commit, exact migrations, test evidence, EPS & Production revision and outstanding defects. Do not claim deployment before actual verification.
