# DGT ERP ONE APP — Consolidated Owner Review Register
**As of:** 2026-10-26 (Dubai)  
**Source repository:** `dgtllccom-cell/ACCOUNTS.DGT.LLC`  
**Purpose:** One place for the owner to compare *all previously discussed work* against current code, DEV test evidence, actual LIVE deployment, mobile apps, and Figma. **This is a review register, not a claim that all items are implemented or deployed.**

## How to read this
- 🟢 **Verified in stated scope** — supporting source reports a passing test; it does **not** imply Production PASS.
- 🟠 **Testing / needs fresh confirmation** — code or historical tests reported, but current merged release and/or real workflow not yet proven.
- 🔵 **In progress / work to reconcile** — implementation or audit remains.
- 🔴 **Blocked / action required** — missing dependency, known risk, or outstanding authorization.
- ⚪ **Not yet independently verified** — do not infer completion.

**Evidence hierarchy:** running Production commit + authenticated end-to-end result > merged-branch test report > isolated DEV test report > agent narrative > design mockup. Record the exact commit, build, date, role, branch, country and test link against each item. Do not overwrite earlier evidence.

## ERP modules and outstanding verification
| ID | Workstream | Latest reported evidence / issue | Owner review status |
|---|---|---|---|
| 01 | Super Admin dashboard & user scope | Country/branch separation and dashboard translations changed; full-role LIVE walkthrough outstanding | 🟠 |
| 02 | Country Admin user creation | Country Admin may create scoped Branch Admin and normal users, never Country Admin/Super Admin; recheck failures with actual assignments | 🟠 |
| 03 | Chaman City Branch Admin | Shipping city admin needs user creation of normal branch users; current permission policy/test conflict recorded in master report | 🔴 |
| 04 | User registration | Preserve entered form data on error; role assignments and country/branch restrictions; test authorized personas | 🟠 |
| 05 | Shared Person Master | Employee and Company shared identity linkage; test actual workflow | ⚪ |
| 06 | Account Setup | Non-English Update/Save, translated country/branch selectors, chart mapping; recent account-screen fix needs repeat verification | 🟠 |
| 07 | Accounts / GL / Roznamcha | Cash and bank transactions, debit=credit, permission scope, report totals | 🟠 |
| 08 | Purchase Booking | Booking register, transfer status, outstanding balance; prevent existing live-bill auto-transfer | 🟠 |
| 09 | Purchase Transfer | Older correctly targeted DEV harness reported 8/8 PASS; verify exact-once idempotency, index migration 20261237, LIVE version | 🟠 |
| 10 | Remaining Payment | Older DEV reported 16/16 PASS; multi-currency, partial/full/over-payment; verify live commit and balances | 🟠 |
| 11 | Local Purchase and Credit Payment | Older DEV 9/9 PASS after SQL type, zero-balance and atomicity concerns; retest merged release & ledger | 🟠 |
| 12 | Sales Booking / Transfer / Local Sales | Duplicate-transfer guard, receivables, status and accounting consistency; repeat after merge | 🟠 |
| 13 | Purchase / Sales Due & CRM Forecast | Outstanding banners, due dates, forecast linkage; reconcile business rules and live data | ⚪ |
| 14 | Expense registers | Truck, Customs, Customer, Other — real DB counts/filters; no mock values; DEV expense framework reported 50/50, bill lines 41/41 PASS | 🟠 |
| 15 | Expense / tax / currency | Country base currency, VAT exclusive/inclusive/exempt, row FX rate, mixed-currency Job Cost; transportation payment ledger mapping pending | 🔴 |
| 16 | Stock, journal and stock-balance report | DEV tests historically passed; reconcile LIVE deployed build and inventory balances | 🟠 |
| 17 | Customer Order create/edit/view | Check actual save on LIVE, importer scenarios, `goods_items`, insurance, external partner columns, no fictitious live records | 🟠 |
| 18 | Customer Order UI and transfers | Read-only full order report; top compact Order/Customer details, goods, Loading/Transport/Receiving, user audit; avoid duplicate prices/payments; transfers separate action | 🔵 |
| 19 | Multi-country shipment routes | DEV scenarios Afghanistan→Chaman→Karachi and Dubai→Iran→Afghanistan→Uzbekistan→India (real connecting legs required); statuses and permissions | ⚪ |
| 20 | Shipment Tracking | Earlier API 67/67 and UI 204/204 on isolated branch; retest on latest merged build, i18n and non-admin roles | 🟠 |
| 21 | Truck Registration | Merge/deploy historically reported; authenticated live operation and Print/PDF still require evidence | 🟠 |
| 22 | Clearing Agent & Shipping Line | Bills, external partner links, approval workflow, zero/demo-data requirements; test branch scope | 🟠 |
| 23 | Grid/List toggle | Seven gap pages historically PASS; single toggle, persistent choice, same records, hidden in print; latest integrated release/production confirmation | 🟠 |
| 24 | Business/Shipping/Global isolation | Older outstanding-ledger shipping ID leak and 500; DEV domain scan reported 57 PASS + 3 fixture/policy items; re-audit actual data | 🟠 |
| 25 | Five languages + RTL | en/ur/ar/fa/ps; master report cites 111 screens and 1,332 non-English loads for merged release; avoid hard-coded English and verify Customer Order | 🟠 |
| 26 | Navigation, Search, Edit, Print/PDF | Duplicate controls, wrapping, mobile widths, sorting/pagination, API errors; complete real workflow | 🟠 |
| 27 | CRM / Customer 360 / HRM / Payroll | Present in project scope but no consolidated current A–Z PASS proof in reviewed sources | ⚪ |
| 28 | Production reset / deployment protection | Historical bypass by npm prepare rewriting hooksPath; master work-card register records gate/lock fix; audit current status and deploy keys | 🔴 |
| 29 | Production database & controlled migrations | Distinguish DEV from Production; verify 20261232/33 device tables and financial index 20261237 on target before any write | 🔴 |
| 30 | Final A–Z owner verification | All roles, real countries/branches, en/ur/ar/fa/ps, desktop/tablet/phone; report PASS/FAIL per module; no blanket PASS | 🟠 |
| 31 | Production-backed demo video | Separate DEV fictional test routes from authorized read-only LIVE records; exclude private customer information | 🔵 |

## Mobile and design, two separate deliverables
| ID | Workstream | Latest reported evidence / issue | Owner review status |
|---|---|---|---|
| 32 | DGT.llc B — Business | Signed older Android builds and server harnesses; new approved design not yet confirmed implemented or tested on a physical device | 🔴 |
| 33 | DGT.llc BS — Shipping | Same: validate shipping permissions, shipment flows, device activation, real Android/iOS behavior | 🔴 |
| 34 | Device approval + reviewer pass | DEV harnesses 35/35, 32/32, 26/26, 12/12 historically passed; confirm Production tables, reviewer account and permission safety | 🔴 |
| 35 | Figma design | Concepts A Harbour Ledger, B Night Dock, C Manifest; plugin created but not yet validated inside Figma in earlier report; owner to select/approve | 🔴 |
| 36 | Full mobile UI | Login/activation, B & BS dashboard, Customer Order, Shipment Tracking, reports, tablets, 5 languages/RTL/light-dark; compare separate 47-screen design set without losing concepts | 🔵 |
| 37 | Mobile Store submission | Google Play, Samsung, Apple accounts, D-U-N-S, reviewer access, actual signed release, Mac/Xcode build and real devices; no verified public download links | 🔴 |

## Most recent repository baseline reviewed
- `docs/MASTER-PROGRESS-REPORT.md` updated **2026-10-25 23:30 Dubai**. It states Release Candidate `release/rc-expense-framework` was tested on DEV only, with production read-only checks; reported LIVE commit `a86355d` at that time.
- Documented PASS evidence includes expense framework **50/50**, bill expenses **41/41**, English **1,332/1,332** checks, and follow-up locale checks; see master report for qualifications.
- **Open owner decisions in that report:** 19 legacy unit tests disagree with changed branch-admin/shipping-line policy; legal-name vs transliteration display policy; transport payment ledger mapping; input-VAT journal-account treatment. Do not silently choose accounting/role policies.
- `docs/WORK-CARD-REGISTER.md` was last fully reconciled earlier and contains historical deployment recovery evidence. Cross-check it against present GitHub branches, active sessions, live commit and owner permissions.
- **The current live deployment and end-to-end results have NOT been independently checked while preparing this register.** Historical PASS ≠ latest Production PASS.

## ONE APP review-screen specification (for implementation after reconciliation)
Create a single owner-facing page **DGT ERP ONE APP → Master Work Status**:
1. Overview metrics: all items, Verified, In Progress, Testing, Blocked, Unverified, Live Verified — derived only from actual records.
2. Filter by workstream, module, agent/card, GitHub branch, country/branch, status, language, deployment environment.
3. Each row opens evidence: last build/commit, test run, errors, migration state, Production build SHA, actual owner approval, screenshot/video, outstanding action.
4. Every prior item has a stable ID (01–37), to prevent duplicating or silently hiding work. Archived card is NOT equivalent to LIVE PASS.
5. No artificial green statuses, no fake Production records, no exposed credentials.
6. Read-only by default. Any actual Production write/deployment remains subject to verified backups, approved changes, rollback, and established gate.
7. Responsive desktop/mobile and translated labels for **English, Urdu, Arabic, Farsi, Pashto**, including RTL.

## Acceptance and next steps
- [ ] Match this register against the existing Master Progress Report and all 17+ agent cards; correct any stale historical states with *evidence*.
- [ ] Audit source code and DB migration history for each module and link the exact tested commit.
- [ ] Implement ONE APP status view against a real authenticated, RBAC-filtered task/evidence source, not a hard-coded demo table.
- [ ] Run the complete regression and 5-language/RTL suite.
- [ ] Verify the actual LIVE deployed SHA, backups, migration receipts, and approved release without modifying business data.
- [ ] Obtain owner review of the consolidated gaps; create tracked issues for each genuinely pending item.
- [ ] Publish final complete **Urdu** PASS/FAIL report and safe video walkthrough.

**No code, Production data, migration or deployment was changed by this register alone.**
