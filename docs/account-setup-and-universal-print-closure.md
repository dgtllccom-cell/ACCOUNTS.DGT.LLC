# Account Setup + Universal Print/PDF — closure status (round 3)

Date: 2026-08-30. Continuation of the two-workstream closure.

**Still NOT "100% COMPLETE — REMAINING ISSUES: 0".** Honest matrix below.

---

## ROUND 3 ADDITIONS (this session)

### 1. HEADER_TRANSLATIONS gaps — CLOSED (commit `4acec44`)
`scratch/scan-header-gaps.mjs` sweeps every `openGenericErpReport` /
`openScopedGenericReport` call site in `features/ app/ components/` and cross-checks the
label/title strings against `lib/i18n/table-headers.ts`. **49 entries added** (2 batches);
final scan = **0 untranslated labels**. Each entry carries `ur` + `ar` + `fa` + `ps`.

### 2. Final legacy-print sweep (commit `4acd11f`)
| Path | Fix |
|---|---|
| `components/layout/erp-page-actions.tsx` — the **global** page Print / PDF-Download menu (every dashboard page) | printed the *whole dashboard* (sidebar + nav). Now renders only the page `<main>` into the shared `PdfPreviewModal` via `printDomFragmentViaModal`; raw `window.print()` only as fallback when no `<main>`. |
| `components/reports/journal-print-button.tsx` — `JournalPrintButton`, used by ~10 ledger / journal / roznamcha / HRM report screens | removed hard-coded `"DAMAAN GENERAL TRADING LLC"` companyInfo. Branding now resolves from the **logged-in country/branch scope** (`useErpScope` → `openScopedGenericReport` → `/api/erp/branding`). Super-admin with no locked country → neutral header (engine strips placeholders). |
| `app/dashboard/search/page.tsx` — record "Print" quick action | `document.write` popup → `printStore.openPrint` (RTL/dir-aware A4, escaped). |
| `components/ui/employee-certificate-print.ts` | `window.open` + `document.write` + auto-`window.print()` → `printStore.openPrint` (shared modal). |
| `components/reports/{commercial-invoice,packing-list,shipping-invoice}-report.tsx` | **deleted** — hard-coded Damaan, English-only, unreferenced (barrel-only). Superseded by `lib/reports/trade-documents/`. |

Remaining raw `window.print()` after this sweep = one of:
`printStore.openPrint` toolbar buttons inside self-contained builder HTML
(`erp-report-template-builder`, `open-roznamcha-voucher-print-report`,
`open-company-360-report-window`), `@media print`-isolated full-screen A4 preview
components (`professional-report-viewer`, `cash-receipt-viewer`, `loading-slip-viewer` —
each has `body * { visibility:hidden }` + `.print-area` + `@page`), or
`if (!printDomFragmentViaModal(...)) window.print()` fallbacks. Server PDF routes
(`access-register/pdf`, `handover-pdf`) are self-contained. `components/documents/print-button.tsx`
(BL documents page) and legacy `lib/reports/open-trade-document-window.ts` /
`open-proforma-invoice-window.ts` (still wired in `purchase-booking-journal-report-view`,
the wizards, `print-reports/page.tsx`, `purchase-order-management-dashboard`) are the
**known-remaining** trade-doc legacy paths — migrating them to `TradeDocumentCenter` +
adding a `contract` doc type to the new engine is the next bounded task.

### 3. Two real PdfPreviewModal bugs found + fixed by browser testing
| Commit | Bug | Fix |
|---|---|---|
| `b481147` | Report-builder HTML embeds `<script>…window.print()…</script>` (gated on `autoPrint`) for the legacy popup path. Rendered inside the modal iframe it fired an **immediate native print dialog on load**, bypassing the preview and freezing the renderer. Repro: Accounts → "Account Master Registry & Search Report" → PRINT hung. | modal sanitizes injected HTML — drops any `<script>` referencing `window.print()` / `__ERP_A4_AUTOPRINT__`. `open-a4-report-window.ts` drops the dead script outright. |
| `81d5720` | Wide registers ship `@page { size: A4 landscape }` but the modal always opened **portrait** → 20+ columns wrapped one character per line. | modal detects `@page … landscape` in the report HTML and defaults the preview to that orientation (toggle still works). **Browser-verified**: Purchase Booking Journal Report → Print (Loading Records, 23 columns) now opens landscape, table lays out horizontally at 1123 px sheet width. |

### 4. Browser verification this session (super_admin dev-session, `next start -p 3200` on fresh build)
| Path | EN | UR | FA | PS | AR | Notes |
|---|---|---|---|---|---|---|
| Generic ERP report (Reports → Actions → Print / PDF) | ✅ | ✅ RTL | ✅ RTL | ✅ RTL | — (same code path + dict) | headers all translated (سیریل/تاریخ/تفصیل/بنام/جمع/بیلنس/حیثیت …), title translated, `dir=rtl`, page counter localized, neutral "DIGITAL DOCK ERP" branding (not Damaan), landscape auto-detected |
| Account Register Report (Accounts → PRINT) | ✅ | — | — | — | — | opens cleanly post-fix (was frozen); A4, "Page 1 of 1" |
| Purchase Loading Records (23-col) | ✅ landscape | — | — | — | — | horizontal layout at 1123 px; readable at desktop width |
| Mobile 375×812 | ✅ | — | — | — | — | no horizontal page overflow; A4 sheet scales to fit; toolbar right-edge icons clip (minor) |

**Not yet browser-verified this session:** AR on any report (same code path as UR/FA/PS —
inferred, not screenshotted); the full device grid (iPad P/L, Samsung) on every screen;
the trade-document dashboard click-through with live orders; Account Setup on iPad/Android.

---

## A. ACCOUNT SETUP

Commit `0924be7`. Architecture-level, not cosmetic.

| Item | State | Evidence |
|---|---|---|
| Login Scope banner | ✅ | server-resolved `useErpScope()` → `LoginScopeBanner`. |
| Country / Branch scope lock + filter | ✅ | disabled + option list filtered when scope fixed. |
| Backend permission | ✅ (already enforced) | `authorizeApiScope` on `POST /api/erp/accounting/accounts`. |
| Direct-API block | ✅ **verified** | `scratch/account-scope-security.mts` **3/0** — PK country_admin → India = **403 FORBIDDEN**; PK branch user → India = 403. |
| Review data / no `Damaan <country>` / no silent auto-fill | ✅ | branchInfo falls back to session; branding-master company; missing-field names shown. |
| Account creation + DB save + list/ledger visibility | ✅ **verified** | `scratch/account-save-e2e.mts` **9/0** — 201 + ledger row + visible in accounts general report, filed under UAE. |
| Contact validation (Mobile/WhatsApp/Email) | ✅ | inline error + blocks save. |
| Double-submit guard | ✅ | `if (saving) return`. |
| **EN / UR / PS / FA / AR** | ✅ **all 5 browser-verified** | Account Setup opened as PK country_admin in each language: banner + country-locked ("Pakistan (PK)", disabled) + all step/field labels translated + `dir=rtl` for UR/PS/FA/AR. |
| Mobile / Desktop | ✅ mobile viewport (471 px); ⚠️ iPad/Android device grid not tested |
| Local / DEV | ✅ |
| **EPS / Production** | ⏳ **pending deploy** | Frontend + new hook only, no migration. Verify after commits deploy. |

---

## B. UNIVERSAL PRINT / PDF

### Central engines (built earlier — commits `537f217`, `3f20980`, `774cffb`, `d4171c2`)

| | Master Profile engine | Trade Document engine |
|---|---|---|
| Account / Company / Customer / Employee Master Profile | ✅ (Account browser-verified EN+UR) | — |
| Commercial Invoice / Packing List / Proforma | — | ✅ engine + wizards + dashboards |
| Real data / no invented FX / frozen rate | ✅ | ✅ verified vs real DSA2025-0908 → AED 810,337.50 |
| A4 P/L · PDF · pagination "Page X of Y" · 5-lang · RTL · dynamic branding | ✅ | ✅ (535 offline assertions total) |

### Legacy `window.print()` / `document.write()` migration (commits `b751ec4`, `e986279`)

**Before this session: 32 files / 46 sites. After: raw `window.print()` remains only as a
fallback (`if (!printDomFragmentViaModal(...)) window.print()`) or inside self-contained
generated receipt HTML.** New shared helpers:
- `lib/reports/open-scoped-report.ts` — dynamic branding + `openGenericErpReport`.
- `lib/reports/print-dom-fragment.ts` — renders an already-built A4 block into the shared
  `PdfPreviewModal` iframe (kills the `document.body.innerHTML = frag; print(); reload()`
  anti-pattern).

| Screen | Migrated to | Verified |
|---|---|---|
| HRM payroll-reports-view | scoped generic report | offline |
| Audit all-deleted-records | scoped landscape report | ✅ **browser** (modal opens, real data, branding, QR, filters, table, no `[object Object]`) |
| Audit all-edit-version-history | scoped landscape report | offline |
| Audit deleted-record-detail | Master Profile engine | offline |
| Journal journal-booking-stock-dashboard | scoped report | offline |
| Journal purchase/sales order payment journals | lazy row-menu print → opens detail (real JournalPrintButton) | offline |
| Roznamcha roznamcha-type-report-view | (already on `openUniversalPrintReport`; removed dead `document.write`) | — |
| Customers customer-list profile | Customer Master Profile engine | offline |
| Sales quotation-view | Proforma via trade-document engine | offline |
| Purchases local-purchase-view + local-purchase-journal-report-view vouchers | `printDomFragmentViaModal` (no more body-swap + reload) | offline |
| Purchases transfer-report v2 + Sales transfer-report | `printDomFragmentViaModal` on the A4 sheet | offline |
| Shipping bl-entry-view | scoped landscape report | offline |
| Locations location-registry (popup) + location-management-wizard | printStore / fragment | offline |
| Branches city-branch-registration-wizard | fragment | offline |
| Branch-management branch-general-report-view | fragment | offline |
| Clearing-agent customer-order-management-view (popup) + transit-entry-management | printStore / fragment | offline |
| Users user-registration-wizard employee certificate (popup) | printStore | offline |
| Messages email-management workspace | fragment | offline |
| Accounts account-setup-report + account-general-report-view (3 sites) | fragment / Master Profile engine | offline |
| Purchase + Sales wizards: internal A4 preview / "Print Document" / "Print Screen" / "Print Review" | `printDomFragmentViaModal` / `handleOpenA4Report` | offline |
| Purchases completed-purchase-bills-view | removed inline autoprint (already printStore) | — |

### Not migrated / left as-is (intentional)

- `account-profile-view.tsx` line 278 — `window.print()` is a fallback only (real path =
  Master Profile engine, browser-verified in Phase 1).
- Payment journals' `if (${autoPrint}) window.print()` — inside a generated receipt HTML
  string (self-contained, correct).
- `new-account-setup.tsx.bak` — a backup file, not shipped.

---

## Gate suite (this session, DEV)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run build` | **exit 0** — ✓ Compiled successfully |
| `npx vitest run` | **124 / 1 skip** |
| `node scripts/i18n-ui-guard.mjs` | **green — 10 459 × 5** |
| `scratch/account-scope-security.mts` | **3 / 0** |
| `scratch/account-save-e2e.mts` | **9 / 0** |
| `scratch/master-profiles-verify.mts` | **178 / 0** |
| `scratch/trade-documents-verify.mts` | **430 / 0** |
| `scratch/td-real-record.mts` | **105 / 0** |
| `scratch/mc-regression.mts` | **79 / 79** |

Browser-verified this session: Account Setup in **EN + UR + PS + FA + AR** (banner, scope
lock, RTL); one migrated report (Audit deleted-records) renders through the central engine
with real data.

---

## GENUINELY REMAINING

1. **Per-screen device-grid verification** (iPhone / Samsung / iPad Portrait / iPad
   Landscape) for every migrated print path — not done.
2. **Per-screen 5-language browser pass** for every migrated print path — only a
   representative sample verified; the rest rely on the engine's `translateHeader` + the
   guard.
3. **Trade-document click-through** from a management dashboard with live orders — DEV has
   no live purchase/sales orders surfacing there; engine + mapper + real-record shape are
   verified offline (535 assertions) but the dashboard button→modal path is not
   screenshotted.
4. **The wizards' internal A4 previews** use `printDomFragmentViaModal` (correct modal,
   real data) rather than a full rebuild in `openUniversalPrintReport` / the trade-doc
   engine.
5. **Some legacy `HEADER_TRANSLATIONS` gaps** — new column labels passed to
   `openGenericErpReport` that are not yet in `lib/i18n/table-headers.ts` will render
   English in non-EN languages until added (no automated guard covers that dict).
6. **EPS / Production deployment + full role/scope/save + print re-verification there** —
   not done. The commits must deploy first.

## Commits

Round 1–2: `0924be7` account setup · `d4171c2` wizard doc center · `befe065` closure doc ·
`b751ec4` print migration batch 1 · `e986279` print migration batch 2 · `d84c757` closure r2.

Round 3: `4acec44` HEADER_TRANSLATIONS gaps · `4acd11f` legacy-print sweep + journal-button
branding + dead trade-doc deletion · `b481147` strip embedded auto-print · `81d5720`
modal honours `@page` orientation.

## ROUND 4 ADDITIONS (this session, cont.)

### 5. Third modal bug fixed + verified (commit `1706d1c`)
`PdfPreviewModal` sized the sheet `width:297mm/210mm; maxWidth:100%` → on a phone it
**shrank the width** and the report reflowed, crushing wide tables to one character per
column. Now the sheet keeps its true paper width and is `transform: scale()`-d to fit the
preview area (fit-to-width, like a real PDF viewer); the outer box reserves the scaled
footprint so there's no dead space. Desktop unchanged (scale = 1). **Verified**: 23-col
landscape report on 360 px Samsung viewport shows the whole sheet, layout intact.

### 6. Legacy trade-document windows fully retired (commit `3e60d62`)
Added a **`contract`** document type to `lib/reports/trade-documents` (Sales Contract /
Purchase Contract heading by `txnKind`; proforma layout — prices, bank terms, validity,
dual signature). `TradeDocumentCenter` gained `initialDocType`. Every legacy call site
migrated to the unified engine:

| Was | Now |
|---|---|
| `purchase-order-management-dashboard` "Proforma Invoice" → `openProformaInvoiceWindow` | → `TradeDocumentCenter` (initialDocType proforma) |
| `purchase-order-wizard` "Print Contract" → `openTradeDocumentWindow("contract")` | → `TradeDocumentCenter` (initialDocType contract) |
| `purchase-booking-journal-report-view` 4 "Trade Documents" buttons → `openTradeDocumentWindow` | → `TradeDocumentCenter`; labels now i18n |
| `print-reports` hub Proforma + Trade Document → legacy windows (hard-coded "DAMAN BUSINESS GROUP") | → `openTradeDocument` via `resolveDocumentBranding` + `purchaseOrderToTradeInput` |
| `sales-order-wizard` dead `openTradeDocumentWindow` import | removed |

**Deleted** `lib/reports/open-trade-document-window.ts` + `open-proforma-invoice-window.ts`
(now unreferenced — hard-coded parties/bank, English-only, embedded `window.print()`).

### 7. Browser verification (super_admin dev-session, final build)
| Path | Result |
|---|---|
| Generic ERP report Print/PDF — **EN + UR + PS + FA + AR** | ✅ all 5: `dir=rtl` for the 4 RTL, headers translated (سیریل/تاریخ/تفصیل/بنام/جمع/بیلنس/حیثیت · شماره/تاریخ/توضیح/بدهکار/بستانکار/مانده/وضعیت · شمیره/نېټه/تشریح/ډیبیټ/کریډیټ/بیلانس/حالت · رقم تسلسلي/التاريخ/وصف/مدين/دائن/الرصيد/الحالة), title translated, page counter localized, **neutral "DIGITAL DOCK ERP"** branding (never Damaan), landscape auto-detected, no `[object`, no raw `en` |
| Device grid: iPhone 390 / Samsung 360 / iPad P 768 / iPad L 1024 / Desktop 1440 | ✅ no horizontal page overflow anywhere; modal scale-to-fit works on phone; full toolbar on iPad-L; desktop identical to pre-change |
| Account Setup — iPhone 390 + iPad P 768 | ✅ 2-col form, step stepper, scope banner, no overflow |
| **Trade Document click-through** — Purchase Booking Journal → select row → "Commercial Invoice" → `TradeDocumentCenter` → "Preview Document" | ✅ renders **COMMERCIAL INVOICE**, `CI-AE-001-0017`, real seller "Falcon Exports LLC", "PURCHASE · INTERNATIONAL", neutral branding, **missing-fields notice** ("Buyer, Goods lines" — nothing invented), no `[object` |
| `contract` doc type | ✅ offline 10/10 — Purchase/Sales Contract titles, bank + validity sections, RTL, Arabic "عقد شراء" |

## Gate suite — FINAL (this session, DEV)
| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run build` | **exit 0** |
| `npx vitest run` | **124 / 1 skip** |
| `node scripts/i18n-ui-guard.mjs` | **green — 10 462 × 5** |
| `scratch/trade-documents-verify.mts` | **430 / 0** |
| `scratch/master-profiles-verify.mts` | **178 / 0** |
| `scratch/td-real-record.mts` | **105 / 0** |
| `scratch/contract-doc-check.mts` | **10 / 0** |

## Deployment — ONE BLOCKER

**21 commits ready on local `main`, not pushed.** Only migration in range:
`20261011_doc_intake_employee_expense_types.sql` — additive, idempotent (`WHERE NOT EXISTS`),
2 rows into `document_type_registry`. The destructive `20261008_*` files are **not in any
commit** (working-tree only) — a push cannot carry them.

**Blocker:** `git push origin main` is refused by the Claude Code auto-mode command
classifier (harness-level protection on pushes). The owner must run the push, or add a
Bash permission rule. After the push: per `DEPLOYMENT_GUIDE.md` the VPS side is
`git pull origin main` → `npm run build` → `pm2 reload erp-app` on `72.60.209.121` (owner
SSH), and a Supabase backup before the migration applies. EPS re-verification of Account
Setup + Universal Print/PDF + Trade Documents then repeats there.
