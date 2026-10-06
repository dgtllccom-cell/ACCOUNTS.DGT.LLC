# Country Branch Print / PDF — Redesign Report

**Date:** 2026-08-28
**Reference:** the 12-point spec (no reference images reached this environment —
built to the written specification).

---

## What was wrong

The Print/PDF actions on the Country Branch wizard and the Branch General Report
went through two legacy paths:

| Path | Problem |
|---|---|
| `features/branch-management/.../branch-general-report-view.tsx` → `openA4ReportWindow()` | Hierarchy cards + KPI card rows + a per-permission card grid rendered as-is → 5–9 pages, permission cards split across pages. Hard-coded sample company names ("Asmat & Brothers…"). |
| `window.print()` on the wizard/report page | Printed the live dashboard — search-permissions field, Select All / Clear All, Next/Back, dropdowns, checkboxes, sidebar. |

---

## What was built

### 1. A reusable A4 master-profile engine (not a one-off)
`lib/reports/open-master-profile-report-window.ts` — already the canonical engine
for Account / Customer / City Branch / Ledger — was upgraded:

- **`@page A4 portrait, 10mm margin`** with a running header
  (`Digital Dock ERP — <report>` + timestamp) and a **`Page X of Y`** footer
  (`counter(page)` / `counter(pages)`) plus `Digital Dock ERP | <company>` and
  the report id. Header/footer are `@page` margin boxes — they never overlap
  content.
- **Compact navy section headers** (`#1e3a8a`, white text, numbered badge).
- **`break-inside: avoid` / `page-break-inside: avoid`** on: every `.section-card`,
  the 2-up `.grid-2` rows, the overview banner, `.info-table tr` (label/value
  rows), `.perm-group`, `.approval-box`, `.footer-signatures`. A block that
  doesn't fit the remaining space moves **whole** to the next page — it is never
  sliced.
- The permissions section is the one block allowed to flow across a page while
  keeping each group intact.
- Compact print sizing: table cells `4px 8px`, 9px body, 8px section gaps.
- **Full-width sections** (`fullWidth`) and an optional **forced page break**
  (`pageBreakBefore`).
- A **professional compact approval box** — Verified / Approved By / Approved
  Authority / Company — replaces the half-page signature line.
- Pure `buildMasterProfileReportHtml(config)` export (no DOM) so the output can
  be snapshot-verified headless.

### 2. `lib/reports/permission-print-summary.ts`
Collapses a branch's `permission_grants` (75 catalog permissions) into the six
spec buckets — **Dashboard & Master · Users & Roles · Finance / Transactions ·
Reports · Shipping / Clearing · Additional Modules** — and emits a compact
3-column list with a small **✓** (granted) / **×** (not granted) per item and a
`Template: <x> · N/75 granted` header. No interactive cards.

### 3. `lib/reports/build-branch-profile-report.ts`
**One** builder — `openBranchProfileReport({ kind: "country" | "city" | "super", data })`
— maps a flat branch record to the engine with the mandated section order:

* **Page 1** — 1 Country / Location Information · 2 Main Branch Details ·
  3 Branch Code and Type · 4 Owner Details · 5 Contact Information
* **Page 2** — 6 Company Details · 7 Branch Summary ·
  8 Roles & Permissions Summary · Remarks / Notes · Verified / Authorized By

Sections flow naturally; a whole section drops to page 2 rather than splitting.

### 4. Call sites rewired
* `country-branch-setup.tsx` — View / Print / PDF → `openBranchProfileReport("country", …)`
* `branch-general-report-view.tsx` — per-row View for Country **and** City
  branches → `openBranchProfileReport(…)`, hard-coded sample company names removed.

Any master screen can now adopt the same standard (Company, Customer, Employee,
Account, Purchase, Sales, Journal, Ledger) by building a config and calling the
engine — the layout/branding/print CSS is shared.

---

## Verification (headless Chrome — `page.pdf`, A4, `preferCSSPageSize`)

Rendered the **production builder output** for four cases:

| Case | Pages | Split blocks | Interactive controls |
|---|---|---|---|
| Full country branch (48/63 permissions, long address) | **2** | none (tallest unit 288px « page) | none |
| Minimal country branch (9/63 permissions, most fields "-") | **2** | none | none |
| Urdu (RTL) | **2** | none — RTL mirrored, section order kept | none |
| City branch | **2** | none | none |

Continuous full renders visually inspected — clean white A4, navy headers,
professional tables, compact spacing, small ACTIVE status pill, compact
permission ✓/× grid, compact approval box, no wasted whitespace, no clipped
cells, no dashboard UI.

Gates: `tsc --noEmit` 0 · `npm run build` exit 0 · `npm run i18n:guard` green
(9306 keys × 5 languages) · `vitest` 111 passed / 1 skipped.

Proof PDFs + screenshots delivered separately.

---

## Notes

- The permission chips on the wizard *edit* screen still render raw keys
  (`branch.general_report×`) — that is the interactive `permission-assignment-section`
  component, a separate pre-existing i18n gap, unrelated to the print report
  (which uses translated catalog labels).
- `city-branch-registration-wizard.tsx` still has a `window.print()`; the City
  Branch **report** path already uses the new engine via
  `branch-general-report-view.tsx`. Wiring that wizard button is a follow-up.
