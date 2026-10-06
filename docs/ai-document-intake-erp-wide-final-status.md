# AI Document Intake — ERP-wide integration: final status matrix

Date: 2026-08-29
Scope: the 8-point "COMPLETE THE REMAINING AI + UNIVERSAL PRINT WORK" mandate.

## One centralized engine — no parallel AI

Everything below runs through the **existing** Document Intelligence pipeline:
`DocumentIntakeService` (createJob → processJob → updateField → selectMatch →
confirmDraft → consumeDraft) + `lib/document-intelligence/*` (extractors,
matching, draft-mapping). Module integration is via **adapters** only
(`MODULE_MAP`, `MASTER_DOCS`, `useIntakeDraft`). AI prepares a **reviewed draft**;
the real ERP form/wizard performs creation, validation, serials, accounting and
posting. AI never posts to accounting or stock.

## Consolidated matrix

| Capability | State | Evidence |
|---|---|---|
| **Company AI** | ✅ Done | `companies` adapter; `company-incorporation-form` consumes draft (prefill + link-existing + consume-after-save + banner); EntryMethodSelector on company-setup page. di-master 11/11. Browser: gate renders EN/UR RTL. |
| **Customer AI** | ✅ Done | `customers` adapter; `customer-form` consumes draft (name split, contacts, consume after POST/PATCH, banner); EntryMethodSelector on customers/setup. di-master (kyc→customers). |
| **Bank AI** | ✅ Done | `banks` adapter; `bank-form` consumes draft (merge into `form`, consume after `createBank`, banner); EntryMethodSelector on bank/new. |
| **Contract AI** | ✅ Done (routes to Purchase/Sales) | This ERP has **no standalone contract entity** — Contract Control Center is a read-only projection. `service_agreement` doc-type → `purchase_orders` (migration 20261010, live on prod). Contract fields prefill the purchase wizard. di-master: contract → draft DID-…, payload `{purchaseDate, supplierName, purchaseContractNo…}`. |
| **Purchase AI** | ✅ Done | `purchase-order-wizard` reads the draft prefill **and now calls the consume endpoint** after PO save / transfer (was reading but never linking). di-18 scenarios 18/18. |
| **Sales AI** | ✅ Adapter done; wizard prefill in place | `sales_orders` adapter present; sales wizard prefill path exists. Consume-after-save on the sales wizard: **not wired this session** (purchase side done as the reference). |
| **Expense AI** | ✅ Done | `expenses` adapter; `expenses-bill-entry-form` consumes draft (prefills bill date/ref + first line details/amount/currency/FX/tax, banner, consume after save); EntryMethodSelector on both expense-bill pages. Browser: gate + manual passthrough verified (UR RTL, mobile viewport). Migration 20261011 (`expense_invoice`→expenses). |
| **Employee / KYC AI** | ✅ Done (identity stays manual by design) | `employees` adapter; `employee-form` prefills **contract dates + salary only**; identity (name / father / national id) shown as a **hint** — person master is always picked/created via PersonPicker so **no duplicate person row**. `employee-management-view` auto-opens the create modal on an employee draft. `employee-kyc` page targetModule bug fixed (`kyc_document` code → `employees` module). Migration 20261011 (`employee_kyc`→employees). |
| **Accounting Preview (Purchase/Sales)** | ✅ Done | `PurchaseSalesIntakePreviewService.previewFromJob` + `/api/erp/document-intelligence/[id]/accounting-preview`. Shows Business \| Country \| Branch \| DR \| CR \| Original Ccy \| Original Amount \| Exchange Rate (+ source) \| Functional Ccy \| Final Amount \| DR Total \| CR Total \| Source Document. `canPost: false` always; requires amountPresent + balanced + rateConfirmed + accountsConfirmed. AI *suggests* DR/CR ledgers and the rate; user confirms. Verified: USD 100,000 × 280 = PKR 28,000,000, DR=CR, canPost false. acct-preview test green. Panel wired into `document-intake-center` ReviewPanel. |
| **Multi-Currency** | ✅ Uses the verified engine | Functional currency = `countries.currency_code`; rate resolution document → `get_daily_rate` → 1; `final = round(original × rate, 2)`; frozen historical rate preserved. **No second FX engine.** mc-regression **79/79**. |
| **Duplicate Protection** | ✅ Done | `runScopedMatching` master branch: searches companies / banks / customers, returns `status:"ambiguous"` with candidates — **never auto-links**; `status:"none"` ⇒ draft is for a NEW record. `selectMatch` records the chosen master. Accounting preview does a normalized contract-no duplicate check. Employee identity never auto-creates a person. |
| **Audit** | ✅ Done (where financial) | `consumeDraft` is idempotent per `(module, source_id)` and links the job → created source record (`status: linked`). di-18 #16 + di-master "consumeDraft idempotent" green. Forms call `intake.consume(createdId)` after save (non-fatal). |
| **5 Languages (EN/UR/PS/FA/AR)** | ⚠️ Partially verified | i18n guard green — **10 212 keys × 5**, full parity, no silent English. All new `dintake.*`, `ap_*`, `purpose_*`, `emp_*` keys present in all 5 blocks. **Browser-verified: EN + UR (RTL).** PS / FA / AR: **not individually browser-tested this session** — parity is guaranteed by the guard, visual RTL confirmed for UR (shared RTL path), but FA/PS/AR are marked *unverified in-browser* per the instruction not to claim by inference. |
| **RTL** | ✅ Verified (UR) | Intake Center, EntryMethodSelector (Company Setup + Expenses Bill) render full RTL in Urdu. Logical CSS throughout. AR/FA/PS share the same RTL code path (not separately screenshotted). |
| **Mobile / Tablet** | ⚠️ Partially verified | Intake Center + EntryMethodSelector verified at 461 px (mobile viewport) — responsive, no horizontal scroll. iPhone / Samsung / iPad Portrait / iPad Landscape: **not individually tested**. |
| **Universal Print / PDF** | ❌ Not addressed this session | Prior Universal Print migration work stands. **32 feature components still contain `window.print()` / `document.write(`** (audit list in this file's git history / `grep`). No new migration or real-A4 verification done in this pass. |
| **DEV** | ✅ | All migrations (20261009/10/11) applied to DEV. Full gate suite green on DEV (below). Browser smoke test on DEV compiled build. |
| **Production** | ✅ 20261009 + 20261010 live & verified; 20261011 pending push | Prod `erp_schema_migrations`: 20261009 (company_registration→companies, bank_account_document→banks, kyc_document→customers) and 20261010 (service_agreement→purchase_orders) **applied 2026-08-29 18:06 UTC**, verified via live query. 20261011 (employee_kyc, expense_invoice) is committed + registered — **auto-applies on next push** (additive `INSERT … WHERE NOT EXISTS`, same safe shape as 20261009). **20261008_cleanup_user_directory_master: BLOCKED — NOT applied. Prod profiles = 72, intact.** |
| **Security — committed prod DB credential** | ✅ Codemod applied; ⏳ rotation owner-gated | `scripts/lib/prod-db-url.mjs` env-only resolver + `scripts/remediate-db-credentials.mjs` codemod applied to **133 files** — 0 residual literals in tracked `.mjs`/`.ts`/`.md`, all touched `.mjs` pass `node --check`. `db-apply-all-migrations.mjs` (prod write path) was already env-only. **Live credential NOT rotated — owner approval required.** Git history still contains the secret (rotation is the real fix). Full plan + rotation/rollback procedure: `docs/security-remediation-db-credentials.md`. |

## Gate suite (re-run this session, DEV)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | **exit 0** — ✓ Compiled successfully in 3.3 min |
| `npx vitest run` | **124 passed / 1 skipped** (25 files) |
| `node scripts/i18n-ui-guard.mjs` | **green** — 10 212 keys × 5, full parity |
| `scratch/mc-regression.mts` | **79 / 79** |
| `scratch/di-18-scenarios.mts` | **18 / 18** |
| `scratch/di-master-doctypes.mts` | **11 / 11** |
| `scratch/acct-preview-test.mts` | green (USD→PKR, DR=CR, canPost false) |

## Remaining issues / not done this session

1. **Universal Print / PDF (mandate item 5)** — not started. 32 components still on
   legacy `window.print()` / `document.write(`. Needs per-report migration to
   `openUniversalPrintReport` + real A4 portrait/landscape / pagination / 5-lang /
   RTL output verification.
2. **Browser verification (mandate item 6)** — EN + UR verified. **FA, PS, AR not
   browser-tested.** Device matrix (iPhone / Samsung / iPad P / iPad L) not tested.
   Full draft→form→prefill→confirm→save→consume walkthrough not clicked end-to-end
   in the browser (proven by test harness instead).
3. **Sales wizard consume-after-save** — not wired (purchase side done as the
   pattern; sales adapter + prefill exist).
4. **Migration 20261011 to production** — committed + registered, not yet pushed
   upstream, so not yet auto-applied to prod. Additive/idempotent.
5. **Credential rotation** — prepared, **awaiting owner approval**. Git history
   rewrite (or accepted-risk sign-off) also outstanding.
6. **20261008_cleanup_user_directory_master** — remains BLOCKED by request. Guard
   in `db-apply-all-migrations.mjs` (`DESTRUCTIVE_MANUAL_ONLY` +
   `ALLOW_DESTRUCTIVE_MIGRATIONS`).

## Commits this session

- `4d7f11f` doc-intake: Employee/KYC + Expense adapters + document types
- `65e4f7e` doc-intake: wire Expense, Employee, Purchase forms to consume AI drafts
- `74f1463` security: remove hard-coded DB connection strings from scripts
