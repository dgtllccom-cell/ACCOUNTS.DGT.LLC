# UAE Tax, VAT & e-Invoicing — Final Verification Report

**Date:** 2026-08-28
**Environment:** DEV / Test only — Supabase project `csesvyxxjivnkkozgopt` (`DEV_SUPABASE_REF`).
**Production (`inmayhrxucimxqhgseqi`) was NOT touched.**
**Auth:** authenticated end-to-end as Super Admin and as scoped `country_admin`
via the DEV-only passwordless bootstrap `POST /api/erp/auth/dev-session`
(returns 404 outside `APP_ENV=development` + demo auth). No password was
entered, logged, or committed.

---

## 1. Toolchain gates — ALL GREEN

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **PASS** — 0 errors |
| Production build | `npm run build` | **PASS** — `✓ Compiled successfully`, all 21 UAE tax routes emitted |
| i18n parity + integrity | `npm run i18n:guard` | **PASS** — 9265 keys × 5 languages, full parity, no missing refs, no silent English, **spread-clobber check OK** |
| i18n changed-file hardcoded scan | `npm run i18n:guard:changed` | **PASS** — no hard-coded English in changed files |
| Unit tests | `npx vitest run tests/uae-tax tests/i18n` | **PASS** — 56/56 (10 files) |

`tests/uae-tax`: `pint-ae-mapper` (7), `mock-asp` (6), `i18n-tax-einv-keys` (5, new).

---

## 2. Database migrations — 12/12 APPLIED to DEV

| Migration | Status |
|---|---|
| 20260901_uae_tax_einvoicing_foundation | applied |
| 20260902_uae_tax_ingestion | applied |
| 20260903_uae_tax_documents | applied |
| 20260904_uae_vat_return | applied |
| 20260905_uae_tax_ledger_reconciliation | applied |
| 20260906_uae_import_export_einvoicing | applied |
| 20260907_uae_tax_reports_audit | applied |
| 20260908_uae_tax_finalize_fixes | applied |
| 20260909_uae_tax_view_hardening | applied |
| 20260910_uae_tax_rules_dedupe | applied |
| 20260911_uae_tax_order_item_triggers | applied |
| **20260912_uae_tax_sync_fn_dedupe** (new — this session) | applied |

Re-running the runner is idempotent (`skip (already applied)` for all 12).

---

## 3. End-to-end functional test matrix

All exercised with real test transactions against the live DEV schema through
the authenticated HTTP API (and the browser for UI/i18n).

Tax entity: **Damaan Trading Company LLC**, TRN `100399999900003`, quarterly,
first period `2026-Q3`, base AED. City branch **Deira Dubai** mapped. 2
designated zones. 5 VAT control ledgers auto-bootstrapped on entity creation
(`UAE-VAT-INPUT-REC / INPUT-NREC / OUTPUT / REFUND / RCM`).

| # | Area | Test | Result |
|---|---|---|---|
| 1 | Tax entity / TRN / branch map | Create entity, map branch, list | **PASS** |
| 2 | Control ledger bootstrap | 5 ledgers created automatically on entity create; re-run returns `created:0` | **PASS** |
| 3 | Designated zones | Create + list 2 zones | **PASS** |
| 4 | VAT rules (versioned) | 7 seed rules, all `v1`, unique `(type,key,version)` — no dupes after `20260910` | **PASS** |
| 5 | **Daily expenses — multi-line** | Expense bill `EXP-UAE-E2E-001`, 5 lines, 3 `tax_on=true` → exactly **3** `uae_tax_lines` (AED 750 + 40 + 100 VAT); 2 non-taxable lines correctly ignored | **PASS** |
| 6 | Local purchase / Input VAT | `apply_tax` local purchase → 1 recoverable line, AED 1500 VAT, `review_status=auto` (AED currency) | **PASS** |
| 7 | **Booking Purchase — line-level "Is Tax"** | PO `PO-UAE-E2E-001`, 2 goods lines (Almonds 20000, Walnuts 30000) → 2 `booking_purchase` input lines, AED 1000 + 1500 VAT. Trigger **and** explicit post-insert sync both fire | **PASS** |
| 8 | **Booking Sales — line-level Output VAT** | SO `SO-00000001`, 2 goods lines (48000 + 32000 AED) → 2 `booking_sale` output lines, AED 2400 + 1600 VAT | **PASS** |
| 9 | Ingestion idempotency | `POST /uae-tax/sync` run 3×; `sync_uae_tax_all` run directly → line count stays **8**, no duplication (unique index `(source_module, source_id, coalesce(source_line_id, source_id))`) | **PASS** |
| 10 | Source traceability | Every line carries `source_module / source_id / source_line_id / source_reference_no`; `GET /uae-tax/trace/{lineId}` returns full entity→country→branch→source chain | **PASS** |
| 11 | Recoverability classification | `PATCH /uae-tax/lines/{id}` `recoverability` + `reviewStatus` (enum `auto\|confirmed\|needs_review\|excluded`) | **PASS** |
| 12 | **Documentation — upload once, link many** | One `office_documents` row attached to the expense bill → auto-linked to **all 3** taxable lines; `document_status` → `complete`; folder path resolved to the Tax-Period tree | **PASS** |
| 13 | Completeness control | `GET /uae-tax/completeness` → per-category expected / attached / missing / `vat_aed_without_evidence` (booking_purchase 2 expected / 0 attached / AED 2500 unevidenced) | **PASS** |
| 14 | **Import VAT enrichment** | Created `shipping_bl_records` BL linked to `PO-UAE-E2E-001` → sync reclassified the 2 PO lines to `transaction_category='import'`, attached BL + customs-declaration no; `import_vat_aed` KPI → AED 2500. Same source rows, reclassified (One Transaction = One Source Record) | **PASS** |
| 15 | Designated-zone treatment matrix | Rule `designated_zone / treatment_matrix v1` seeded; `uae_zone_treatment()` present; zone movement columns on `uae_tax_lines` | **PASS (engine)** — see §5 |
| 16 | VAT Return preview | `GET /uae-tax/vat-return/preview` → Box 1 output 80000 / VAT 4000; Box 9 input 97800 / recoverable VAT 4000; Box 12 net **0.00**. Pending-review expense VAT (AED 890) correctly **excluded** from Box 9 | **PASS** |
| 17 | VAT Return generate + file | `POST /uae-tax/vat-return` → returnId; `POST /uae-tax/vat-return/{id}/file` with FTA ref → period + return marked `filed` | **PASS** |
| 18 | VAT recovery | `GET /uae-tax/recovery` list; `uae_vat_recovery` table + lifecycle statuses present | **PASS (engine)** — no recovery rows raised yet in this dataset |
| 19 | Period VAT posting proposal | `POST /uae-tax/periods/{id}/posting` → `uae_vat_postings` row `status=proposed`, output 4000 / input 4000 / net 0, `roznamcha_entry_id` null | **PASS** |
| 20 | Ledger / Journal / Roznamcha reconciliation | `GET /uae-tax/reconciliation` → tax-line VAT vs control-ledger balance variance surfaced per role (expected: control ledgers 0 until a posting is actually posted — Phase 5 scope) | **PASS (by design)** — see §5 |
| 21 | e-Invoice draft build | `POST /uae-tax/e-invoices {action:build_drafts}` → 1 draft from `SO-00000001` (totals 80000 / 4000 / 84000) | **PASS** |
| 22 | e-Invoice validate | `POST /uae-tax/e-invoices/{id}/validate` → `valid:true` | **PASS** |
| 23 | e-Invoice submit (Mock ASP) | `POST …/submit {provider:mock}` → `submitted`, `aspReference: MOCK-…` | **PASS** |
| 24 | e-Invoice status refresh | `POST …/status` → `submitted → completed`; `GET …/status` (added this session) returns status + event history | **PASS** |
| 25 | e-Invoice dedup | Second `submit` → `"Already submitted — duplicate submission blocked"` | **PASS** |
| 26 | Credit note | `POST /uae-tax/credit-notes` (`originalEInvoiceId`, `totalExclVat`, `totalVat`) → credit-note id, linked to original, original untouched | **PASS** |
| 27 | Reports | `GET /uae-tax/reports` → per entity/period/direction/category aggregation (line_count, taxable_aed, vat_aed, recoverable_aed, missing_documents, needs_review) | **PASS** |
| 28 | Audit trail | `GET /uae-tax/audit` → append-only log; e-invoice status transitions captured with before/after state | **PASS** |
| 29 | Dashboard KPIs | Control Center: net VAT, tracked lines, missing docs, needs-review, and per-section (sales / purchases / expenses / import / export) — all figures tie to the tax lines | **PASS** |
| 30 | **Permissions — RBAC** | `uae_tax` / `uae_tax_filing` / `uae_tax_settings` registered in the role matrix + catalog; granted to country_admin (full), main/city branch admin + accountant (read+write), country_user / auditor_viewer / super_admin_reports (read) | **PASS** |
| 31 | **Permissions — country scope isolation** | UAE `country_admin`: full access, sees all 8 lines, can file. Pakistan `country_admin`: `GET /uae-tax` → 0 rows; dashboard / entity-create / zone-create / settings → **403** `"only accessible to users assigned to the United Arab Emirates"` (`assertUaeCountryAccess` on all 27 routes) | **PASS** |
| 32 | **5-language UI + RTL** | Control Center + VAT Return views verified in **EN, UR, AR** in-browser: full chrome + labels + table headers translate, `dir` flips to `rtl`, business data (TRN, amounts, `2026-Q3`, party names) correctly NOT translated. FA + PS resolve via the same dictionary path (unit-tested). | **PASS** |
| 33 | Print / PDF / Excel | Tax-line, VAT-return and reports views wire `UniversalPrintActionButton` → `openUniversalPrintReport` with translated column labels (`s.t(...)`, no literal `columns:[{label:"Date"}]`) | **PASS (wiring)** — full multi-language PDF render is infra-blocked, same as the standalone Print/PDF matrix |

---

## 4. Bugs found and fixed this session

1. **`...en` spread-clobber (i18n, ERP-wide).** Every `ur/ar/fa/ps` dictionary
   block carries a `...en,` back-fill spread that had drifted ~500 lines into
   each block. **Every translation defined above it — all 280 `tax_einv.*`
   keys plus `settlement.*`, `crm.*`, `nav.*` … ~1980 keys total — rendered
   English at runtime** while the source text (and the text-based i18n guard)
   looked correct. Fixed: moved `...en` to the top of each block; added a
   `SPREAD-CLOBBER` check to `i18n-ui-guard.mjs` that fails the build on any
   key defined above the spread. (`7a8c430`)
2. **Duplicate SQL function overloads.** `20260911`'s `CREATE OR REPLACE` with
   an added 3rd param created a *second* overload; a 2-arg call then matched
   both → `"function … is not unique"`, breaking `sync_uae_tax_all()` and the
   sync endpoint. Fixed by `20260912` (drop the 2-arg overloads). (`5c5b0ee`)
3. **Booking-order VAT not materialising.** The `purchase_order_items` /
   `sales_order_items` AFTER-write triggers did not reliably fire inside the
   creating transaction. Added an explicit
   `sync_uae_tax_from_(purchase|sales)_orders(orderId)` call right after the
   line insert in both routes (trigger retained as a backstop). (`d81c8f3`)
4. **No RBAC for the module.** `uae_tax*` resources existed in code but in no
   role — only a hard super-admin bypass worked. Added the full matrix +
   `assertUaeCountryAccess` so a non-UAE country_admin cannot reach or mutate
   UAE tax config despite holding the role template permission. (`aec03ad`)
5. **`e-invoices/{id}/status` had no GET** (405). Added. (`aec03ad`)
6. **i18n `--changed` false positives** on TS generic types and DB payload
   `name:` fields. Tightened the scanner. (`402115a`)

---

## 5. Items that genuinely need more than the ERP side

| Item | Status | What is needed |
|---|---|---|
| **Accredited ASP submission** | Mock ASP fully working (validate / submit / status / retry / dedup / credit note). `AspAdapter` contract + registry are the only integration seam. | A UAE Ministry-accredited ASP: one `AspAdapter` implementation + a `uae_asp_credentials` row. No schema or app change. |
| **Real PINT-AE clearance** | `mapToPintAe()` + `validatePintAe()` produce and check the `urn:peppol:pint:billing-1@ae-1` payload against configurable rules. | Accredited-ASP conformance testing against the live FTA pilot. |
| **Input/Output VAT inside the source Roznamcha entry** | Tax layer + control-ledger reconciliation complete; period posting produces a `proposed` `uae_vat_postings` row. Control-ledger balances stay 0 until a posting is actually posted. | Phase 5 (planned, not in this scope): add Input/Output VAT `lines[]` to the existing `expenses/transfer`, `local-purchase/transfer`, `purchases|sales/orders/[id]/transfer` payloads. |
| **Designated-zone / VAT-recovery lifecycle with live data** | Engines, tables, rules, API and UI are all in place and unit-covered. | Real free-zone movement transactions and recovery claims to exercise the full state machine end-to-end (no dedicated ERP source module feeds these automatically yet). |
| **Order-wizard "Is Tax" toggle** | API + schema + ingestion accept `is_taxable` / `vat_rate` per goods line (lines default to taxable). | A small UI change in `purchase-order-wizard` / `sales-order-wizard` to expose the per-line toggle (backend already honours it). |
| **Full multi-language PDF/Excel render matrix** | All report views wire the universal print engine with translated labels. | The same headless-render infrastructure blocker as the standalone Print/PDF verification effort. |

---

## 6. Deployment readiness

- **DEV/Test:** fully applied and verified.
- **Production:** **do NOT deploy yet.** Blocking items before a prod release:
  (a) the order-wizard per-line "Is Tax" toggle (#5 above),
  (b) Phase 5 source-Roznamcha VAT lines if per-entry ledger posting is required at go-live,
  (c) an accredited ASP for real e-invoice clearance.
  Nothing in the ERP-side engine, schema, API, permissions or i18n is a known blocker.

## 7. Commits this session

```
5c5b0ee  fix(uae-tax): drop duplicate 2-arg sync-function overloads (migration 20260912)
402115a  chore(i18n-guard): fewer false positives in the --changed hardcoded scan
74a49f2  test(uae-tax): runtime dictionary regression test for tax_einv 5-language keys
7a8c430  fix(i18n): move `...en` spread to top of every non-en block — un-clobber ~1980 translations
aec03ad  feat(uae-tax): RBAC wiring + UAE-country access guard + e-invoice status GET
d81c8f3  feat(uae-tax): explicit order-item VAT sync + dev-only passwordless session
01db564  feat(uae-tax): line-level Is-Tax for booking Purchase/Sales orders
```
