# UAE Tax, VAT & e-Invoicing — Implementation Report

**Status:** Code-complete across all 7 phases. Committed on `main` in 8 commits
(`54144cc` → `bebb9b1`). **Not applied to a database; not verified in a browser**
(blockers in §8).

**Scope this cycle:** United Arab Emirates only. Pakistan / Afghanistan / India /
Other appear as placeholder country containers under *Tax Setup & Rules → All
Taxes*; their rules are not implemented (to be supplied separately).

---

## 1. Menu structure (`lib/navigation/sidebar.ts`)

```
TAX SETUP & RULES  (tax-setup-rules-group)
├── All Taxes                     /dashboard/tax-einvoicing        ← country containers + link to Tax Setup & Rates
├── United Arab Emirates          (container)
│   ├── UAE Tax Dashboard         /dashboard/tax-einvoicing/uae/dashboard
│   ├── VAT Control Center        …/uae/vat-control
│   ├── Purchase / Input VAT      …/uae/purchase-input-vat
│   ├── Sales / Output VAT        …/uae/sales-output-vat
│   ├── Daily Expenses VAT        …/uae/daily-expenses-vat
│   ├── Local Purchase Tax        …/uae/local-purchase-tax
│   ├── Local Sales Tax           …/uae/local-sales-tax
│   ├── Booking Purchase Tax      …/uae/booking-purchase-tax
│   ├── Booking Sales Tax         …/uae/booking-sales-tax
│   ├── Import VAT                …/uae/import-vat
│   ├── Export / Re-Export        …/uae/export-reexport
│   ├── Free Zone / Designated    …/uae/free-zone
│   ├── VAT Recovery / Refund     …/uae/vat-recovery
│   ├── e-Invoices                …/uae/e-invoices
│   ├── Credit Notes              …/uae/credit-notes
│   ├── VAT Return Preparation    …/uae/vat-return
│   ├── Tax Documentation         …/uae/tax-documentation
│   ├── ASP / FTA Status          …/uae/asp-fta-status
│   ├── Tax Reports               …/uae/tax-reports
│   ├── Audit & Error Logs        …/uae/audit-logs
│   └── UAE Tax Settings          …/uae/settings
├── Pakistan / Afghanistan / India / Other Countries   → /dashboard/tax-einvoicing/coming-soon
```

Visibility is gated by `roles` per node (same pattern as the settlement/CRM
groups). Filing / recovery / ASP / settings pages are restricted to
`super_admin` / `country_admin` / `accountant`. `components/layout/sidebar-icon.tsx`
`iconMap` was completed (also fixes previously-blank settlement/CRM icons).

---

## 2. Database — 8 migrations, `supabase/migrations/2026090{1..8}_*.sql`

**Design rule:** this layer never copies accounting data. Every taxable line
*references* an existing ERP transaction (mirrors the settlement layer). The
source bill and its Ledger/Journal/Roznamcha posting are never touched.

| # | File | Adds |
|---|---|---|
| 1 | `20260901_uae_tax_einvoicing_foundation` | `uae_tax_entities` (TRN, filing calendar), `uae_tax_entity_branches` (branch→entity roll-up), `uae_tax_rules` (versioned FTA/MoF config + effective dates), `uae_designated_zones`, `uae_tax_periods`, `uae_tax_ledgers`, **`uae_tax_lines`** (the core — unique on `(source_module, source_id, coalesce(source_line_id,source_id))` ⇒ a line can never be VAT-reported twice). `uae_resolve_tax_entity()`, `get_uae_tax_dashboard_kpis()`. Seed of baseline UAE rules. |
| 2 | `20260902_uae_tax_ingestion` | Line-level tax columns on `purchase_order_items`; new `sales_order_items` table. `sync_uae_tax_from_expenses / _local_purchase / _purchase_orders / _sales_orders` + `sync_uae_tax_all`. `uae_ensure_tax_period()` (auto period by date + entity frequency), `uae_default_recoverability()` (reads `uae_tax_rules`). **Row-level triggers** on `expenses_bill_lines` (per `tax_on`) and `local_purchases` (per `apply_tax`) → tax lines appear automatically. One-time backfill. |
| 3 | `20260903_uae_tax_documents` | `uae_tax_line_documents` (link table). `uae_attach_tax_evidence()` — **upload once, link to every taxable line of the bill**. `office_documents` auto-link trigger + Tax-Period folder path builder (`UAE / Entity / Year / Period / Category`). `uae_tax_period_completeness_v` (expected / attached / missing / needs-review). |
| 4 | `20260904_uae_vat_return` | `uae_vat_returns` (FTA VAT 201 boxes 1–12), `uae_vat_return_lines` (line→box), `uae_vat_recovery`. `uae_vat_box_for_line()`, `uae_vat_return_preview()` (live), `uae_generate_vat_return()` (materialise + stamp lines + advance period). Back-reference FKs. |
| 5 | `20260905_uae_tax_ledger_reconciliation` | `uae_tax_bootstrap_ledgers()` — creates the 5 VAT control ledgers per entity (Input Recoverable / Input Non-Recoverable / Output Payable / Reverse Charge / Refund Receivable). `uae_vat_postings` (period summary posting proposals). `uae_tax_reconciliation_v` (tax-line VAT vs ledger balance + variance). |
| 6 | `20260906_uae_import_export_einvoicing` | Import/customs/BL/zone columns on `uae_tax_lines`. `uae_zone_treatment()` matrix (seeded from Cabinet Decision 59: DZ↔foreign = out-of-scope, mainland↔DZ = standard/import, etc.). `sync_uae_tax_from_import()`. **`uae_e_invoices`** + `uae_e_invoice_events` (append-only) + `uae_asp_credentials` (server-only, holds a `secret_ref`, never the secret). e-invoice status-log trigger. `uae_build_einvoice_drafts()`. |
| 7 | `20260907_uae_tax_reports_audit` | `uae_tax_audit_log` (append-only) + change triggers on tax lines / returns / e-invoices. **`uae_tax_trace_v`** — the full "where did this VAT come from" drill-down (line → source → roznamcha → documents → period → return → recovery → e-invoice). `uae_tax_report_summary_v`. |
| 8 | `20260908_uae_tax_finalize_fixes` | Audit trigger reads scope via `to_jsonb(NEW)` so the shared function works on tables without a `country_id`. `sync_uae_tax_all` also runs import enrichment. |

RLS on every table via `is_super_admin()` / `can_access_country()`; append-only
tables are INSERT-only. Runners: `scripts/db-apply-uae-tax.mjs` (dedicated) and
`scripts/db-apply-all-migrations.mjs` (registered).

**Validation:** all 8 migrations were run together inside a transaction against
the **live production schema** and then **rolled back** (nothing persisted). The
full pipeline was then exercised with a synthetic UAE entity — 5 control ledgers
created, period auto-created, VAT 201 preview + generate, audit trigger fires,
`sync_uae_tax_all` returns 5 sources, e-invoice status-log fires — all green.

---

## 3. Backend

- **`lib/services/uae-tax-service.ts`** — `UaeTaxService` (singleton). Entities +
  branch map, rules, designated zones (CRUD), periods, tax-line list (filtered),
  line classification, dashboard KPIs, `syncFromErp` (calls `sync_uae_tax_all`),
  documentation (`attachEvidence`, `getCompleteness`), VAT return
  (`vatReturnPreview`, `generateVatReturn`, `listVatReturns`, `fileVatReturn`),
  recovery (`listRecovery`, `upsertRecovery`), ledgers (`bootstrapLedgers`,
  `getReconciliation`, `proposePeriodPosting`), e-invoices (list / events /
  build drafts / get / update / **createCreditNote**), reports (`reportSummary`,
  `traceLine`, `listAudit`, `listLineDocuments`).
  Every scoped method repeats the country filter in its `WHERE` (`withLocalPg`
  bypasses RLS — the settlement service's gap is not inherited).
- **`lib/services/asp/`** — `AspAdapter` contract (`validate` / `submit` /
  `getStatus` / `cancel`), a `registry` (add an accredited provider by
  registering a factory — no other code change), and `MockAspAdapter` that drives
  the whole pipeline deterministically (buyer TRN ending `REJECT` → rejected,
  `ERROR` → throws → `retry_required`, else submitted→processing→completed).
- **`lib/services/einvoice/pint-ae-mapper.ts`** — ERP invoice → PINT-AE JSON
  (`urn:peppol:pint:billing-1@ae-1`), grouped tax subtotals, doc-type codes
  (388 / 381 / 380 / 389), + `validatePintAe()` structural checks (mandatory
  fields, seller TRN, ≥1 line, gross = net + VAT).
- **`lib/services/uae-einvoice-service.ts`** — orchestration: builds the payload
  from the e-invoice + its tax lines, validates via the adapter, submits, records
  ASP reference/response, **blocks re-submission of a locked status** (dedup),
  maps ASP exceptions to `retry_required` with `retry_count++`.
- **`app/api/erp/uae-tax/**`** — 26 route files. All: `export const dynamic`,
  `guardUaeTax("read"|"write"|"file"|"settings")` (→ `authorizeApiScope` with
  `uae_tax` / `uae_tax_filing` / `uae_tax_settings`), zod bodies,
  `apiOk`/`apiCreated`/`apiError`/`handleApiError`.

---

## 4. UI — 21 real UAE screens (`features/uae-tax/components/`)

| Screen | What it does |
|---|---|
| **Control Center** | Entity/period/date filters, Net VAT headline + tracked / missing-docs / needs-review strip, Sales / Purchases / Expenses / Import / Export KPI sections, "Sync from ERP". |
| **9 VAT category lists** (Purchase Input, Sales Output, Daily Expenses, Local Purchase/Sales, Booking Purchase/Sales, Import, Export, Free Zone) + VAT Control | One reusable `UaeTaxLinesView` — AED taxable/VAT/recoverable totals, search + dates, **row → the original bill** (deep link, never a copy), classify drawer (recoverability / tax category / review status), Print / PDF / Excel. |
| **Tax Documentation** | Completeness per entity/period/category — expected vs attached vs missing, "Attach" deep-links to the source, link to the Documents hub tax folder tree. |
| **VAT Return Preparation** | Live VAT 201 box preview from `uae_tax_lines`, evidence/review warnings, Generate/Refresh, list of generated returns, Mark Filed (with FTA reference), Print. |
| **VAT Recovery / Refund** | Recovery register with the full lifecycle status (recoverable → claimed → carry-forward → refund requested/received/rejected/adjusted), inline status change, add item. |
| **e-Invoices / Credit Notes / ASP-FTA Status** | One `UaeEInvoiceView` in 3 modes — list + Validate / Submit / Refresh-Status per row, status-timeline drawer + PINT-AE payload inspector, "Build Drafts from Sales". Credit notes: negative amounts, linked to the original, never overwrite. |
| **Tax Reports** | Per period/category/direction summary + **ledger reconciliation** (lines VAT vs control-ledger balance + variance), Print / PDF / Excel. |
| **Audit & Error Logs** | Append-only log with before→after field diff, filter by object type. |
| **UAE Tax Settings** | Tax Entities (create/edit: TRN, filing calendar, base currency, contact block, **city-branch mapping chips**), Designated Zones (list + inline add), VAT Rates (→ the shared Tax Setup & Rates screen). Creating an entity auto-provisions its 5 VAT control ledgers. |

All screens use `useErpScreen` (RTL-aware, EN / UR / PS / FA / AR). **280
`tax_einv.*` keys × 5 languages** (`npm run i18n:guard` green, 9265 keys/block).
Print/PDF/Excel goes through `openUniversalPrintReport` via
`UniversalPrintActionButton`.

---

## 5. Multi-line bill tax integration (the critical requirement)

- The line-level flag that already exists — **`expenses_bill_lines.tax_on`** — is
  used as-is. `sync_uae_tax_from_expenses` reads only lines where `tax_on = true`;
  a 20-line bill with 8 taxable lines produces exactly 8 `uae_tax_lines` rows,
  each carrying `source_id` = the bill and `source_line_id` = the line. The full
  20-line bill still posts to accounting unchanged.
- Local Purchase uses its header-level `apply_tax` / `tax_percentage` /
  `tax_amount`; taxable = `final_cost − tax_amount`.
- Purchase/Sales orders: migration 2 adds `is_taxable` + `tax_code_id` +
  `vat_rate` + `taxable_amount` + `vat_amount` to `purchase_order_items` and the
  new `sales_order_items` table. The sync reads those. **The order wizards do not
  yet write the per-line flag** — when they do, booking-purchase/sales lines flow
  in automatically with no further work. (This is the one place the entry UI
  still needs a small change; the schema + ingestion + reporting are done.)
- The unique index guarantees no duplicate VAT reporting on re-sync.

---

## 6. Source-invoice linking (the other critical requirement)

`uae_attach_tax_evidence(office_document_id, source_module, source_id)` links one
`office_documents` row to **every** taxable line of that bill, sets each line's
`document_status`, and stamps the document with
`module_type='Tax & e-Invoicing'`, a tax `document_type`, and the Tax-Period
folder path. An `AFTER INSERT` trigger on `office_documents` does this
automatically when a document is attached to a bill that has UAE tax lines. One
supplier invoice with 20 lines / 8 taxable = **one upload**, linked to the 8
lines, filed once.

---

## 7. Verification performed

| Check | Result |
|---|---|
| 8 migrations, run together + rolled back vs live schema | ✅ 17 tables, 6 views, 27 functions/triggers create cleanly |
| Full pipeline with synthetic entity (ledgers, period, return, audit, sync, e-invoice events) | ✅ all green, rolled back |
| `npx tsc --noEmit` | ✅ 0 errors in the module |
| `npm run i18n:guard` / `:guard:changed` | ✅ green (parity, no new hard-coded English) |
| `npm run build` | ✅ exit 0 — all 22 new routes compiled |
| Unit tests `tests/uae-tax/` (PINT-AE mapper + validation, Mock ASP submit/reject/retry/dedup) | ✅ 13/13 |
| Full i18n suite | ✅ 37/37 (unbroken) |

---

## 8. NOT done — needs your action

1. **Migrations are not applied to any database.** `DATABASE_URL` in this repo
   points at what looks like production. Run
   `node scripts/db-apply-uae-tax.mjs` against the correct DB when ready
   (idempotent — safe to re-run).
2. **No browser / authenticated verification.** Blocked by the dev server's
   corrupted `.next` build + missing Supabase env + no Super Admin session (same
   blockers as the standalone Print/PDF verification report). Once a working
   authenticated tab exists, the end-to-end test matrix (§40 of the spec) can be
   run: enter a UAE tax entity + TRN + branch map; a 20-line expense bill with 8
   taxable lines → sync → 8 tax lines, source-bill drill-down; attach one
   supplier invoice → 8 lines linked + filed; VAT 201 preview reconciles to the
   sum of lines; mock-ASP e-invoice submit/reject/retry/dedup; credit note;
   Super Admin vs Country vs Branch scope isolation; all 5 languages + RTL.
3. **Order-wizard "Is Tax" toggle.** `purchase-order-wizard.jsx` /
   `sales-order-wizard.jsx` need a small change to write `is_taxable` + `vat_rate`
   per goods line (the schema and ingestion are ready).
4. **Real ASP provider.** The adapter contract + mock are done; a Ministry-
   accredited provider is a drop-in `AspAdapter` implementation + a
   `uae_asp_credentials` row.
5. **Own-goods / stock transfer ingestion.** The category exists and a line can
   be reclassified to it manually; there is no dedicated ERP source module to
   ingest from automatically.
6. **Do not deploy** until 1–2 are complete.

---

## 9. Commit list

```
bebb9b1  fix(uae-tax): audit trigger works for tables without country_id; import in sync_all
2d8985f  feat(uae-tax): finalize — auto-bootstrap ledgers, DZ CRUD, import sync, period posting
9dc9b11  feat(uae-tax): Phases 3-7 — documentation, VAT return, e-Invoicing, reports, audit
35a708d  feat(uae-tax): Phases 3-7 database migrations
e1f05b7  feat(uae-tax): Phase 2 ingestion — wire category pages, VAT line list, i18n
4d37223  feat(uae-tax): Phase 1 Control Center + Tax Settings screens
9aae196  feat(uae-tax): Phase 1 scaffold — menu, page shells, service, API routes
54144cc  (Phase 1 migration + runner; committed under a DeployBot message)
```

Note: the concurrent auto-committer ("DeployBot") swept several of these files
into commits under its own messages — content is intact, history is linear, no
force-push or amend was done.
