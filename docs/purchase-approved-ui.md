# Purchase — the five approved pages (DEV only, NOT deployed)

Source: the owner's `DGT_Purchase_5_Approved_Developer_Pack` (five approved previews + UI-only starter code). Status: **implemented and tested on DEV (Testing DB `csesvyxxjivnkkozgopt`). Nothing was changed in Production.**

## What was done
| # | Menu name | Route | Real component (table kept as is) |
|---|---|---|---|
| 1 | Purchase Booking Details | `/dashboard/purchase/purchase-booking-journal-report` | `features/purchases/components/purchase-booking-journal-report-view.tsx` |
| 2 | Purchase Payments | `/dashboard/purchase/purchase-payments` | `features/journal/components/purchase-payment-journal-remaining-view.tsx` |
| 3 | Purchase Orders Payment | `/dashboard/purchase/purchase-order` | `features/purchases/components/purchase-order-management-dashboard.tsx` |
| 4 | Country Bill Payment | `/dashboard/purchase/completed-purchase-bills` | `features/purchases/components/completed-purchase-bills-view.tsx` |
| 5 | Purchase Loading Records | `/dashboard/purchase/purchase-loading-records` | `features/purchases/components/purchase-loading-records-view.tsx` |

**Not touched:** New Purchase Booking Order, Purchase Transit & Lane.

* Shared approved header (page title + breadcrumb, page toolbar, yellow / blue / green cards) — `components/purchase-ui/purchase-approved-header.tsx` + `purchase-approved.css`, ported from the approved previews (logical CSS for RTL, `.dark` theme, container-scaled figures).
* Per-page adapters turn the rows each page ALREADY loads into the three cards: `purchase-booking-approved-header.tsx`, `purchase-payments-approved-header.tsx` (pages 2, 3, 4), `purchase-loading-approved-header.tsx`.
* Table: **CSS-only skin** `components/purchase-ui/purchase-table-skin.css`, scoped by the class `dgt-purchase-table-skin` added to each page's existing table wrapper. No table JSX, column, label, row, handler, sort, filter, pagination, print/PDF/Excel/CSV code was changed (see the diff: only header regions and one wrapper `className` per page).
* i18n: the pack's dictionary was merged into the central `lib/i18n/ui.ts` as `pap.*` (76 keys × 5 languages); no parallel dictionary. `npm run i18n:guard` and `:guard:changed` pass.
* Toolbar = the page's EXISTING controls re-housed in the approved toolbar (page search · Filters panel with the existing selects · date range · refresh/reset · three-dot menu with the existing print/export handlers · New). No inert look-alike buttons; the global ERP search is untouched.

## Where each figure comes from (no mock data, no double conversion)
Money uses `lib/purchase-ui/money-unit.ts`: one currency → shown as is (no conversion); mixed currencies → USD **only** if an active daily rate exists for every currency used (single conversion); otherwise **"—"** (never a guessed number or a fabricated zero). Rates: new read-only `GET /api/erp/purchases/usd-rates` (`purchases:read`, latest active `daily_usd_rates` per currency, buying rate).

| Page | Card 1 (yellow) | Card 2 (blue) | Card 3 (green) |
|---|---|---|---|
| Booking Details | Σ booking amount; confirmed = transferred/posted/completed; pending = the rest | counts: Confirmed · Pending Review (accepted, not transferred) · Draft · Total (always add up) | per country: amount + bookings |
| Purchase Payments | Σ order total · paid (advance + remaining paid + credit) · remaining due | Invoice Payment (advance) · Remaining (due) · Credit · Paid | per country |
| Purchase Orders Payment | Σ order amount · payments · outstanding | Advance · Remaining payment · Credit · Final (paid on fully settled orders) | per country |
| Country Bill Payment | the completed bills in the register | Invoice · Remaining · Credit payments · Total paid | per country |
| Loading Records | booked / loaded / left quantity (the page's own contract quantities, unit bags) | records by stage: Loaded · In Transit · Delivered · Pending Load | per country: booked quantity + bookings |

Cards react to the page's existing country/branch/status filters, not to the free-text search; they use only RBAC-scoped rows the APIs already return (country admin sees only their country).

## Defects found while doing this (fixed)
1. **Country Bill Payment was always empty**: the page requested `/api/erp/purchases/orders?limit=1000` but the API rejects `limit > 500` (HTTP 422). Now `limit=500`. (If an organisation has > 500 orders this register needs server-side paging — noted, not changed.)
2. **Booking report's USD rates were always empty**: `booking-journal-report` selects `daily_usd_rates.exchange_rate`, a column that does not exist (the table has `buying_rate` / `selling_rate`). Not changed in that API (it would alter existing numbers); the approved header uses the new `usd-rates` route instead. Recommend fixing separately.
3. RTL: dates/codes in monospace table cells rendered as "Oct 2026 10"; the skin sets `unicode-bidi: plaintext` on those cells.

## Items that need an owner decision
* The remaining-view "Purchase Payments" page had no page-level print/export; the three-dot menu now calls the parent journal's existing `printPaymentJournal` / `exportRows` (CSV).
* Removed (display-only duplicates now covered by the approved cards): the old 5-/4-card summary blocks, the "Branch & User" session box, and on Loading Records the four count boxes. The collapsible "All Countries report details" with branch breakdown on Loading Records was kept (closed by default).
* "Final Payment" (Orders Payment) and "Pending Review" (Booking) are defined above; confirm the business meaning.

## Verification
`scripts/dev/purchase-ui-shots.mjs` (authenticated browser screenshots; DEV only) and `tests/purchase-ui/approved-header-metrics.test.ts` (7 tests). Results: see the final report in the PR / chat.
