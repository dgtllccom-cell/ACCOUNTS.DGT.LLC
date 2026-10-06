# Digital Dock ERP — Master Design System

One professional visual standard across every module. **Reuse these components — never
rebuild a parallel UI system, never fork a second frontend architecture.**

## The standard sequence (every operational screen)

| Layer | Shared component | Notes |
|---|---|---|
| Sidebar | `components/layout/premium-sidebar-nav.tsx` (driven by `lib/navigation/sidebar.ts`) | one tree; every entry has `labelKey: UiKey` |
| Topbar | `components/layout/auth-top-controls.tsx` + `preferences-controls.tsx` | language / theme / calculator |
| Page header | **`components/layout/dashboard-page-header.tsx`** (`titleKey` / `titleFallback`) | title + breadcrumb + `erp-page-actions` slot |
| KPI cards | **`components/layout/stat-card.tsx`** / `features/reports/components/report-kpi-cards.tsx` | tabular-nums, semantic tone stripe |
| "Get to the point" | **`components/ui/smart-summary.tsx`** (`<SmartSummary>` + `smartDueSummaryToItems`) | real data only, never totals/guesses |
| Search / Filters | **`components/ui/smart-search-filter.tsx`** + `features/reports/components/report-filter-bar.tsx` | Date range (`erp-date-picker`), Country, Branch, State, City, module filter |
| Tables | **`components/ui/erp-data-table.tsx`** (+ `translated-th.tsx` for headers) | server-side pagination for large sets, `overflow-x-auto` container |
| Forms | `components/ui/{input,label,search-select,searchable-select,location-select,party-person-select,master-combo,erp-date-picker,contact-number-input}.tsx` | `master-combo` = reuse existing Customer/Account/Goods masters, always allow free text |
| Action menu | **`components/ui/unified-action-menu.tsx`** / `viewport-action-menu.tsx` | the "3-dots" row menu — View Details / Edit / Print / Delete |
| Detail drawer | **`components/ui/detail-drawer.tsx`** (`isOpen` / `onClose` / `title` / `subtitle`) | |
| Report / Print / PDF | **`lib/reports/open-generic-erp-report.ts`** (`openGenericErpReport`) or `openUniversalPrintReport` / `universal-report-shell` | ONE print engine. Location/Scope → Filters → KPI Summary → Data Table → Totals → Print/PDF. Screen totals == PDF totals. No sidebar/filters/buttons in A4 output. Portrait + landscape + RTL. |

## Mandatory per changed screen

- Desktop + Tablet + Mobile — no horizontal body scroll; wide content scrolls in its own container.
- EN / UR / PS / FA / AR through `useErpScreen()` — RTL/LTR flips the whole screen.
- Existing RBAC / country-branch scope / APIs / DB relationships / audit / workflows preserved.
- Real ERP data only — no fabricated / demo KPI values.
- `npx tsc --noEmit` = 0, `npm run build` = 0, all three guards green.

## Audit — adoption as of 2026-09-08

The shared layer is complete; adoption is uneven and is the remaining work:

| Primitive | Feature views using it |
|---|---|
| `useErpScreen` | 64 ✅ |
| `erp-date-picker` | 48 ✅ (prior migration) |
| `openGenericErpReport` / `openUniversalPrintReport` | 24 / 17 ✅ |
| `detail-drawer` | 11 |
| `dashboard-page-header` | 6 ⚠️ |
| `unified-action-menu` | 6 ⚠️ |
| `stat-card` | 2 ⚠️ |
| `erp-data-table` | 1 ⚠️ |
| `universal-report-shell` | 2 ⚠️ |

**Remaining #1 work:** convert the module views that still hand-roll a header / KPI cards /
table to `dashboard-page-header` + `stat-card`/`report-kpi-cards` + `erp-data-table`,
module by module, WITHOUT changing behaviour, re-verifying 5 languages + RTL + mobile per
converted screen. Order by traffic: Purchase, Sales, Ledger/Roznamcha, Customers,
Companies, Accounts, Goods, Logistics, HR, Reports.

## Done this session

- Extracted `master-combo.tsx` (features/consignment → **components/ui**) — shared party/goods picker.
- Added `smart-summary.tsx` — shared "get to the point" layer (#3), wired into Smart Operations.
- New modules (`temp-bills`, `smart-operations`) built on the shared primitives from the start.
