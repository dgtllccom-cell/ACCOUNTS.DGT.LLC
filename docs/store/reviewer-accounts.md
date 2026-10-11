# Store reviewer access — DGT.llc B and DGT.llc BS

Prepared 2026-10-11. **Nothing in this document has been created in Production.** The pass system and the reviewer login were built and proven on the Testing database only. Creating anything in Production needs your explicit approval (project rule: no demo/test users or data in Production).

## What Apple, Google and Samsung need
Every store asks for a way to open the app: a login, and any special steps. A reviewer uses their own phone, cannot call you, and may test several days apart. Two things stop them in our design:

1. **Device approval.** Each phone must be approved by the Super Admin and given a 6-digit code. A reviewer cannot wait for that.
2. **A login.** They need an ERP account — but it must never show real customers, ledgers or money.

## The design (two pieces, both limited)
### 1. Review pass (new — replaces the "approve this phone" step for the reviewer only)
Super Admin → **Mobile Devices → Store review passes → New review pass**.
| Setting | Meaning |
|---|---|
| Pass name | e.g. "Apple App Review" |
| App | DGT.llc B or DGT.llc BS |
| Reviewer ERP login | the ONE reviewer login this pass works for |
| Valid for (days) | 1–90 (default 30) |
| Max devices | 1–20 (default 6) |
The system shows a code like `K7QX-M2PD-9WTE` **once**. You paste it into the store's "review notes". The reviewer opens the app, fills the activation form, types the code in "Store review code" and the phone is activated immediately.

Safety rules (all tested — `scripts/e2e-review-pass.mjs`):
* the code only works with its own login and its own app; a different e-mail or the other app is refused;
* the code is stored only as a hash; it cannot be read back;
* 10 wrong codes lock the pass; a per-caller limit slows guessing;
* when the pass expires or you press **Revoke**, every phone activated with it is blocked on its next request;
* the pass never gives data by itself — the reviewer must still sign in, and the login's own permissions decide what is seen.

### 2. The reviewer login (existing role, no new role)
* Role **Reports Auditor (`auditor_viewer`)** — read-only: reports, audit logs, ledgers, KYC, documents, tax, contracts (*read* only; no create, edit, post or delete anywhere).
* Financial amounts **denied** (`finance_amounts:deny`).
* **Never Super Admin.** Scope = one dedicated, empty "App Review" country (no companies, customers, accounts or transactions).
* Created only by the Super Admin; the password is set and kept by you, never sent through chat or e-mail to the stores — it goes in the store's secure "review credentials" fields.

## The honest risk (please decide)
With an empty scope the reviewer sees real screens (menus, forms, filters, reports) but **no business records**. Apple (guideline 2.1 "complete, working app", 4.2 "minimum functionality") and sometimes Google reject apps whose review account shows nothing. Options:
| Option | What the reviewer sees | Production impact | Risk |
|---|---|---|---|
| **A. Empty scope + review video (recommended default)** | real screens, empty lists; plus a short screen-recording of the same app on Testing data attached in the store notes | adds one empty country + one read-only user | moderate — reviewers may still ask for data |
| **B. Owner-approved labelled sample data in the isolated "App Review" scope** | a handful of clearly labelled "SAMPLE — App Review" shipments/containers/accounts, visible only to this login | adds sample rows to Production — this is normally forbidden; only with your written approval, labelled, isolated, and removable with one script | lowest rejection risk; you accept the policy exception |
| **C. Separate review server** | a copy of the ERP with sample data, reachable only for reviewers | no Production change; extra hosting + a second URL in the app | not available today (the apps are built for one server) |
I recommend **A** first, and **B** only if a store rejects for "no content".

## What was proven on Testing (DEV only)
`scripts/e2e-reviewer-account.mjs` — **26 PASS / 0 FAIL** — and `scripts/e2e-review-pass.mjs` — **32 PASS / 0 FAIL**. The reviewer login, pass and phones are created and removed by the script.
| Check | Result |
|---|---|
| Super Admin creates a Reports Auditor, domain "both", finance denied, scoped to a country with no data | pass |
| Permission set contains **no** create / update / delete / post / approve token and contains `finance_amounts:deny` | pass |
| Review pass activates the reviewer's phone in **both** apps (B and BS) and the reviewer signs in (domain "both" passes each app's front door) | pass |
| Customers, accounts, roznamcha, tracking summary: no rows (403 / empty) | pass |
| Ledgers: only the review country's 3 auto-created **empty** ledger shells, 0 postings, 0 foreign rows | pass |
| Asking for another country's customers / accounts returns nothing | pass |
| Creating accounts, managing users or devices, creating passes: refused (403). Customer / cash-entry / user creation with a bare payload is rejected (422/400) **before** reaching authorisation — the proof that the role cannot write is the permission set above (no write tokens), not these two lines | pass (with this caveat) |
| The reviewer's phone cannot be used by a different ERP login | pass |

## Scope country in Production (read-only look, nothing changed)
Every country automatically owns 3 ledger shells (Main / Investment / Inter-Country). In Production the following countries currently have **no branches, no users, no customers and no ledger postings**, so one of them can be the review scope without creating any new record: Kazakhstan, Russia, Saudi Arabia, Tajikistan, Turkiye, Iran (also two badly-spelled test-looking entries — "AFGHISTAN" and "chian" — which I do **not** recommend). Pick one that you will not use for real business soon. Re-check it is still empty on the day (the e2e script's first query does exactly that).

## Security notes
* The device-approval gate stays on for everyone; only the pass bypasses the *approval step*, only for its one login.
* After the stores approve the apps, revoke the pass (all its phones are blocked immediately) and disable the reviewer login.
* The reviewer password is chosen by you and entered in each store's "review credentials" form; it is never stored in this repository or sent through chat.

## Steps for you (when you approve)
1. Approve option A or B.
2. Approve the Production deployment of the device system **including** migrations `20261232` and `20261233` (needs a verified backup first — separate approval).
3. Super Admin creates the empty "App Review" country and the reviewer login (I will prepare the exact steps; you type the password).
4. Super Admin creates one pass per store (Apple / Google / Samsung), copies each code into that store's review notes.
5. After the store approves the app, **Revoke** the pass (or let it expire).
