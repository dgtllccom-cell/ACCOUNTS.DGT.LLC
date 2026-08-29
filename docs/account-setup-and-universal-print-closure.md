# Account Setup + Universal Print/PDF — closure status

Date: 2026-08-30. Two workstreams from the "FINAL COMBINED CLOSURE INSTRUCTION".

---

## A. ACCOUNT SETUP — session scope, login context, 5-language, creation

Architecture-level fix (commit `0924be7`), not a cosmetic patch.

| Item | State | Evidence |
|---|---|---|
| **Login Scope** (banner) | ✅ | `components/layout/login-scope-banner.tsx` — "Logged-in Scope: Country → Main Branch → City Branch → Role", from `useErpScope()` → `/api/erp/auth/session` (server-RBAC). Browser: PK country_admin shows *Pakistan → Country-wide → Country Admin*; super_admin shows *All Countries → All Branches → Super Admin*; Urdu RTL verified. |
| **Country Scope** | ✅ | Country `<select>` **disabled + option list filtered to the user's countries** when scope is fixed. Browser: PK country_admin → 1 option ("Pakistan (PK)"), `disabled=true`. Super admin → 6 options, enabled. |
| **Branch Scope** | ✅ | Branch options filtered to `countryBranchIds` / `cityBranchIds`; branch + branch-type locked for a city-branch user. `simulateCityAdmin` fake checkbox removed. |
| **Backend Permission** | ✅ (already enforced) | `POST /api/erp/accounting/accounts` calls `authorizeApiScope(session, {resource:"accounts", action:"create", countryId, countryBranchId, cityBranchId})` → `authorize()` throws `ErpPermissionError` on any out-of-scope id. |
| **Direct API Block** | ✅ Verified | `scratch/account-scope-security.mts` **3/3**: PK country_admin → India account = **403 FORBIDDEN "Country scope is not allowed"**; PK branch user → India = **403**; own-country create = *not* scope-rejected. |
| **Review Data** | ✅ | `branchInfo` now resolves from the session when the branch list is still loading / scope-filtered (no blank Company / Branch / Currency). Hard-coded `"Damaan <country>"` replaced with the branding-master company (`country_company_profiles`). |
| **Account Creation** | ✅ | Step-1 "Save & Next" no longer silently auto-fills Company / Trading Company / Sundry Debtors / `"b-main-001"`. `"incomplete — please review steps"` replaced with a message naming the exact missing fields. Double-submit guard on `saveEntry`. |
| **Database Save** | ✅ Verified | `scratch/account-save-e2e.mts` **9/0**: create → 201, `accountId` + `accountNumber` (`UAE-AC-0001`) + `ledgerId` (ledger row created), account visible in `/api/erp/accounting/reports/accounts/general`, filed under UAE. |
| **Account List / Ledger Visibility** | ✅ Verified | (same E2E) the new account appears in the accounts general report — the source of the Account List / Ledger view. |
| **Contact Validation** | ✅ | `contactErrorKey()` — Mobile/WhatsApp/Landline/Office = 7–15-digit E.164-ish; Email regex. Inline red error + blocks save. |
| **EN / UR / PS / FA / AR** | ✅ parity; ⚠️ browser EN+UR only | All new strings in the account `translations.ts` (5 langs) + 5 `scope.*` keys in `lib/i18n/ui.ts` (guard green 10 456×5). Raw English toasts ("Could not load countries", etc.) translated. Browser-verified EN + UR (RTL). FA/PS/AR not separately screenshotted. |
| **RTL / LTR** | ✅ | Banner + whole screen flip; chevrons rotate. Verified UR. |
| **Mobile / Desktop** | ⚠️ partial | Verified at 471 px (mobile viewport). iPad/Android device grid not tested. |
| **Local / DEV** | ✅ | All of the above on DEV. |
| **EPS / Production** | ⏳ pending deploy | Frontend + a new hook only — no migration. Verify after the commits deploy. |

**A remaining:** the account `translations.ts` is a parallel per-module dict (pre-existing tech-debt, not migrated to `lib/i18n/ui.ts`); FA/PS/AR + device-grid browser passes; production re-verification.

---

## B. UNIVERSAL PRINT / PDF

Two **centralized engines** built and wired (commits `537f217`, `3f20980`, `774cffb`, `d4171c2`).

| Document family | State | Notes |
|---|---|---|
| **Account Master Profile** | ✅ done + browser-verified | `lib/reports/master-profiles/`; replaces raw `window.print()` in `account-profile-view.tsx`. |
| **Company Master Profile** | ✅ done | new action + `/api/erp/companies/[id]/profile`. |
| **Customer Master Profile** | ✅ done | inline builder extracted. |
| **Employee Master Profile** | ✅ done | + photo / KYC / payroll summary. |
| **Commercial Invoice** | ✅ engine + wired | `lib/reports/trade-documents/`; Purchase & Sales management dashboards + both wizards' View menu. |
| **Packing List** | ✅ engine + wired | no prices; weight/packages emphasis. |
| **Proforma Invoice** | ✅ engine + wired | quotation refs, validity, bank. |
| **Purchase / Sales / Local Purchase docs** | ✅ mapper | `from-transaction.ts` — international vs local **inferred**; frozen FX read, never invented; verified vs real DSA2025-0908 (→ AED 810,337.50). |
| **Local Sales doc** | ⚠️ | `salesOrderToTradeInput` handles it; no dedicated `local_sales` table on DEV to click-through. |
| **Ledger / Journal / Roznamcha** | ⚠️ prior work only | ~10 views were migrated to `openUniversalPrintReport` in an earlier pass (memory `erp-master-verification-phase8`); **this session did not re-audit them**. `purchase-order-payment-journal.tsx`, `sales-order-payment-journal.tsx`, `roznamcha-type-report-view.tsx` still contain `window.print()` / `document.write()`. |
| **Stock / CRM / Audit / HRM / Shipping / Clearing / other reports** | ❌ not migrated this session | See the legacy-print list below. |

### Legacy `window.print()` / `document.write()` — still present (32 files, 46 sites)

Not migrated this session (a full per-file migration + A4 / 5-language / device
re-verification of each is a large separate effort):

`features/{shipping/bl-entry-view, branch-management/branch-general-report-view,
messages/email-management, users/user-registration-wizard,
locations/{location-registry, location-management-wizard},
audit/{deleted-record-detail-view, all-edit-version-history-view, all-deleted-records-view},
accounts/{account-profile-view (fallback only), account-setup-report, account-general-report-view},
clearing-agent/{customer-order-management-view, transit-entry-management},
branches/city-branch-registration-wizard, customers/customer-list,
journal/{sales-order-payment-journal, journal-booking-stock-dashboard, purchase-order-payment-journal},
hr-payroll/payroll-reports-view, sales/{quotation-view, sales-transfer-erp-report-view},
roznamcha/roznamcha-type-report-view,
purchases/{local-purchase-journal-report-view, purchase-transfer-erp-report-view-v2,
completed-purchase-bills-view, purchase-booking-journal-report-view, local-purchase-view,
purchase-loading-records-view}}`.

### Dynamic branding / A4 / PDF / 5-lang / RTL

| Requirement | Master Profiles | Trade Documents |
|---|---|---|
| Central engine | ✅ | ✅ |
| A4 portrait + landscape | ✅ | ✅ (in-preview toggle rebuilds) |
| PDF download | ✅ (preview modal) | ✅ |
| Pagination + "Page X of Y" | ✅ `counter(page)` | ✅ `counter(page)` |
| No blank pages / no dashboard chrome | ✅ | ✅ |
| Dynamic company/branch/logo branding | ✅ `resolve-document-branding` | ✅ (+ bank from `banking_information`) |
| Real data only / no invented FX | ✅ | ✅ |
| EN/UR/PS/FA/AR parity | ✅ guard | ✅ guard |
| RTL/LTR | ✅ (EN/UR browser) | ✅ (offline 5-lang; EN/UR path) |
| Mobile/tablet/desktop | ⚠️ mobile only | ⚠️ mobile only |
| Local/DEV | ✅ | ✅ (engine); ⚠️ click-through blocked by no live orders in the mgmt dashboards |
| EPS/Production | ⏳ pending deploy | ⏳ pending deploy |

---

## Gate suite (this session, DEV)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run build` | **exit 0** — ✓ Compiled successfully |
| `npx vitest run` | **124 / 1 skip** |
| `node scripts/i18n-ui-guard.mjs` | **green — 10 456 × 5** |
| `scratch/account-scope-security.mts` | **3 / 0** |
| `scratch/account-save-e2e.mts` | **9 / 0** |
| `scratch/master-profiles-verify.mts` | **178 / 0** |
| `scratch/trade-documents-verify.mts` | **430 / 0** |
| `scratch/td-real-record.mts` | **105 / 0** |
| `scratch/mc-regression.mts` | **79 / 79** |

## Honest status

**NOT "100% COMPLETE — REMAINING ISSUES: 0".**

Done & verified: Account Setup scope/security/save/5-lang (A); the Master-Profile
and Commercial-Document central engines and their wiring (B core).

Genuinely remaining: ~28 legacy `window.print()` / `document.write()` report
screens across Ledger/Journal/Roznamcha/Stock/CRM/Audit/HRM/Shipping/Clearing;
FA/PS/AR + full device-grid browser passes; the trade-doc click-through on a
dashboard with live orders; and the EPS/Production deploy + re-verification of
all of the above.
