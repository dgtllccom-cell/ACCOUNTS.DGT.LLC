# Main Menu — canonical hierarchy (2026-09-09 cleanup)

The rendered sidebar is **`DAMAN_SIDEBAR_ITEMS`** in
`components/layout/digital-dock-premium-sidebar.tsx` (mounted by
`components/layout/dashboard-frame.tsx`, desktop + mobile drawer).
`lib/navigation/sidebar.ts` / `premium-sidebar-nav.tsx` are **not rendered**.

`scripts/nav-duplicate-guard.mjs` (in `prebuild` + the pre-commit hook) now fails
the build if any leaf `href` or group `key` repeats.

## Rule applied

**One canonical main-menu entry per destination.** A genuinely different tab /
filter keeps its own entry because it has a distinct `href`
(`/dashboard/crm?tab=today` ≠ `/dashboard/crm?tab=cheques`). Only an **exact**
`href` match was treated as a duplicate. No page, route, record or feature was
deleted — only the repeated *menu links* were removed or pointed at a more
specific real route. Bookmarks to every page still work.

## Before → after

163 leaf links / 22 repeated destinations  →  **141 leaf links / 0 repeats**.

| Destination | Was in | Now the one home |
|---|---|---|
| `/dashboard/crm?tab=today` | User Tasks **+** CRM | **CRM Control Center** ("Today's Action Center") |
| `/dashboard/smart-due` | User Tasks **+** CRM | **CRM Control Center** ("Due & Follow-Up") |
| `/dashboard/document-intelligence` | Document Management ×2 **+** AI Voice & Document Entry | **AI Voice & Document Entry** ("Document Intelligence AI") |
| `/dashboard/ledger/new` | New Entry **+** Ledgers | **New Entry › Accounts & Ledger Setup** |
| `/dashboard/ledger/general-report` | Ledgers **+** Reports | **Ledgers** ("Ledger General Report") |
| `/dashboard/settings/locations` | New Entry **+** Master Data **+** Settings | **Settings** ("Locations & Cities") |
| `/dashboard/settings/bank` | Finance **+** Settings | **Finance** ("Banks & Bank Accounts") |
| `/dashboard/settings/warehouse` | Master Data **+** Settings | **Master Data** ("Warehouses Management") |
| `/dashboard/settings/tax` | Master Data **+** Settings | **Settings** ("Country Tax & Currency") |
| `/dashboard/roznamcha/money-exchange` | Daily Payment Entry **+** Finance | **Finance** ("Money Exchange") |
| `/dashboard/roznamcha/daily-expenses-bill` | Daily Payment Entry **+** Finance | **Daily Payment Entry** ("Daily Operational Expenses") |
| `/dashboard/roznamcha/expenses-bill` | Daily Payment Entry **+** Finance | **Daily Payment Entry** ("Office / Home Expenses Bill") |
| `/dashboard/reports/exchange-rate` | Finance **+** Reports | **Finance** ("Daily Exchange Rates (Intraday)") |
| `/dashboard/reports/payments` | Settlement & Reconciliation **+** Reports | **Reports** ("Payments & Settlements Report") |
| `/dashboard/tax-einvoicing/uae/vat-control` | Settlement & Reconciliation **+** UAE Tax | **UAE Tax & E-Invoicing** ("VAT Control & Reconciliation") |
| `/dashboard/consignment` | Purchase (Consignment Register) **+** Shipping & Clearing | **Purchase, Sales & Trade › Consignment Register** |
| `/dashboard/purchase/country-purchase-reports` | Other Country Trade ×2 (Reports + Timeline) | **Other Country Trade** ("Country Purchase Reports") |
| `/dashboard/general-office/employees` | New Entry ("Register Employee") **+** General Office **+** KYC Reports | **General Office** ("Employees Directory & Registration") |
| `/dashboard/general-office/employees?tab=share-forms` | New Entry **+** General Office | **General Office** ("Share External Forms") |
| `/dashboard/general-office/employee-kyc` | General Office **+** KYC Reports | **General Office** ("Employee KYC & Documents") |
| `/dashboard/shipping-line` ×3 ("Shipping Lines" / "Containers Register" / "Clearing Order Trucks") | Shipping & Clearing | **Shipping & Clearing** ("Shipping Lines"); "Clearing Order Trucks" → `/dashboard/clearing-agent/truck-registration`; "Containers Register" removed |
| `/dashboard/purchase/purchase-loading-records` ("Shipping Handovers" copy) | Shipping & Clearing | re-pointed to `/dashboard/shipping-line/handover-inbox` (the real handover page); "Purchase Loading Records" stays under **Purchase Booking** |

Also: section header typo **"Shipping & Cleaning" → "Shipping & Clearing"**;
Settlement section's two removed report-dups replaced with the real
`/dashboard/settlement/daily` + `/dashboard/settlement/payment` pages;
`Document Management` and `User Tasks` groups now hold exactly their own function.

## CRM — the one section

`CRM Control Center` is the single CRM home: CRM Dashboard · Today's Action Center ·
Due & Follow-Up · Cheques / Purchase-Payments / Sales-Recovery / Shipping-Clearing
Due (distinct `?tab=` filters) · Customer Follow-Up · New Customer Registration ·
CRM Reports. No CRM link remains in any other section.

## Not merged (deliberately kept separate)

Smart Operations (top-level) · AI Voice & Document Entry · Messages & WhatsApp ·
Customer Inquiries & Calls · KYC — these serve different purposes and keep their
own homes.
