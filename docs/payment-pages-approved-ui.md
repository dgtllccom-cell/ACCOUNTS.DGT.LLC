# Ten Purchase & Sales payment pages — approved header (DEV)

Status: **implemented and verified on DEV only. NOT deployed. Production was not touched.** Database used for all tests: Testing project `csesvyxxjivnkkozgopt`.

## What changed
Presentation only. The ten existing Journal routes keep their tables, columns, order, row actions, filters, formulas, sorting, APIs and payment workflows. Only the page header (title, toolbar, three summary cards) and a CSS table skin changed.

| Module | Page | Existing route |
|---|---|---|
| Purchase Payments | Advance | `/dashboard/journal/purchase-order-payment/advance` |
| | Endorsement | `/dashboard/journal/purchase-order-payment/endorsement` |
| | Credit | `/dashboard/journal/purchase-order-payment/charges` |
| | Remaining | `/dashboard/journal/purchase-order-payment/remaining` |
| | Purchase Payment History | `/dashboard/journal/purchase-order-payment/history` |
| | Final | `/dashboard/journal/purchase-order-payment/final` |
| Sales Payments | Advance / Receipt | `/dashboard/journal/sales-order-payment/advance` |
| | Credit / Receipt | `/dashboard/journal/sales-order-payment/charges` |
| | Remaining / Recovery | `/dashboard/journal/sales-order-payment/remaining` |
| | Sales Payment History | `/dashboard/journal/sales-order-payment/history` |

Header: page title + breadcrumb; toolbar = page search, Filters (opens the page's existing filter panel), date range, Refresh, three-dot Actions (Print / PDF, Export Excel, Banking Balance — the pages' own handlers); three cards:
* **Yellow** — Total bills / Total paid (received) / Remaining (receivable), plain sums of the RBAC-scoped orders the page already loads.
* **Blue** — payment types with amount and count from REAL posted payment records; rows link to the existing routes (no new pages).
* **Green** — authorized countries (names only, no flags) with totals; click = the page's existing country filter.

Money rule (`lib/purchase-ui/money-unit.ts`): one currency shown as is; mixed → USD only when every currency has a rate (new read-only `GET /api/erp/purchases/usd-rates`, latest ACTIVE `daily_usd_rates`); otherwise "—". Never a fabricated zero, never a double conversion.

## Files
* `features/journal/components/payment-module-approved-header.tsx` (new) — header + adapters.
* `app/api/erp/sales/payments/route.ts` (new, read-only) — flat sales payment records, same scope rules as sales orders (403/empty outside scope), excludes the system `booking` entry.
* `features/journal/components/{purchase,sales}-order-payment-journal.tsx`, `purchase-payment-journal-remaining-view.tsx` — header swap + toolbar wiring; Remaining Excel now exports exactly the payment register shown.
* `lib/i18n/ui.ts` (pap.* keys, 5 languages), `lib/i18n/table-headers.ts` (Endorsement Payment).
* Tests: `tests/purchase-ui/payment-module-header.test.ts`; DEV scripts `scripts/dev/payment-pages-e2e.mjs`, `payment-rbac-check.mjs`, `payment-scope-diff.mjs`, `purchase-ui-shots.mjs`.

## Known notes (not changed — owner decision)
* Sales menu says "Remaining Payment / Recovery" (existing sidebar wording); the brief wrote "/ Receipt".
* "Endorsement" blue-card row = advance payments on bills whose payment condition is Endorsement; "Final" row = payments on fully settled bills. Please confirm the definitions.
* Header figures are based on the page's own loaded orders (first 200); payment amounts on the first 500 payment records.
* Remaining (purchase) Print / PDF still prints the purchase journal of orders; Excel exports the payment register on screen.
* The pages in the same components that are not among the ten (advance-completed, final-payments, sales final, credit) also get the new header.
* A soft-deleted city branch (Chaman City Branch, DEV) is not part of its country admin's expanded scope, while a session assigned to that city branch still reads its leftover test records — pre-existing route logic, not changed.
