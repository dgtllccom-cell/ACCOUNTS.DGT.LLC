# DGT ERP: connected-workflow audit and DEV changes

Audit date: 18 October 2026 (Asia/Dubai). Scope: the six areas requested by the owner.

## Release verdict: NOT READY FOR FINAL ACCEPTANCE

The source audit and a set of DEV fixes are complete on an isolated review branch. Authenticated DEV acceptance is **BLOCKED**, and several financial/integration gaps remain open. No area is certified Fully Working. Passing unit tests or a visible menu is not treated as end-to-end completion.

- Repository: https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC
- User-confirmed DEV source branch: `main`.
- Audited starting commit: `f3faa53fb0dccd14332585d5c2465a5f1da02b11` (17 October, customer form/profile update).
- Review branch: `audit/dgt-connected-workflows-20261018`, based on that commit. Main/production were not changed by this work.
- The running remote DEV branch, deployed SHA, database schema version, credentials, and service configurations could not be independently confirmed: no reachable DEV URL or DEV secrets were supplied to this workspace.
- Local DEV server booted with demo auth and passwordless sessions disabled, without a database connection. Runtime evidence is limited to unauthenticated perimeter checks.
- Repository `AGENTS.md` identifies `csesvyxxjivnkkozgopt` as the only approved testing database and `inmayhrxucimxqhgseqi` as Production. No database writes, migrations, seeds, ledger postings, stock movements, provider messages, calls, purchases, or deployments were performed.

## Feature references

Read the available reference screenshots: IMG_5290.png (overdue invoice/account history/approvals), IMG_5292.jpeg (connected operations and inventory), IMG_5294.jpeg (chat, voice, bookings, follow-ups), IMG_5295.jpeg (multi-currency), and IMG_5296.jpeg (connected CRM). IMG_5293.png describes presentation generation and does not add an ERP acceptance requirement. The remote-control screenshot is not a feature reference; its access details are excluded. ECA9DFD1-EA18-42DD-81F7-E28A16F00945.png shows previous development progress, not current verification evidence.

## Classification matrix

| Area | Classification | Source evidence and routes | What prevents Fully Working |
| --- | --- | --- | --- |
| CRM / Customer 360 | Partially Working | `/dashboard/crm`; `/api/erp/crm/customer-360`; `lib/crm/customer-360-service.ts`; `features/crm/components/customer-profile-360-full.tsx` | Actual customer/account links and migration state need DEV verification. Complete invoice, payment, ledger, and all-channel history is not yet reconciled. Legacy records without authoritative links may be absent rather than guessed by name. |
| Multi-currency accounting | Partially Working | `/api/erp/daily-payments/post`; `lib/services/canonical-daily-payment-posting-service.ts`; `lib/services/posting-verification.ts`; currency/payment migrations | Cross-currency partial payments and local-purchase posting still need database-backed reconciliation. Optional idempotency keys and failure/retry behavior remain risks. |
| Purchase / Sales / Inventory | Partially Working | `/dashboard/purchase/stock/*`; `/api/erp/inventory/journal-stock/*`; `lib/services/stock-journal-service.ts`; `lib/stock-journal/model.ts` | No authenticated purchase-to-loading-to-receiving-to-sale/dispatch transaction was executed. Applied schema, concurrent issues, remaining-stock values and original-record traces remain unverified. |
| WhatsApp / Email / AI Calls | Unverified/Blocked | `/dashboard/messages/whatsapp`; `/dashboard/email`; `/dashboard/customer-inquiries/calls`; `/dashboard/customer-inquiries/intelligence`; provider and conversation services | No configured DEV provider accounts were available. Real Meta acceptance/delivery, SMTP/IMAP, inbound webhook processing, telephony and callback URL must be tested. Only Twilio has a call adapter. |
| Document Intelligence | Partially Working | `/dashboard/document-intelligence`; `/api/erp/document-intelligence/*`; `lib/document-intelligence/{extractors,verification,scope}.ts` | Parser and scope tests passed, but real files were not uploaded to DEV or consumed into transactions. All language OCR models and matching accuracy need real-document tests. External provider is a throwing placeholder. |
| Smart Operations / Management Reports | Partially Working | `/dashboard/smart-operations`; `/api/erp/smart-operations/control-checks`; `/api/erp/smart-due/{items,summary}` | Applied views/tables, findings against real records and all management reports remain unverified. Agent/line aggregates are withheld where safe partitioning is unavailable. Some overdue rules use fixed age thresholds. |

Existing backend services and schemas mean these whole areas are not classified Design Only or Missing. Individual capabilities can still be absent: non-Twilio call adapters and an external document-AI adapter are not implemented. No purchase or new vendor integration is justified merely by the screenshots.

## 1. CRM and Customer 360

### Existing implementation

There are existing customers, enterprise accounts, CRM action items/follow-up notes, customer inquiries, communications, sales, purchase, clearing and shipping records. Customer 360 already queried several sources, but a query existing did not establish that its output was correct or authorized.

Schema inspection found important identity differences:

- `customers.city_id` references geographical `cities`, not operational `city_branches`.
- `sales_orders.customer_account_id` references `enterprise_accounts`, not `customers`.
- `purchase_orders.supplier_company_id` references `companies`, not `customers`.
- `shipping_line_records.account_id` references `enterprise_accounts`.
- Existing `enterprise_accounts.customer_id` provides the customer/account link.
- CRM action scope IDs are text in `20261005_prod_reconcile_missing_objects.sql`; transaction scope IDs are UUIDs.

### Strengthened

- Fixed the API envelope mismatch: existing CRM clients required `success` but the API returned only `ok`; the endpoint now supports both without changing the global API format.
- Added customer permission, financial-field, domain and mobile-profile checks before direct SQL access.
- Replaced empty-array fail-open customer filters and unscoped profile/activity reads with explicit customer visibility. Branch access is resolved through existing linked accounts; country access uses the central scope model.
- Each related transaction query retains its source-module permission and its grant's country/branch scope. A shared scoped-session helper prevents a narrowed assignment from borrowing another assignment's permission, global flag or financial-field access.
- Replaced unrelated IDs and ambiguous name/substring joins with existing customer/account/ledger links. Purchases use the stored purchase account ID; cheques use linked ledgers. No guessed same-name association is used.
- Reconnected existing inquiry and Communication Center records into the profile timeline, with source links and scope checks.
- Separated profile receivables/payables/net positions by original currency. Profile summaries no longer add USD and AED and label the result as one currency. The register receivable KPI also groups currencies.
- Removed the 20-order cap from the queries used to calculate profile order balances, so those totals do not silently cover only a display subset.
- Added validated UUIDs, pagination, date ranges, activity types, notes and promise amounts. A zero promise amount is preserved.
- Fixed malformed date bindings that appended `::date` to the bound date value instead of applying a SQL cast.
- Made activity item/note/update writes transactional and serialized per customer using an advisory lock; an existing open item is reused by customer identity and scope, not party name.
- Removed fixed September date defaults and invented follow-up times / index-based health variation. Added date and assigned-user filtering to customer queries.
- Repaired several CSV property-name mismatches and separated currencies in the profile statement export. Used existing central translation keys for the changed labels and added an explicit RTL/LTR direction to the profile.

### Remaining gaps

Customer 360 remains a partial history: inquiries and Communication Center messages are connected, but all email/WhatsApp/call stores, standalone invoices, individual payment events and a reconciled ledger statement are not fully unified. The register row `totalReceivable` remains a placeholder zero; do not treat its detailed export as an authoritative balance report. Some existing profile/register text and export headings remain English-only even though the changed-code i18n guard passes. Full historical pagination, search/KPI consistency and legacy link completeness require DEV work. Source links were mapped to existing routes; record-opening behavior still requires browser verification.

## 2. Multi-currency accounting

### Existing implementation

Payment rows, posting exchange rates, original amounts and base-currency metadata exist. Relevant migration sources include `20261001_multicurrency_purchase_payment_fix.sql` and `20261201_purchase_sales_currency_conversion_fix.sql`. Existing posting verification checks distinct debit/credit ledgers, balanced lines and Roznamcha trace. Purchase/sales transfer RPCs are reused.

### Strengthened

- Daily Payments now rejects a purchase target paired with a sales direction (and vice versa) before opening the posting path.
- Post permission is checked before creating an idempotency record.
- The posting service now receives the actual authorized session and checks both ledgers and the target order against its country/branch scope. Previously the actor's scope arrays were supplied but unused.
- Financial-field access and shipping-domain restrictions are enforced.
- A finite, positive posting rate and explicit three-letter currency are required; the API no longer silently supplies rate 1 when a rate is omitted. Same-base-currency handling still resolves to 1 inside the service.
- The shared idempotency guard now refuses acquisition when the lock store fails, rather than permitting an unprotected mutation. Successful acquisition and replay behavior remain covered by tests.

### Open financial blockers

- The local-purchase Daily Payments branch still builds multiple writes outside one encompassing transaction. It writes base amounts with original currency labels on its Roznamcha lines and updates remaining balances using base amounts; this needs reconciliation against the authoritative local-purchase currency contract. Do not approve this flow from unit tests alone.
- Idempotency keys are still optional. Reusing a key with a changed payload, requests from different actors, timeouts after a successful posting, and failures while persisting replay results need end-to-end coverage. No claim of universal duplicate-posting protection is made.
- The posting service's final `remainingDue` response subtracts the payment amount directly from the stored order remaining amount. For a different payment currency, this must be checked against the RPC's authoritative converted result.
- Missing country/base-currency configuration and historical posting-rate integrity need database inspection. The posting verifier can accept either original or base totals; passing it alone does not prove currency labels are correct.
- Do not apply historical data corrections without reviewed DEV evidence and a separate Production approval.

## 3. Purchase, Sales and Inventory

### Existing implementation reviewed

The canonical Stock Journal service reads purchase booking/loading/receiving and uses `journal_stock_transfers` for confirmations. Physical stock remains in `product_inventory_balances` and `stock_movements`; local purchase uses existing `purchase_lots` / `lot_stock` through the Goods Transfer Journal. `20261235_stock_journal_integration.sql` is the relevant migration source; its numeric filename is not evidence that it is applied.

Code inspection found transactional stock actions, row locks, idempotency keys, receipt/customs eligibility, reservation-aware availability, and insufficient-stock rejection. `/api/erp/inventory/journal-stock/confirm` requires `authorized: true`. Explicit issue/dispatch/delivery is the stock-out path. No parallel stock implementation or menu was created.

### Evidence and outstanding acceptance

Existing stock model/lifecycle, purchase transfer-routing, ledger and permission tests passed. The canonical Stock Journal guard passed. This verifies tested models and source invariants, not actual balances in the DEV database. Complete acceptance still requires one linked purchase with multiple lots/goods, loading, receipt/customs, confirmation, partial sale, dispatch and return/reversal, including duplicate-click/concurrency checks, traceable original IDs and remaining-stock reconciliation.

## 4. WhatsApp, Email and AI Calls

### Existing capabilities

- Meta Cloud API send/webhook code, WhatsApp account records and team inbox exist. The test-send path checks for real provider acceptance/WAMID before recording a sent message.
- Email includes SMTP (`nodemailer`), IMAP (`imapflow`) and saved mailbox/account resolution. Code existence does not prove any mailbox is usable.
- Conversation Intelligence uses deterministic local extraction to prepare summaries, decisions, requirements, dates, inquiry drafts and follow-up text. Its confirm path reuses customer inquiries and User Tasks.
- AI Calls has number mapping, call/event storage, an inbound webhook and draft inquiry write-back. Twilio is the only implemented telephony adapter; the configuration enum lists other providers without adapters.

### Strengthened

- Replaced Twilio's signature-header-presence check / unconditional acceptance with the official SDK's signature validation using `AI_CALL_AUTH_TOKEN`, the full form and the exact URL.
- Added trusted `AI_CALL_WEBHOOK_URL` handling for reverse-proxy validation and callback generation. Arbitrary forwarding headers are not used to construct a trusted signature URL.
- Invalid/missing signatures and tampered transcripts are rejected in tests before processing. The unconfigured local webhook status correctly reported `configured: false`; that does not describe the remote DEV installation.
- WhatsApp test-send now requires a send permission, an active non-deleted selected sender and authorized account scope. It cannot borrow another account's global default credentials. Conversation lookup/write includes the sender's country and branch.
- Missing session responses on the changed APIs return 401 JSON instead of redirecting API consumers to the login page.

### External dependencies and gaps

Real Meta credentials/WABA/number, approved templates if required, delivery webhooks, SMTP/IMAP credentials and mailbox entitlements, Twilio credentials/number/public callback, number mapping and optional LLM configuration must be supplied securely in DEV. No real message, email or call was sent. The Meta send endpoint hard-codes Graph API v19.0; its current service viability was not verified. Tokens/encryption and all messaging entry points require a wider endpoint review. The WhatsApp conversation path has no demonstrated database uniqueness/concurrency guarantee. Conversation confirmation/task creation needs retry/deduplication tests, and all channel history is not yet proven to write back to one customer timeline.

Twilio reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security (official SDK validation guidance).

## 5. Document Intelligence

### Existing implementation reviewed

Local PDF text extraction, image/scanned-document OCR, keyword classification and heuristic field/line extraction exist. Matching/review/draft paths reuse existing ERP modules. The verification service checks duplicate hash, consumed documents, invoice/reference duplication, party, currency, FX rate, quantity, unit rate, totals and duplicate financial posting. Local files are served through scoped endpoints. The external provider implementation is a throwing placeholder; local processing is the actual path.

### Strengthened

Consumed-copy detection could disclose another branch's job number/module. It now applies the existing intake scope in SQL and filters returned rows before warning output. Document hash and invoice duplicate searches apply job scope before their result limit, reducing false negatives caused by unrelated rows occupying that limit. Regression tests distinguish a hidden other-branch consumed copy from an authorized consumed copy.

### Remaining acceptance

A UI in five languages does not prove OCR support for all five. Default OCR languages are `eng+ara`; Urdu/Farsi/Pashto trained data and real scans need verification. Line-rate comparison is positional and needs testing with reordered/multi-lot goods. Actual uploaded PDFs/images, accuracy, matching, already-used-document blocking, review/confirmation, Print/PDF and source-record permissions were not executed against DEV. Source schema was inspected, but installed schema and storage readiness are unknown.

## 6. Smart Operations and reports

### Existing implementation reviewed

Read-only detectors and Smart Due aggregation cover accounting exceptions, overdue receivables/payables, pending approvals, follow-ups, tasks, low stock, overdue ETA, shipping documents, HR and compliance. Findings link to existing source routes.

### Strengthened

- Control checks no longer run every detector for every logged-in user. Each detector checks source permissions, financial-field access, supported roles and its scoped grant before querying. Combined detectors require the sources they expose.
- Smart Due items and summary counts use source-specific permission/scope predicates. The summary's old OR of city/main-branch/country assignments could widen a branch user's scope through parent IDs; it now uses the central scope rule.
- Non-manager task/follow-up aggregates are limited to their own/assigned records. Agent/line-specific cross-module aggregates fail closed where a dedicated agent/line partition is unavailable.
- Explicit country/branch filters now apply to follow-ups, approvals and tasks in both detail/count paths. Joined detail queries qualify explicit scope columns to avoid ambiguous-column errors.
- A missing database returns 503, rather than a successful empty/clean report. Failed detectors retain `error: true` rather than appearing resolved.

### Remaining acceptance

Overdue receivable/payable detectors use 30-day age thresholds, not verified contract-specific due dates. Counts/findings are limited samples, not audited financial totals. Agent/line-scoped operational findings need a safe tailored implementation. Every source view/table, real result, deep link, country/branch report, Print/PDF and financial redaction still needs authenticated DEV verification. This is not a full audit of every report route in the repository.

## Verification results

| Check | Result | Meaning |
| --- | --- | --- |
| Existing targeted baseline | PASS - 169 tests / 16 files | Accounting, stock, document, conversation and permission models, before changes. |
| Latest complete unit/component suite | PASS - 440 tests; 1 skipped | 64 files passed; database-inspection test skipped. Fixture/mocked tests are not a live database run. |
| Customer profile language component checks | PASS - EN/UR/AR/FA/PS | Actual profile renders an `ok` response and separate AED/USD values; RTL/LTR state checked. No real device layout or browser print claim. |
| Local anonymous runtime probes | PASS | Customer 360, Daily Payments, Document Intelligence, Control Checks and Smart Due items/summary return 401; CRM dashboard redirects to login. DEV session bootstrap disabled. |
| Call-provider signature checks | PASS | Official SDK accepts correct test signatures and rejects missing, forged, wrong-key, wrong-URL and tampered-body signatures. No real call. |
| WhatsApp send-access checks | PASS | Anonymous, missing permission, wrong-branch and unknown-sender cases cannot call provider fetch. No real send. |
| Five-language changed-code guard | PASS | 21,378 keys x 5 languages; parity and changed-code checks. This does not certify all inherited text. |
| Multilingual business-data contract | PASS | 166 classified tables; 619 scanned API routes; 0 recorded backlog. |
| Navigation and canonical stock guards | PASS | 198 distinct menu destinations / 198 leaf links; canonical Stock Journal retained. |
| TypeScript | FAIL - 9 pre-existing errors | Original commit and audited code produced identical diagnostics in city-branch setup, admin-user-management panel and user-journal report. No new error in that comparison. Final validation is recorded in the review evidence. |
| Optimized build | PASS - exit 0 | Full optimized Next build completed. `next.config.ts` ignores TypeScript build errors; this success does not override the TypeScript FAIL. |
| Applied DEV database schema / API transaction tests | BLOCKED | No secure DEV database access. |
| Authenticated desktop/mobile/tablet, full RTL and ERP Print/PDF | BLOCKED | No reachable authenticated DEV environment. |
| Production deployment | NOT PERFORMED | Owner approval required; no Production change is authorized by this report. |

Test evidence is kept with the review. Relevant additions: `tests/crm/*`, `tests/api/customer-360-contract.test.ts`, `tests/api/idempotency-failure.test.ts`, `tests/api/whatsapp-test-send-access.test.ts`, `tests/services/daily-payment-access.test.ts`, `tests/services/smart-operations-access.test.ts`, `tests/services/ai-call-signature.test.ts`, and `tests/document-intelligence/verification-scope.test.ts`.

Custom permissions without an explicit assignment-level scope are refused in these audited paths until their scope is verified. Mixed HR-role aggregates are also withheld where their scope cannot be safely attributed.

The nine existing TypeScript errors: `features/branches/components/city-branch-setup.tsx:883`; `features/users/components/admin-user-management-panel.tsx:466,495,1155,1183`; `features/users/components/user-journal-report.tsx:861,883,1094,1118`. They concern incomplete location/report objects and optional strings; no fixes to those unrelated screens are included.

## What was new, and why

No new ERP module, route, menu, database table, migration, customer, invoice, task, financial record or stock record was created. New code files are internal access/validation/balance helpers and regression tests. They centralize safety around the existing Customer 360 and Smart Due implementations. Twilio SDK 6.2.0 is a free code dependency needed to replace a non-validating webhook check; no paid service was purchased or enabled.

## Remaining blockers and next acceptance sequence

1. Provide the reachable DEV URL and a secure environment connection to the dedicated DEV project. Confirm the deployed DEV SHA before testing; do not paste secrets into the report.
2. Resolve the nine pre-existing TypeScript errors. Review and test the proposed branch before merging; no merge or Production deployment is part of this work.
3. Inspect actual tables, columns, RPC versions, indexes, RLS and uniqueness constraints. Compare these with migrations and current source.
4. Prioritize local-purchase currency/transaction integrity, canonical remaining-balance response, optional-key/retry behavior, then complete customer/invoice/payment/channel traceability and inherited translation gaps.
5. Run authenticated role/country/branch isolation with Global/Business/Shipping administrators, country and branch staff, agents and customers. Test exact record IDs as well as list/summary access.
6. Execute the linked accounting and stock lifecycle with authorized DEV fixtures only; test partial payments, mismatched currencies, duplicate submissions, concurrency, reversals and source tracing.
7. Configure existing DEV service accounts without buying services. Verify incoming/outgoing/provider callbacks only within explicit test-recipient authorization, and confirm draft-only AI write-back.
8. Check EN/UR/AR/FA/PS on desktop, phone and tablet; perform actual Print/PDF and source-link checks. Produce a second acceptance result from that evidence.

This report is a completed source audit with reviewable DEV improvements and a blocked runtime acceptance stage. It is not a declaration that the ERP is complete, safe to release, or fully tested.
