# AI Document Intake, Verification & Workflow Automation — Status

Self-hosted document intake inside ACCOUNTS.DGT.LLC / Digital Dock ERP.
**Not Production Ready** — real-document UAT, authenticated scope testing,
local browser verification and explicit production approval are still required
(see *Outstanding* below).

---

## Architecture (all self-hosted, no external AI/OCR API)

| Layer | Implementation |
|---|---|
| PDF text layer | `pdf-parse@2` (`PDFParse`) — digital PDFs, no OCR |
| OCR | `tesseract.js@5` WASM (`eng+ara` default, `DOC_INTAKE_OCR_LANGS`), vendored `vendor/ocr/` via `npm run ocr:vendor` |
| Image pre-process | `sharp` — auto-rotate (EXIF), grayscale, normalise, sharpen, upscale small scans |
| Scanned PDF | `pdf-parse` `getScreenshot` per page → sharp → tesseract |
| Provider adapter | `lib/document-intelligence/providers/` — `local` (default + complete), `external-stub` (throws unless `DOC_INTAKE_PROVIDER=external` **and** `DOC_INTAKE_EXTERNAL_APPROVED=1`) |
| Storage | `storage/document-intake/<yyyy>/<mm>/<jobId>.<ext>`, mode `0600`, path-traversal-safe. No public URL — served only through the authenticated `/[id]/file` route (`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`). |
| File safety | MIME + magic-signature match, size limit (`DOC_INTAKE_MAX_BYTES`, 25 MB), page limit (60), malware scan (`/Launch`, `/EmbeddedFile`, `MZ`/`ELF`; strict mode also `/JavaScript`, `/OpenAction`) |
| DB | our PostgreSQL, `withLocalPg` (RLS bypassed → every query repeats the scope in WHERE) |

## Isolation (spec §3–§5, §14)

- Two operational domains — `business` | `shipping` — never mixed. A shipping-scoped
  login is pinned to `shipping` + its own `clearing_agent_id`.
- **Composite scoped identity** (`buildCompositeIdentity`) — domain, company, country,
  main branch, city branch, clearing agent, shipping customer, source module,
  source id, PO/SO id, contract ref, document ref, container/BL ref. Dubai
  `CON-1001` ≠ Pakistan `CON-1001`.
- `jobScopeWhere` / `assertRowInScope` on every read and mutation.
- Matching (`matching.ts`) **never uses contract number alone** — a lone
  contract/order signal is capped at score 0.55; auto-link needs ≥ 0.80 and a
  clear margin over the runner-up. No in-scope candidate → `out_of_scope` with the
  exact message *"No authorized matching record was found in your country/branch
  scope."* and the job routes to QVC.

## Accounting / stock safety (spec §17)

The AI writes **only** to `document_intake_*` tables. It never posts to
`journal_entries` / `roznamcha_entries` / ledgers / `tax_*` / `settlement_*` /
stock. `confirmDraft` produces one row in `document_intake_drafts` — a reviewed,
normalized pre-fill payload. The target module's own authorized new-entry flow
consumes it (`consumeDraft`, idempotent per `(module, source_id)`) and the human
completes creation there, which runs all serials / validation / approval / audit
/ posting.

---

## Phases

### Phase 1 — Foundation ✅ `a7ef609`
Migration `20260925_document_intelligence_foundation` — `document_type_registry`
(39 seeded types), `document_intake_jobs`, `_fields`, `_line_items`, `_matches`,
`_events`, `document_intake_queue_v`. Provider adapter, shared types, heuristic
extractors (30+ field rules, line-item rows, keyword classifier), local provider.
Applied to DEV, idempotent.

### Phase 2 — Pipeline, storage, scope, matching ✅ `6917746` / `2445d2d`
`document-intake-service.ts` — `createJob` (validate → malware scan → idempotency
→ sha256 dup detection → composite identity → store), `processJob` (OCR →
classify → extract → scoped match → route to `review` / `qvc`), `updateField`,
`selectMatch`, `sendToQvc` (feeds `crm_action_items`), `cancelJob`.
`storage.ts`, `scope.ts`, `matching.ts`. API routes under
`app/api/erp/document-intelligence/`.

### Phase 3 — Central Intake Center UI ✅ `d101462` / `6cbf1cb`
`/dashboard/document-intelligence` + sidebar group. `document-intake-center.tsx`
— queue + KPI cards + filters; `UploadDrawer` (domain, contract/BL/container
hints, auto-process, privacy note); `ReviewPanel` — **original document and
extracted form side by side** (`<img>` / `<iframe>` on the private file route),
per-field colour (green ≥ 0.8 / amber ≥ 0.55 / red), confidence %, page number,
OCR-read value, Verify; match candidates (Select only if in scope); line-item
table; audit trail. `dintake.*` i18n — all five languages.

### Phase 4 — Confirm reviewed draft ✅ `242d49c`
Migration `20260926_document_intake_drafts` — `document_intake_drafts` + `_v`.
`confirmDraft` (blocks on unresolved red fields; `new_record` vs
`append_existing`; supersedes a prior draft), `listDrafts` / `getDraft` (scoped),
`discardDraft`, `consumeDraft` (idempotent, flips job → `linked`).
`draft-mapping.ts` maps verified fields → target-module payload keys for
`purchase_orders`, `sales_orders`, `shipping_bl_records`,
`clearing_agent_custom_entries`, `purchase_loading_records`. "Prepare Reviewed
Draft" button + draft-ready banner in `ReviewPanel`.

### Phase 5 — Entry Method Selector ✅ (this commit)
`entry-method-selector.tsx` — reusable **"Select Entry Method"** gate: *Manual
Entry* (renders the form unchanged), *Scan / Upload Document* (opens the Intake
Center), *Continue Saved Draft* (lists in-scope prepared drafts for the module;
picking one stashes it in `sessionStorage.di_draft_prefill`), *Cancel*.
Wired into **New Purchase Booking** (`app/dashboard/purchase/new-purchase-booking-order`)
as the reference integration; `purchase-order-wizard.jsx` reads the stash on
mount and best-effort pre-fills (`k in prev` guard — unknown keys ignored,
nothing breaks), shows a "Pre-filled from reviewed document draft" banner.
Manual entry is always available; both paths converge on the same wizard →
validation → approval → DB → audit flow.

**Remaining Phase-5 wire-ups** (same 3-line wrapper pattern):
New Sales Booking, Purchase Loading, Shipping / BL Entry, Clearing Document
Entry, Contract Control, KYC / QVC, Cash / Bank Roznamcha.

### Phase 6 — Partial Container Purchase Workflow ✅ (this commit)
Migration `20260927_purchase_loading_batches` — `purchase_loading_batches`
(LOAD-01, LOAD-02 … per purchase order), nullable `loading_batch_id` /
`loading_batch_no` on `purchase_loading_records` (existing rows untouched), and
`purchase_loading_progress_v` (Planned / Loaded / Remaining containers + a
`planned` / `partially_loaded` / `fully_loaded` status per purchase order).
`purchase-loading-batch-service.ts` — `proposeBatchFromJob` (only from an
in-scope intake job **matched to a purchase order**; extracts container numbers;
**excludes containers already loaded or already in a live batch** → no
duplicates; auto-numbers `LOAD-0N`), `confirmBatch`, `cancelBatch` (blocked once
loading records are linked), `progressForOrder`, `listBatches`.
API `app/api/erp/purchases/loading-batches` (GET list / `?view=progress`, POST
propose, PATCH confirm|cancel) — `authorizeApiScope("purchases", …)`, scope
re-checked in the service. Intake `ReviewPanel` gains a "Propose Loading Batch"
button + result banner when the job is matched to a purchase order.

**Never** creates a loading record, payment, container master or a second
purchase booking — the existing Purchase Loading form still creates the loading
records (pre-filled from the batch); the batch only groups and tracks.
E2E `scratch/di-batch-e2e.mts`: propose `LOAD-01` (2 containers) → re-propose
rejected (dedup) → progress view → confirm → job events
`loading_batch_proposed → loading_batch_confirmed`.

**Remaining Phase-6 work:** the Purchase Loading form reading `?batchId` /
`di_draft_prefill` to pre-fill the container list and stamp `loading_batch_id`
on the records it creates; a Planned/Loaded/Remaining panel on the loading page.

### Phase 7 — Controlled Business → Shipping handover ✅ (this commit)
Migration `20260928_business_shipping_handovers` — `business_shipping_handovers`
(action_type `create_shipping_request` / `send_to_shipping_line` /
`assign_clearing_agent` / `approve_shipping_handover`; business source + agent +
scope + containers + **whitelisted `shared_payload`**; `submitted → accepted /
rejected / cancelled`) + restricted `business_shipping_handover_shared_v` (no
`business_source_id`, no amounts). Unique index → one live handover per
`(business record, action, agent)`.
`business-shipping-handover-service.ts` — `create` (validates the business
record + scope; a shipping-scoped user **cannot originate**; `shared_payload`
built from a hard whitelist — supplier/customer identity, ports, vessel,
incoterms, cargo/weights — **never** order total, unit price, advance/paid,
profit, currency amounts, accounts or ledgers), `approve` / `reject` (shipping
side), `cancel` (business side; blocked once accepted), `listForBusiness` (full
row, own scope), `listForAgent` (restricted view, own `clearing_agent_id` only).
API `app/api/erp/handovers` (GET business|agent, POST create) + `[id]`
(PATCH approve | reject | cancel), authz split: `purchases:write` to originate /
cancel, `shipping_records:write` to accept / reject.
E2E `scratch/di-handover-e2e.mts`: create → shared_payload money-leak check
**clean** → agent restricted view has no `business_source_id` → duplicate
rejected → agent accepts → business cancel-after-accept rejected.

**Remaining Phase-7 work:** "Create Shipping Request / Assign Clearing Agent"
buttons on the Purchase/Sales screens + intake ReviewPanel; an inbox page for
the shipping side; auto-creating a `clearing_customer_order` on accept.

### Phase 8 — Cash / Bank Roznamcha intake ✅ (this commit)
Migration `20260929_document_intake_roznamcha` — routes the finance document
types (`cash_receipt`, `bank_transfer_advice`, `cheque_image`,
`payment_confirmation`, `sales_receipt`, `advance_receipt`) to
`target_module = 'roznamcha_entries'` and sharpens their classifier keywords for
Cash / Bank Transfer / Cheque detection. `extractors.ts` gains `payment_method`,
`cheque_number`, `cheque_status`, `bank_name`, `value_date` field rules + a
wider amount pattern.
`roznamcha-intake-preview-service.ts` — `previewFromJob` builds the spec §15
**pre-post preview** without posting: payment method + cheque status,
super-admin / country / branch / entry serial *schemes* (numbers allocate only
at post time), bill / manual bill number, debit & credit account hints, original
currency, exchange rate, final & base amount, source module, contract/PO/SO
reference, entry date — plus a **balanced-Dr/Cr check** and a
**duplicate-posting check** against `roznamcha_entries`
(country + reference + date). `draft-mapping.ts` maps finance fields to a
roznamcha draft (so "Prepare Reviewed Draft" also works for these).
API `app/api/erp/document-intelligence/[id]/roznamcha-preview` (GET).
ReviewPanel: "Cash / Bank Pre-Post Preview" button + a full preview table with
duplicate / unbalanced banners.

The AI never posts to `roznamcha_entries` / `roznamcha_lines` / journal /
ledgers — the human posts through the existing Cash / Bank Roznamcha screen
(which owns the payment-method-driven form, cheque pending/cleared/
dishonoured/cancelled states, and the enforced balanced-Dr/Cr + duplicate
guards). E2E `scratch/di-roz-e2e.mts`: bank transfer advice → classified
`bank_transfer_advice` → `roznamcha_entries` → preview with method
`bank_transfer`, amount 41,500, balanced, no duplicate.

**Remaining Phase-8 work:** the Entry Method Selector wrapper on the Cash /
Bank Roznamcha screen; carrying the preview's account hints into that form.

### Phase 9 — hardening, tests, evidence 🔶 (partial — this commit)

**Security (spec §19)**
- `lib/document-intelligence/rate-limit.ts` — in-process sliding-window limiter;
  `upload` (30/min/user) and `process` (60/min/user) enforced in the routes,
  429 + retry-after. Swap for a Redis limiter later without touching callers.
- Private storage (`0600`, no public URL), MIME + magic-signature validation
  (signature wins over declared MIME), size + page limits, malware heuristic
  (+ `DOC_INTAKE_MALWARE_SCAN=strict`), append-only `document_intake_events`,
  scope enforced in the API guard **and** re-checked in every service `WHERE`
  (`withLocalPg` bypasses RLS), idempotency + sha256 duplicate detection,
  no secrets in logs, no external transmission (provider adapter gated by env).
- `tests/services/document-intelligence.test.ts` — 12 unit tests: extractor
  (invoice / currency / total / containers / bank-transfer amount + method),
  classifier tie-break, composite-identity scope-distinctness, `rowInScope`
  country + shipping-domain isolation, the exact no-match message, draft
  mapping + unresolved-field detection, upload signature trust, malware scan,
  rate limit. `npx vitest run` → **123 passed / 1 skipped**.

**Remaining Phase-9 work (operator / follow-up):**
- The full 18-scenario authenticated E2E matrix (needs a Super-Admin session +
  the dev server — blocked here).
- Encryption at rest for `storage/document-intake/` where the host provides it.
- Wire the shipping-side handover inbox page + the loading-form `batchId` /
  roznamcha account-hint carry-through.
- The remaining 7 Entry-Method-Selector screen wrappers.
- Real-document UAT and the signed 19-point acceptance evidence.

---

## 19-point acceptance checklist — current state

| # | Item | State |
|---|---|---|
| 1 | Existing-system audit | ✅ (this doc, "Architecture") |
| 2 | Architecture / data-flow map | ✅ |
| 3 | Reused vs new components | ✅ (per-phase sections) |
| 4 | Migrations + rollback | ✅ 5 migrations, all `IF NOT EXISTS` / additive; rollback = drop new tables/columns |
| 5 | Document-type matrix | ✅ 39 seeded in `document_type_registry` |
| 6 | Field-extraction matrix | ✅ `extractors.ts` RULES (40+ keys) |
| 7 | Accuracy / confidence report | 🔶 synthetic only (tesseract meanConf ≈ 0.93 on clean scans); real-doc UAT pending |
| 8 | Duplicate-prevention evidence | ✅ sha256 + idempotency (jobs), unique `(job_id)` (drafts), container dedup (batches), `(module,source_id)` (consume), live-handover unique idx, roznamcha duplicate-posting check |
| 9 | QVC evidence | ✅ `di-e2e.mts` → `crm_action_items` row, module `document_intake` |
| 10 | Country / branch / agent scope evidence | ✅ `document-intelligence.test.ts` + `di-handover-e2e.mts` (money-leak clean, agent view has no business id) |
| 11 | Purchase / Sales / Shipping E2E | 🔶 service-level E2E done (`di-*-e2e.mts`); authenticated UI E2E pending |
| 12 | Accounting + stock reconciliation | ✅ by construction — AI writes only `document_intake_*` / `*_drafts` / `*_batches` / `*_handovers`; never journal / roznamcha / ledger / stock |
| 13 | Five-language evidence | ✅ `i18n:guard` green, 9999 keys × 5, all `dintake.*` appended after `...en`; RTL via `useErpScreen` |
| 14 | Security evidence | ✅ (Phase 9 section) |
| 15 | Test results | ✅ `vitest` 123 passed / 1 skipped; `tsc` 0; `i18n:guard` + `:changed` green |
| 16 | Clean production build | ✅ `npm run build` exit 0 (7 commits) |
| 17 | Final commit hash | phase commits `a7ef609` · `6917746` · `d101462` · `242d49c` · `6c99f6e` · `91635c4` · `09ac4b9` · `3512e38` · (this) |
| 18 | Remaining-work list | ✅ (per-phase "Remaining" + Phase 9) |
| 19 | Production-Ready sign-off | ❌ **withheld** — pending real-document UAT, authenticated scope testing, local verification and explicit production approval |

8. Cash / Bank Roznamcha manual + scan (payment-method-driven form, pre-post
   preview of serials / bill numbers / debit-credit accounts / currency / rate /
   source module, balanced Dr/Cr, duplicate-posting protection).
9. 5-language completion audit, security hardening (rate limiting, encryption at
   rest where available, immutable audit log retention), the 18-scenario test
   matrix, and the 19-point final evidence report.

---

## Gates (run every phase)

- `npx tsc --noEmit` — 0 errors in this module (pre-existing errors in
  `customer-form.tsx` / `customer-profile.tsx` / `ext-form-client.tsx` /
  `share-forms-tab.tsx` are other contributors' WIP).
- `npm run i18n:guard` + `npm run i18n:guard:changed` — green (9950+ keys × 5).
- `npm run build` — exit 0 (`PageNotFoundError: /_document` / missing
  `pages-manifest.json` at *Collecting page data* is a known transient for this
  app-router project; the build still exits 0 after "Compiled successfully").
- `npx vitest run` — 110 passed / 1 skipped / 1 pre-existing failure
  (`tests/services/goods-variations.test.ts`, reproduced on clean HEAD — not from
  this work).

## Local verification done (DEV DB, `scratch/di-*.mts` via `npx tsx`)

- `di-e2e.mts` — image invoice → createJob (sha256 dup detected) → processJob →
  tesseract OCR (meanConf ≈ 0.93) → classified `commercial_invoice` → 12 fields
  green/amber/red → scoped match `out_of_scope` → routed to `qvc` with the exact
  required message → field correct + verify → `sendToQvc` → `crm_action_items`
  row created.
- `di-draft-e2e.mts` — process → resolve red fields → `confirmDraft` → payload
  mapped to `purchase_orders` keys (`purchaseContractNo`, `supplierName`,
  `purchaseCurrency`, `exchangeRate`, …) → job `draft_ready` (`DID-2026-…`) →
  `consumeDraft` → job `linked` → idempotent re-consume returns
  `alreadyConsumed`.

## Outstanding before Production Ready (operator)

1. Apply `20260925` + `20260926` to the production database.
2. Authenticated, role-scoped browser UAT with real documents — Full/Restricted
   Super Admin, Country Admin, Main Branch, City Branch, Accountant, Cashier,
   Agent, Staff — verifying queue, side-by-side review, QVC routing, draft
   preparation, Entry Method Selector, cross-country/branch/agent isolation, and
   5-language RTL/LTR on every screen.
3. Phase 5 wire-ups for the remaining 7 screens; Phases 6–9.
4. `npm run ocr:vendor` on the target host (or ship `vendor/ocr/`).
5. Explicit production deployment approval.
