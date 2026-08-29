# Master Profile Reports + Purchase/Sales Commercial Document Center — status

Date: 2026-08-30
Plan: `Master Profile Reports + Purchase/Sales Commercial Document Center` (3 phases).

## Consolidated matrix

| Item | State | Evidence |
|---|---|---|
| **A. Account Master Profile** | ✅ Done | `lib/reports/master-profiles/build-account-profile.ts`; `account-profile-view.tsx` **replaces raw `window.print()`**. Browser-verified on DEV: real record (India National Central Clearing Ledger), **dynamic India branding** (not Damaan), EN LTR + UR RTL, A4 portrait, "Page 1 of 1", KPI cards, Identity / Linked-Party / Location / Currency / Ledger / Audit sections, Related-Ledgers table. |
| **A. Company Master Profile** | ✅ Done | `build-company-profile.ts` + new `GET /api/erp/companies/[id]/profile` (company + bank relationships + related accounts, scope-enforced). New "Company Master Profile" action in `company-registry.tsx` (row menu + preview panel); the existing 360° dossier is kept alongside. |
| **A. Customer Master Profile** | ✅ Done | `build-customer-profile.ts`; `customer-profile.tsx` inline builder extracted to the shared builder (identity, KYC, contacts, location, relationship, KYC-documents table, linked accounts). |
| **A. Employee Master Profile** | ✅ Done | `build-employee-profile.ts`; `employee-form.tsx` inline builder extracted + **employee photo**, KYC identity, attendance & payroll-history tables, salary KPI cards. |
| **A. Dynamic generation (no hard-coded sample)** | ✅ Done | Every builder is `(record, branding, lang) ⇒ config` and emits only rows/sections with real data (`pushRow`/`section` drop empties). Verified: a bare account renders fewer cards, no `undefined`. |
| **B. Commercial Invoice** | ✅ Engine done; wired | `lib/reports/trade-documents/build-trade-document.ts`. Branding → doc no/date → seller → buyer → notify → delivery/terms → transport (international only) → goods table (HS/PCT, packing, qty, unit price, weight, amount) → financial summary (+ frozen-FX line) → beneficiary bank → notes → signatures. Amount-in-words. |
| **B. Packing List** | ✅ Engine done; wired | Same engine, `docType: "packing_list"` — goods table emphasises packages / gross+net weight / container; **no prices** (verified). |
| **B. Proforma Invoice** | ✅ Engine done; wired | Same engine, `docType: "proforma_invoice"` — quotation refs, validity, payment/bank details; shipping only if present. |
| **B. International + Local Purchase & Sales** | ✅ Done | `from-transaction.ts`: `purchaseOrderToTradeInput` / `salesOrderToTradeInput` / `localPurchaseToTradeInput`. **International vs Local is inferred** from the record (ports/BL/container/shipping-mode present ⇒ international; else local). Local documents render **no empty shipping sections** (verified). |
| **B. One transaction → many documents** | ✅ Done | The same source record feeds all three documents; no duplicate transaction is created. `trade-document-center.tsx` modal picks the type. |
| **B. Real transaction data / no invented FX** | ✅ Done | Parties, goods, currency, amounts read straight from the record. The exchange rate is the record's **frozen** `exchange_rate` — never recomputed. Verified against the real **DSA2025-0908** PO: USD 220,500 × 3.675 = **AED 810,337.50**. |
| **B. Missing fields not faked** | ✅ Done | Absent critical fields (buyer / seller / goods / total) are listed in a "these fields are blank" notice on the document — never placeholder text. |
| **C. Document actions** | ✅ Done | The shared `PdfPreviewModal` already provides Print · Save-as-PDF · Download HTML · Export CSV · **Email** (`mailto:`) · **WhatsApp** (`wa.me`) · orientation · paper size, all i18n. **New**: an in-preview **Language** dropdown (5 langs) + orientation now **rebuild the document from source** via `printStore` `rebuild()` (backwards compatible — other callers unaffected). Trade-doc type/language/orientation also selectable up-front in the Document Center. |
| **D. Dynamic branding** | ✅ Done | `lib/reports/resolve-document-branding.ts` wraps the existing `/api/erp/branding` resolver: `cityBranchId → countryBranchId → countryId → session country`, reading `country_company_profiles` (+ per-branch overlay). Beneficiary bank comes from `banking_information` on that profile (the `/api/erp/branding` select now returns it). **No hard-coded Damaan** — when a field is unconfigured it is omitted. Verified: India account prints "India" branding, not Damaan. |
| **E. AI integration** | ⚠️ Path complete, in-wizard button deferred | An AI-reviewed Purchase draft already becomes a real `purchase_orders` row (via `useIntakeDraft` consume in the wizard). That PO then feeds the **same** Document Center from the Purchase dashboard — no re-entry, the extracted goods/parties flow through, gaps show in the "missing fields" notice. A dedicated "Generate Documents" button on the wizard's post-save screen is **not yet wired** (the created PO in the dashboard is the current path). |
| **F. 5 languages / RTL** | ✅ Verified | i18n guard green — **10,451 keys × 5**, full parity, no silent English. 145 `pdoc.*` + 95 `tdoc.*` keys added in all 5 blocks. Master profiles: 178/0 across EN/UR/AR/FA/PS with per-language title + `dir` assertions. Trade docs: 430/0 across the same 5 languages. Browser: EN + UR (RTL) confirmed for the Account profile. **FA / PS / AR browser rendering: not separately screenshotted** (shared RTL code path; parity guaranteed by the guard). |
| **F. A4 / pagination / Print+PDF** | ✅ Verified | Both engines use `@page` A4 (portrait + landscape) with a real `counter(page)` "Page X of Y", repeating table `thead`, `break-inside: avoid` on rows/cards. Print + Save-as-PDF via the preview modal (proven in-browser for the Account profile). |
| **F. Permissions** | ✅ Done | Profile APIs use `requireErpSession` + `authorizeApiScope`; branding resolver is scope-enforced server-side (non-super-admins limited to their countries). Trade documents render client-side from data the user already sees; the branding/bank lookups are scoped. |
| **F. Desktop / Mobile / Tablet** | ⚠️ Partially verified | Account profile + Document Center verified at 461 px (mobile viewport) — responsive, no page-body horizontal scroll. iPhone / Samsung / iPad P / iPad L not individually tested. |

## Gate suite (this session, DEV)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | **exit 0** — ✓ Compiled successfully |
| `npx vitest run` | **124 passed / 1 skipped** |
| `node scripts/i18n-ui-guard.mjs` | **green** — 10,451 keys × 5, full parity |
| `scratch/master-profiles-verify.mts` | **178 / 0** (4 entities × 5 langs) |
| `scratch/trade-documents-verify.mts` | **430 / 0** (3 docs × 5 langs × 3 txn types) |
| `scratch/td-real-record.mts` (DSA2025-0908) | **105 / 0** (real record shape → AED 810,337.50) |
| `scratch/mc-regression.mts` | **79 / 79** |
| `scratch/di-master-doctypes.mts` | **11 / 11** |

## One centralized architecture

- **Master profiles** → the single existing engine `buildMasterProfileReportHtml`
  (`lib/reports/open-master-profile-report-window.ts`), extended (not forked) with
  optional logo/photo images and full-width related-table sections.
- **Commercial documents** → one new engine `buildTradeDocumentHtml` for all three
  document types.
- Both render into the **same** `printStore` → `PdfPreviewModal` (Print / PDF /
  Email / WhatsApp). No new print pipeline.
- Branding: one resolver, one API (`/api/erp/branding`), one cache.

## Remaining / not done

1. **In-wizard "Generate Documents" button (E)** — the AI→PO→document path works
   via the dashboard; a shortcut on the wizard's post-save screen is deferred
   (the wizard is a large file under concurrent edit).
2. **Legacy trade-print files** — `lib/reports/open-trade-document-window.ts`,
   `open-proforma-invoice-window.ts`, `components/reports/commercial-invoice-report.tsx`,
   `packing-list-report.tsx`, `shipping-invoice-report.tsx` still exist (hard-coded,
   English-only). The Purchase dashboard's proforma action now points at the new
   Document Center; the remaining call sites (`app/dashboard/print-reports`, the
   booking journal views) were left compiling and should be migrated in a cleanup
   pass.
3. **Browser matrix** — EN + UR verified for the Account profile; FA/PS/AR and the
   full device grid (iPhone/Samsung/iPad P/L) not individually screenshotted.
4. **Trade-doc click-through on DEV** — the management dashboards showed no live
   orders on DEV (demo fallback only), so the button→modal click path was not
   screenshotted end-to-end; the engine + mapper + real-record shape are verified
   offline (535 assertions) and the modal path is the same one proven for Phase 1.

## Commits

- `537f217` Phase 1 — Master Profile reports (Account/Company/Customer/Employee)
- `3f20980` Phase 2 — Commercial Document Center (Invoice / Packing List / Proforma)
- `774cffb` fix — trade-doc mapper handles real record shapes
