# Account Setup + Universal Print/PDF — closure status (round 2)

Date: 2026-08-30. Continuation of the two-workstream closure.

**Still NOT "100% COMPLETE — REMAINING ISSUES: 0".** Honest matrix below.

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

## Commits (this round)

`0924be7` account setup · `d4171c2` wizard doc center · `befe065` closure doc ·
`b751ec4` print migration batch 1 · `e986279` print migration batch 2.
