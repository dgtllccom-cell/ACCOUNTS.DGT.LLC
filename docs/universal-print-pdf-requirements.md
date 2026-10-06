# Universal ERP Print / PDF Engine — Requirements

> Source: product owner directive (2026-08-27). This is the single, authoritative
> specification for printing and PDF/Excel/CSV export across the Digital Dock ERP.
> One reusable engine is used everywhere — individual pages MUST NOT keep their own
> ad-hoc `window.print()` / popup / PDF handlers.

## 0. Principle

- **One engine.** All Print / PDF / "Actions → Print" flows call the same
  `lib/reports/universal-print-engine.ts` (`openUniversalPrintReport`). No per-page
  print handlers, no per-page HTML-string builders, no duplicated CSS.
- The engine renders into a dedicated print container, **waits for API data, fonts,
  styles and the target report container to be fully rendered**, and only then calls
  the print / save action.
- All chrome (titles, column headings, labels, "No Records Found", "Page X of Y",
  "Printed by") renders through the central `lib/i18n` dictionary in the **active ERP
  language** with correct RTL/LTR — never hard-coded English, never the literal `en`.

## 1. Pages in scope (must be fixed and verified)

1. Purchase Order Tracking
2. Purchase Confirm → Booking Confirm
3. Sales Confirm → Sales Booking Confirm
4. Truck Loading & Clearing Booking
5. Bank Management
6. Ledger Statement
7. Super Admin Reports
8. Main Journal Report
9. User Journal Report
10. Country Journal Reports
11. Branch Journal Reports
12. Roznamcha Reports
13. Purchase and Sales Journal Reports
14. **Every other ERP page** with a Print, PDF, or Actions → Print control.

## 2. Defects the engine must eliminate

- Blank Print / PDF pages.
- Empty popup windows or frames.
- `[object Object]` rendered anywhere in output.
- Print buttons showing `en` (raw language code).
- Icon-only Print buttons with no permanent, translated **"Print"** text label.
- Missing current filters or table data in the output.
- Printing only the on-screen (paginated) rows instead of the complete filtered dataset.
- Incorrect or missing RTL / LTR direction.
- Tables clipped or hidden by `@media print`.
- Output that includes sidebar, top navigation, or action controls.

## 3. Timing / readiness contract

Before invoking `print()` / save-as-PDF the engine MUST have:

1. Fetched the **complete filtered dataset** (all pages, not the visible page) from the API.
2. Injected and applied all print styles.
3. Loaded all fonts used by the report (Latin + Arabic-script faces).
4. Fully mounted the report container in the DOM (all rows, totals, headers).
5. Resolved any async cell formatters (currency, dates, translated field values).

Only then: open the print window / trigger the browser print dialog.

## 4. Journal / Ledger / Roznamcha print — required content

Every Journal-style print (Journal, Ledger, Roznamcha, Purchase, Sales, Payment,
Loading, Receiving, Shipping, and every report with a Print/PDF action) must contain:

| Section | Fields |
|---|---|
| Header | ERP / company name, report title |
| Context | Country, branch, user details |
| Subject | Account or party details |
| Period | Active date range |
| FX | Currency and exchange rate (where applicable) |
| Opening | Opening balance |
| Per row | Serial number · Bill Number · Manual Bill Number · Transaction date · Description / narration / remarks · Debit · Credit · Running balance · Status |
| Totals | Total Debit · Total Credit · Closing balance |
| Footer | Printed-by user · print date/time · **Page X of Y** |

- All rows and totals **must match the on-screen report and the database**.
- Test datasets: **zero records, one record, two records, and multi-page**.
- "No Records Found" → a proper titled report page, never a blank page.

## 5. Access scope (must never leak)

| Role | May print |
|---|---|
| Super Admin | All permitted countries/branches, per the selected filters |
| Country Admin | Only its assigned country |
| Branch User | Only its assigned branch and permitted records |
| Shipping / Clearing Agent | Only its authorised shipping & clearing records |

Printing or exporting must **never** expose another country's / branch's / user's /
agent's data. Scope is enforced server-side on the dataset the engine prints — not by
hiding columns client-side.

## 6. A4 layout & pagination

- Professional **A4** layout.
- **Portrait and Landscape** both supported; **auto-Landscape for wide tables**.
- Table headings **repeat on every printed page**.
- Important rows / summary cards must not split across a page break incorrectly
  (`break-inside: avoid` on row groups and cards).
- The **complete filtered dataset** prints across as many pages as needed.
- Sidebar, navigation, and action controls are excluded from print.
- Print Preview and "Save as PDF" both produce the correct result.

## 7. Excel / CSV export

- Exported **rows, headings, totals, filters, and access scope** match the printed report exactly.
- Column headings are in the active ERP language.
- Business identifiers (invoice numbers, BL/container numbers, account codes, serial
  numbers, currency codes, legally-required names) are **not translated**.

## 8. Verification checklist (per page)

- [ ] Print button has a permanent translated label (not icon-only, not `en`).
- [ ] Output non-blank for 0 / 1 / 2 / N (multi-page) records.
- [ ] No `[object Object]`, no raw language code, no missing cells.
- [ ] Header block complete (company, title, country/branch/user, date range, FX).
- [ ] Opening balance, running balance, closing balance present and correct.
- [ ] Totals (Debit/Credit) match screen and DB.
- [ ] "Page X of Y" and "Printed by … / date-time" in footer.
- [ ] Headings repeat on page 2+.
- [ ] Correct orientation (auto-landscape for wide).
- [ ] RTL for ur/ar/fa/ps, LTR for en; whole layout follows.
- [ ] Scope: role sees only permitted data; cross-scope leak impossible.
- [ ] Excel + CSV match the printed report (rows, headings, totals, filters, scope).
- [ ] Works in Print Preview and Save as PDF.
