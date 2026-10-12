# Cash Journal — design pass (DESIGN ONLY)

Module: **Roznamcha → Daily Cash Entry** (`/dashboard/roznamcha/cash-entry`, component `CashEntryForm`). The attached "DGT Cash Journal" package was used as the *visual* reference only. Nothing from its JavaScript (calculations, rates, countries, branches, `localStorage` key `dgt-journal-v1`) was imported.

## What changed (presentation only)
| Area | Change |
|---|---|
| Toolbar | General Roznamcha Reports ▾ · **Filters (n)** · search · Print (stays visible) · ⋮ journal actions (Download PDF, Refresh) · **New Entry** |
| Heading | icon + "Cash Journal Entry (Receipt / Payment)" + scope subtitle; Back to Register |
| Cards | Branch Information (no overlap; stacks below 2xl) · **Amount & Payment (USD)** (new, see below) · Serial Numbers & Country Rates · Daily Cash Position |
| Journal table | same columns/rows/actions; **footer**: "Showing x to y of N entries", rows per page 10/25/50, Previous/Next |
| Filters dialog | Journal type (credit/debit), currency, branch code, reference — options come from the loaded, already-scoped rows |
| New Cash Entry dialog | same six steps and fields; green step badges and Post button, tighter width, all labels translated |
| Languages | ~190 new `cj.*` keys in all five languages (EN/UR/AR/FA/PS), RTL via logical CSS |

`Amount & Payment (USD)` = plain sums of the table's own **USD Credit / USD Debit** cells for the rows in view; lines without a recorded rate are counted and shown, never converted. Pure helpers: `features/roznamcha/lib/journal-view.ts` (unit-tested).

## What did NOT change
Formulas, DR/CR rules, exchange-rate lookup, balances, validations, posting payload, APIs, RBAC. Print / PDF / Excel use the same handlers and the same scoped data.

## Demo data removed from the existing screen
* hard-coded serial `SA-000003` (now the live serial preview already used by the other serial rows)
* fallback figure `165,375.00` shown as Final/Converted amount (now `0.00`), placeholder rate `3.6730`, amount placeholder `45,000.00`
* sample placeholders `05643616644`, `1321`, `INV-2026-001`, `TRF-00123`, the "Rex Trading LLC" remarks example, `213`
* fallback branch code `HQ-001`, fallback creator "Super Admin", fallback country "Assigned Country"

## Fixed on the way
* `TableTokenGuard` (app-wide) marked table cells before hydration finished → React hydration warning on phones/tablets in non-English languages. First scan now runs after load.

## Verification (DEV, Testing project `csesvyxxjivnkkozgopt` only)
* API data before vs after, 5 scopes (Super Admin, Country Admin PK, Branch PK, City Quetta, Shipping Line Admin Chaman): **identical** (`scripts/dev/cash-api-baseline.mjs` / `cash-api-diff.mjs`).
* Posting equivalence: the same entry posted through the OLD and NEW UI (Debit 100 USD, Credit 250 USD): **76/76 payload fields identical** and identical DR/CR lines in `roznamcha_lines` (`cash-post-capture.mjs` / `cash-post-diff.mjs`). Four tagged test entries (`design-equivalence-test …`) remain in DEV.
* Server scope (tables, totals, account selectors, export, tamper attempts with other countries' ids) for 7 roles: **all pass** (`cash-scope-check.mjs`). Shipping Line *user* has no Cash Journal permission (403) — existing RBAC, unchanged.
* Browser E2E (`cash-ui-e2e.mjs`): 21/21 incl. independent re-computation of the summary card, paging, search, filters, print preview, dialog, console clean.
* Unit tests `tests/roznamcha/journal-view.test.ts` (6), i18n guard green, tsc clean for touched files, `npm run build` exit 0.

## Not done / owner decisions
* The prototype's *browser-only* actions (Copy Previous, Auto Narration, **Clear All Entries**, base-currency/exchange-rate panels, `localStorage` entries) were **not** brought in: they would bypass posting/rate approval.
* Prototype table columns (Account / Cost Center / Narration / FC) were not adopted: the ERP's own columns are kept.
* The Roznamcha Number field has no default; "Roznamcha Category" must still be chosen explicitly (existing behaviour).
* Repo-wide `tsc` has 22 unrelated pre-existing errors in other modules.
