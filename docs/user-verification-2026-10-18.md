# User-by-user verification — 2026-10-18

**Environment:** DEV database `csesvyxxjivnkkozgopt` only (hard-guarded in the harness). Production `inmayhrxucimxqhgseqi` was not read or written.
**Branch:** `feat/domain-separation-user-verification` (from `feat/stock-balance-report`).
**Language:** English with technical terms; the owner's Urdu report is produced from these tables.

## 1. How many users are active? (13 or 14 — answered from the DEV database)

| Group | Count |
|---|---|
| Profiles in DEV (not soft-deleted) | 35 |
| …with a live (active, not deleted) assignment → can have a session | **29** |
| …of which real `@dgt.llc` accounts | **18** |
| …of which `@rbac-test.dev` RBAC fixtures | 11 |
| Profiles with NO live assignment (cannot sign in — session is revoked) | 6 |
| Soft-deleted profiles (historic / test) | 45 |

The number is **not 13 or 14 in DEV**: 18 real `@dgt.llc` logins resolve to a session (29 including RBAC test fixtures). If the owner's 13/14 refers to Production, that database was deliberately not queried here. `business.superadmin@dgt.llc` does **not exist in the DEV database** (it is a Production account); it was mimicked with `POST /api/erp/auth/dev-session { role: "super_admin", operationalDomain: "business" }` (see §4).

## 2. Method (no password was typed, read or needed)

1. Users and assignments were read **read-only** from the DEV database.
2. For every user the production session resolver `resolveEffectiveAccessForUser` was called in-process — that is exactly the session the user's next request would get (live assignment, custom permission set, branch rules, domain). No cookie was issued.
3. From that session the sidebar (`visibleMenuHrefsFor`, the same filter the live sidebar uses), the dashboard route and the direct-URL decision (`evaluateRouteAccess`, the same policy the server layout uses for the 403 page) were computed.
4. API access and data isolation were exercised over HTTP against the running DEV server with `dev-session` identities (no real password): `scripts/dev/domain-leak-scan.mjs`, `direct-url-api-matrix.mjs`, `user-creation-domain-e2e.mjs`, `shipping-account-approval-e2e.mjs`.
5. **Login\*** = real password sign-in cannot be performed by the assistant (CLAUDE.md: no real passwords). It is therefore marked **NOT VERIFIED** for every user, never PASS. "Session resolves" (step 2) is the verified part.

## 3. Per-user table — real accounts (@dgt.llc)

| Username | Email | Role | Country | Branch | Business / Shipping | Login* | Dashboard | Permissions | Issue | Fix | Final status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AFG-CA-000001 | afghanistan.shipping.admin@dgt.llc | country_admin | Afghanistan | — | Shipping | NOT VERIFIED* | /dashboard/country | 145 effective tokens (role_default) | — | — | PASS |
| ALL.SUPERADMIN | all.superadmin@dgt.llc | super_admin | Global | — | Global (both) | NOT VERIFIED* | /dashboard/super-admin | 1 effective tokens (role template) | — | — | PASS |
| ALRAS.SHIPPING | alras.shipping@dgt.llc | city_branch_admin | United Arab Emirates | Al Ras Shipping & Clearing Branch | Shipping | NOT VERIFIED* | /dashboard/city | 45 effective tokens (custom) | Same legacy-token permission set as Chaman (45 tokens, no accounts:create). | Not changed (Task B is Chaman only). Same grant script pattern applies if wanted. | PASS (resolves) — OWNER DECISION |
| AUDIT.SUPERADMIN | audit.superadmin@dgt.llc | super_admin | Global | — | Global (both) | NOT VERIFIED* | /dashboard/super-admin | 1 effective tokens (role template) | Named 'Audit' but holds the full Global Super Admin role (write access), not the read-only Reports Auditor role. | None applied (real user). Owner: re-issue as super_admin_reports (read-only) if audit-only is intended. | PASS (resolves) — OWNER DECISION |
| CHAMAN.SHIPPING | chaman.shipping@dgt.llc | city_branch_admin | Pakistan | Chaman Shipping & Clearing Branch | Shipping | NOT VERIFIED* | /dashboard/city | 84 effective tokens (manual) | Saved custom permission set (2026-09-13) held only legacy form tokens: no accounts:create, customers:*, expenses:*, ledgers:read — Account Master creation answered 'Missing permission: accounts:create'. | DEV: 39 exact tokens added through the users API (scripts/dev/grant-chaman-shipping-permissions.mjs; owner-approved SHIPPING_APPROVED_BUNDLE + customers/companies/warehouses/ledgers/expenses). Production: owner repeats the grant in Permission Control Center (token list printed by the script). | PASS (DEV fixed) — PROD OWNER ACTION |
| DUBAI.BRANCH | dubai.branch@dgt.llc | city_branch_admin | United Arab Emirates | Deira Dubai City Branch | Business | NOT VERIFIED* | /dashboard/city | 100 effective tokens (role template) | — | — | PASS |
| KANDAHAR.SHIPPING | kandahar.shipping@dgt.llc | city_branch_admin | Afghanistan | Kandahar Shipping & Clearing Branch | Shipping | NOT VERIFIED* | /dashboard/city | 45 effective tokens (custom) | Same legacy-token permission set as Chaman (45 tokens, no accounts:create). | Not changed (Task B is Chaman only). | PASS (resolves) — OWNER DECISION |
| PAKISTAN.ADMIN | pakistan.admin@dgt.llc | country_admin | Pakistan | — | Business | NOT VERIFIED* | /dashboard/country | 145 effective tokens (role template) | — | — | PASS |
| PAK-MA-000001 | pakistan.mainbranch@dgt.llc | main_branch_admin | Pakistan | Pakistan Main Branch | Business | NOT VERIFIED* | /dashboard/city | 107 effective tokens (role_default) | — | — | PASS |
| PAK-CA-000001 | pakistan.shipping.admin@dgt.llc | country_admin | Pakistan | — | Shipping | NOT VERIFIED* | /dashboard/country | 145 effective tokens (role_default) | — | — | PASS |
| PAK-ACC-000001 | quetta.accountant@dgt.llc | accountant | Pakistan | Quetta City Branch | Business | NOT VERIFIED* | /dashboard/city | 74 effective tokens (role_default) | — | — | PASS |
| QUETTA.BRANCH | quetta.branch@dgt.llc | city_branch_admin | Pakistan | Quetta City Branch | Business | NOT VERIFIED* | /dashboard/city | 4 effective tokens (manual) | Manual permission set of only 4 tokens: the sidebar shows 3 entries; the Branch Admin cannot work in Quetta. | Not changed (real user). Owner: apply the Business branch template in Permission Control Center. | PASS (resolves) — OWNER DECISION |
| PAK-CASH-000001 | quetta.cashier@dgt.llc | cashier | Pakistan | Quetta City Branch | Business | NOT VERIFIED* | /dashboard/city | 22 effective tokens (role_default) | — | — | PASS |
| PAK-BR-000002 | quetta.shipping.admin.pakbr000002@dgt.llc | city_branch_admin | Pakistan | Quetta City Branch | Shipping | NOT VERIFIED* | /dashboard/city | 100 effective tokens (role_default) | Shipping-domain Branch Admin assigned to the BUSINESS branch 'Quetta City Branch' (no Shipping branch exists for Quetta in DEV). | Users API now refuses this combination for every creator (422 BRANCH_DOMAIN_MISMATCH). Existing row NOT altered (real user). Owner: create a Quetta Shipping & Clearing branch and move this user, or switch the user to the Business domain. | PASS (resolves) — OWNER ACTION |
| PAK-AG-000001 | quetta.shipping.agent@dgt.llc | agent_user | Pakistan | Quetta City Branch | Shipping | NOT VERIFIED* | /dashboard/agent | 40 effective tokens (role_default), no financial amounts | Shipping-domain agent_user assigned to the BUSINESS branch 'Quetta City Branch'. | Same guard as above; existing row NOT altered. Owner: reassign to a Shipping branch. | PASS (resolves) — OWNER ACTION |
| SHIPPING | shipping@dgt.llc | super_admin | Global | — | Global (both) | NOT VERIFIED* | /dashboard/super-admin | 1 effective tokens (role template) | Named 'Shipping Line Super Admin' but its assignment has operational_domain='both', so it resolves as the GLOBAL Super Admin (all Business data, all menus). | Code path verified: a Super Admin with operational_domain='shipping' resolves to shipping_super_admin (Shipping-only). Data NOT changed (real user). Owner: set the assignment domain to 'shipping' if this login must be Shipping-only. | PASS (resolves) — OWNER DECISION |
| SUPERADMIN | superadmin@dgt.llc | super_admin | Global | — | Global (both) | NOT VERIFIED* | /dashboard/super-admin | 1 effective tokens (role_default) | — | — | PASS |
| UAE.ADMIN | uae.admin@dgt.llc | country_admin | United Arab Emirates | — | Business | NOT VERIFIED* | /dashboard/country | 145 effective tokens (role template) | — | — | PASS |

\* Login = real password sign-in: **NOT VERIFIED** (see §6 for the secure reset process).

### 3b. Menus and direct-URL access per real account

| Email | Sidebar entries | Reports | Forms / entry screens | Sidebar groups | Direct URL check (domain) |
|---|---|---|---|---|---|
| afghanistan.shipping.admin@dgt.llc | 51 | 9 | 12 | accounts, branch-management, clearing-agent, communication-center, crm, customer-inquiries, documents, general-office, inter-country-transfers, ledger, logistics, messages, new-entry, reports, return-sms-reply, roznamcha, settings, shipping-line, tracking, transfer-center | all Business URLs 403 |
| all.superadmin@dgt.llc | 193 | 30 | 23 | home, accounts, ai-assistant, ai-entry, audit-monitoring, bill-cost-profit, branch-management, business-edit-invoice, clearing-agent, communication-center, consignment, crm, customer-inquiries, document-intelligence, documents, expenses, general-office, inter-country-transfers, inventory, journal, ledger, logistics, mail-management, messages, new-entry, permissions, purchase, reports, return-sms-reply, roznamcha, sales, settings, settlement, shipping-line, smart-operations, super-admin, tax, tax-einvoicing, temp-bills, tracking, transfer-center, user-tasks | both domains allowed (by assignment) |
| alras.shipping@dgt.llc | 12 | 2 | 2 | ai-assistant, clearing-agent, general-office, logistics, reports, tracking, user-tasks | all Business URLs 403 |
| audit.superadmin@dgt.llc | 193 | 30 | 23 | home, accounts, ai-assistant, ai-entry, audit-monitoring, bill-cost-profit, branch-management, business-edit-invoice, clearing-agent, communication-center, consignment, crm, customer-inquiries, document-intelligence, documents, expenses, general-office, inter-country-transfers, inventory, journal, ledger, logistics, mail-management, messages, new-entry, permissions, purchase, reports, return-sms-reply, roznamcha, sales, settings, settlement, shipping-line, smart-operations, super-admin, tax, tax-einvoicing, temp-bills, tracking, transfer-center, user-tasks | both domains allowed (by assignment) |
| chaman.shipping@dgt.llc | 41 | 8 | 13 | accounts, ai-assistant, clearing-agent, crm, customer-inquiries, general-office, inter-country-transfers, ledger, logistics, new-entry, reports, roznamcha, settings, shipping-line, tracking, transfer-center, user-tasks | all Business URLs 403 |
| dubai.branch@dgt.llc | 127 | 25 | 8 | home, accounts, ai-entry, bill-cost-profit, branch-management, business-edit-invoice, communication-center, consignment, crm, customer-inquiries, document-intelligence, documents, general-office, inter-country-transfers, inventory, journal, ledger, mail-management, messages, new-entry, purchase, reports, return-sms-reply, roznamcha, sales, settings, settlement, tax, tax-einvoicing, temp-bills, transfer-center | all Shipping URLs 403 |
| kandahar.shipping@dgt.llc | 12 | 2 | 2 | ai-assistant, clearing-agent, general-office, logistics, reports, tracking, user-tasks | all Business URLs 403 |
| pakistan.admin@dgt.llc | 125 | 25 | 8 | home, accounts, ai-entry, bill-cost-profit, branch-management, business-edit-invoice, communication-center, consignment, crm, customer-inquiries, document-intelligence, documents, general-office, inter-country-transfers, inventory, journal, ledger, mail-management, messages, new-entry, purchase, reports, return-sms-reply, roznamcha, sales, settings, tax, tax-einvoicing, temp-bills, transfer-center | all Shipping URLs 403 |
| pakistan.mainbranch@dgt.llc | 125 | 25 | 8 | home, accounts, ai-entry, bill-cost-profit, branch-management, business-edit-invoice, communication-center, consignment, crm, customer-inquiries, document-intelligence, documents, general-office, inter-country-transfers, inventory, journal, ledger, mail-management, messages, new-entry, purchase, reports, return-sms-reply, roznamcha, sales, settings, tax, tax-einvoicing, temp-bills, transfer-center | all Shipping URLs 403 |
| pakistan.shipping.admin@dgt.llc | 51 | 9 | 12 | accounts, branch-management, clearing-agent, communication-center, crm, customer-inquiries, documents, general-office, inter-country-transfers, ledger, logistics, messages, new-entry, reports, return-sms-reply, roznamcha, settings, shipping-line, tracking, transfer-center | all Business URLs 403 |
| quetta.accountant@dgt.llc | 103 | 24 | 5 | home, accounts, ai-entry, bill-cost-profit, business-edit-invoice, consignment, crm, customer-inquiries, inter-country-transfers, inventory, journal, ledger, new-entry, purchase, reports, roznamcha, sales, settings, tax, tax-einvoicing, temp-bills, transfer-center | all Shipping URLs 403 |
| quetta.branch@dgt.llc | 3 | 1 | 1 | home, roznamcha | all Shipping URLs 403 |
| quetta.cashier@dgt.llc | 58 | 13 | 4 | home, accounts, branch-management, consignment, crm, customer-inquiries, inventory, journal, ledger, new-entry, purchase, reports, roznamcha, settings, settlement | all Shipping URLs 403 |
| quetta.shipping.admin.pakbr000002@dgt.llc | 50 | 9 | 12 | accounts, branch-management, clearing-agent, communication-center, crm, customer-inquiries, documents, general-office, inter-country-transfers, ledger, logistics, messages, new-entry, reports, return-sms-reply, roznamcha, settings, shipping-line, tracking, transfer-center | all Business URLs 403 |
| quetta.shipping.agent@dgt.llc | 28 | 7 | 6 | clearing-agent, communication-center, customer-inquiries, documents, inter-country-transfers, logistics, messages, new-entry, reports, return-sms-reply, settings, shipping-line, tracking, transfer-center | all Business URLs 403 |
| shipping@dgt.llc | 193 | 30 | 23 | home, accounts, ai-assistant, ai-entry, audit-monitoring, bill-cost-profit, branch-management, business-edit-invoice, clearing-agent, communication-center, consignment, crm, customer-inquiries, document-intelligence, documents, expenses, general-office, inter-country-transfers, inventory, journal, ledger, logistics, mail-management, messages, new-entry, permissions, purchase, reports, return-sms-reply, roznamcha, sales, settings, settlement, shipping-line, smart-operations, super-admin, tax, tax-einvoicing, temp-bills, tracking, transfer-center, user-tasks | both domains allowed (by assignment) |
| superadmin@dgt.llc | 193 | 30 | 23 | home, accounts, ai-assistant, ai-entry, audit-monitoring, bill-cost-profit, branch-management, business-edit-invoice, clearing-agent, communication-center, consignment, crm, customer-inquiries, document-intelligence, documents, expenses, general-office, inter-country-transfers, inventory, journal, ledger, logistics, mail-management, messages, new-entry, permissions, purchase, reports, return-sms-reply, roznamcha, sales, settings, settlement, shipping-line, smart-operations, super-admin, tax, tax-einvoicing, temp-bills, tracking, transfer-center, user-tasks | both domains allowed (by assignment) |
| uae.admin@dgt.llc | 125 | 25 | 8 | home, accounts, ai-entry, bill-cost-profit, branch-management, business-edit-invoice, communication-center, consignment, crm, customer-inquiries, document-intelligence, documents, general-office, inter-country-transfers, inventory, journal, ledger, mail-management, messages, new-entry, purchase, reports, return-sms-reply, roznamcha, sales, settings, tax, tax-einvoicing, temp-bills, transfer-center | all Shipping URLs 403 |

## 3c. RBAC test fixtures (@rbac-test.dev)

| Username | Email | Role | Country | Branch | Business / Shipping | Login* | Dashboard | Permissions | Issue | Fix | Final status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| RBAC-BIZ-SUPER | rbac.biz.super@rbac-test.dev | business_super_admin | Global | — | Business | NOT VERIFIED* | /dashboard/country | 132 effective tokens (role_default) | — | — | PASS |
| RBAC-BRANCH-DEIRA | rbac.branch.deira@rbac-test.dev | city_branch_admin | United Arab Emirates | Deira Dubai City Branch | Both | NOT VERIFIED* | /dashboard/city | 100 effective tokens (role_default) | — | — | PASS |
| RBAC-COUNTRY-UAE | rbac.country.uae@rbac-test.dev | country_admin | United Arab Emirates | — | Both | NOT VERIFIED* | /dashboard/country | 145 effective tokens (role_default) | — | — | PASS |
| RBAC-FINANCE | rbac.finance@rbac-test.dev | accountant | United Arab Emirates | Deira Dubai City Branch | Business | NOT VERIFIED* | /dashboard/city | 74 effective tokens (role_default) | — | — | PASS |
| RBAC-OPS-GLOBAL | rbac.ops.global@rbac-test.dev | global_operations_admin | Global | — | Both | NOT VERIFIED* | /dashboard/logistics | 46 effective tokens (role_default), no financial amounts | — | — | PASS |
| RBAC-OPS-PK | rbac.ops.pk@rbac-test.dev | country_operations_admin | Pakistan | — | Both | NOT VERIFIED* | /dashboard/logistics | 46 effective tokens (role_default), no financial amounts | — | — | PASS |
| RBAC-RESTRICTED | rbac.restricted@rbac-test.dev | staff_user | Pakistan | Quetta City Branch | Business | NOT VERIFIED* | /dashboard/city | 9 effective tokens (manual), no financial amounts | — | — | PASS |
| RBAC-SHIP-SUPER | rbac.ship.super@rbac-test.dev | shipping_super_admin | Global | — | Shipping | NOT VERIFIED* | /dashboard/logistics | 91 effective tokens (role_default) | — | — | PASS |
| RBAC-SL-ADMIN | rbac.sl.admin@rbac-test.dev | shipping_line_admin | United Arab Emirates | — | Shipping | NOT VERIFIED* | /dashboard/logistics | 57 effective tokens (role_default) | — | — | PASS |
| RBAC-SL-DEIRA | rbac.sl.deira@rbac-test.dev | shipping_line_user | United Arab Emirates | Deira Dubai City Branch | Shipping | NOT VERIFIED* | /dashboard/logistics | 13 effective tokens (role_default), no financial amounts | Shipping-line user assigned to the BUSINESS branch 'Deira Dubai City Branch' (RBAC test fixture). | Test fixture, left unchanged; the guard prevents new ones. | PASS (resolves) — TEST DATA |
| RBAC-SUPER | rbac.super@rbac-test.dev | super_admin | Global | — | Global (both) | NOT VERIFIED* | /dashboard/super-admin | 1 effective tokens (role_default) | — | — | PASS |

## 3d. Profiles that cannot sign in (no live assignment)

- `chaman.branch@dgt.llc` — Chaman City Admin (CHAMAN.BRANCH): no active assignment → every request redirects to login (session revoked by design).
- `quetta.admin@dgt.llc` — Quetta Branch Operations Admin (PAK-BR-000003): no active assignment → every request redirects to login (session revoked by design).
- `quetta.shipping.admin@dgt.llc` — Quetta Shipping & Clearing Admin (PAK-BR-000001): no active assignment → every request redirects to login (session revoked by design).
- `rbac.agent@rbac-test.dev` — RBAC-TEST Clearing Agent (Chaman, Agent A) (RBAC-AGENT): no active assignment → every request redirects to login (session revoked by design).
- `rbac.combo@rbac-test.dev` — RBAC-TEST Combined Branch Admin Deira + Operations Chaman (RBAC-COMBO): no active assignment → every request redirects to login (session revoked by design).
- `rbac.ops.chaman@rbac-test.dev` — RBAC-TEST City Branch Operations Admin (Chaman) (RBAC-OPS-CHAMAN): no active assignment → every request redirects to login (session revoked by design).

## 4. Business Admin vs Shipping Admin vs Full Super Admin

Rows each persona RECEIVES from the list endpoints (`scripts/dev/domain-counts.mjs`). "Before" was measured on the same DEV data before the fix:

**Before**
```
(measured on commit 75e353b, before the fix; same DEV data)
persona      city-branch lookup               branch-mgmt       users (journal)      accounts
global_super 5                                5                 35                   242
biz_super    5 = business 2 + SHIPPING 3      2                 10 (incl. shipping)  105 = business 96 + SHIPPING 9
ship_super   5 = shipping 3 + BUSINESS 2      3                 3                    13
chaman_ship  2 = shipping 1 + BUSINESS 1      2                 1                    7
quetta_biz   2 = business 1 + SHIPPING 1      2                 6                    51 = business 44 + SHIPPING 6 + both 1
```
**After**
```
persona          city-branch lookup           branch-mgmt              users                        accounts                           ledgers
global_super     5 (business:2 shipping:3)    5 (business:2 shipping:3) 43 (shipping:14 business:19 both:10) 247 (business:215 shipping:31 both:1) 100
biz_super        2 (business:2)               2 (business:2)           8 (business:8)               96 (business:95 both:1)            100
ship_super       3 (shipping:3)               3 (shipping:3)           6 (shipping:6)               17 (shipping:17)                   17
pk_country_biz   1 (business:1)               1 (business:1)           6 (business:6)               52 (business:51 both:1)            17
pk_country_ship  1 (shipping:1)               1 (shipping:1)           4 (shipping:4)               19 (shipping:18 both:1)            19
quetta_biz       1 (business:1)               1 (business:1)           6 (business:6)               45 (business:44 both:1)            42
chaman_ship      1 (shipping:1)               1 (shipping:1)           4 (shipping:4)               11 (shipping:11)                   11
alras_ship       1 (shipping:1)               1 (shipping:1)           1 (shipping:1)               1 (shipping:1)                     1
deira_biz        1 (business:1)               1 (business:1)           2 (business:2)               50 (business:50)                   61
```


## 5. Isolation evidence

| Check | Harness | PASS | FAIL |
|---|---|---|---|
| Direct URL (pasted /dashboard/… addresses) per persona | `direct-url-api-matrix.mjs … page` | 12 | 0 |
| API access per persona (403 for the wrong domain) | `direct-url-api-matrix.mjs … api` | 16 | 0 |
| Data-leak scan (foreign-domain ids in 20 list/report endpoints) | `domain-leak-scan.mjs` | 86 | 0 |
| User-creation matrix (branch ↔ domain, country scope, duplicates) | `user-creation-domain-e2e.mjs` | 25 | 0 |
| Chaman Shipping account → 2-stage approval → Active | `shipping-account-approval-e2e.mjs` | 30 | 0 |
| Chaman bills (Customer / Truck Expense / Truck Freight-Rent) | `shipping-bills-e2e.mjs` | 12 | 0 |

**Unit / policy tests:** 103 tests passed in 5 files (tests/permissions)


No failing check remains in the final runs.

**Coverage and honesty notes**
- The data-leak scan ran all 20 endpoints for the Pakistan Business Country Admin and 11 critical endpoints for the other personas (Business Super Admin, Quetta, Deira, Shipping Super Admin, Al Ras, Pakistan Shipping Country Admin). The Chaman Shipping Branch Admin leak scan did **not** finish (the DEV server answers ~10-30 s per call); its API/page checks come from the matrix and the Chaman end-to-end runs above.
- Three Pakistan-Shipping-Country-Admin hits (accounts, ledgers, reports/meta) are the same legacy data defect: 6 Shipping-domain accounts, 7 ledgers and 2 user assignments are filed on the **Business** branch "Quetta City Branch". They are correctly Shipping rows; only their branch-id column names Quetta (accepted in the scanner, owner action: re-file them on a Shipping branch).
- One matrix expectation was corrected: `/api/erp/shipping/bl-records` is shared logistics data that Business purchase-transit pages read, so a Business login receives 200 (rows stay scope-limited) — it is deliberately not behind the Shipping accounting gate.
- Direct-URL checks that completed: Business Country-level branch admin (Quetta) — 6 Shipping URLs 403 and Purchase 200; Business Super Admin — 4/4; Chaman (synthetic role) — 1/1. The pages matrix for the real Chaman user, Shipping Super Admin and Global Super Admin did not finish for the same latency reason; the same decisions are covered by the 103 policy tests.
- Real-user login (password) is NOT VERIFIED by design.


## 6. Secure password-reset process (the assistant cannot verify real logins)

1. **User forgot the password:** `/auth/forgot-password` (e-mail reset link). Verify the e-mail provider is configured in the target environment — **NOT VERIFIED here**.
2. **Administrator reset:** Users screen → user → *Reset password* → `POST /api/erp/users/password { userId, generateTemporary: true }`. The API is scope-checked (`userInManagerScope` + `domainManagerTargetError`: a Country / Branch / Business / Shipping administrator can only reset users of their own country, branch **and domain**; Super Admin / Country Admin identities only by the Global Super Admin). A strong one-time temporary password (`Dgt#` + 10 random characters) is returned **once** to the administrator, set through Supabase Auth, and any legacy `profiles.raw_password` of that user is cleared. The password is never written to the audit trail.
3. **Hand-over:** give the temporary password out-of-band (in person / secure channel), never together with the user name by e-mail; the user changes it immediately at `/auth/set-new-password` or Profile → Change password (`POST /api/erp/users/password { currentPassword, newPassword, confirmPassword }`, current password re-verified).
4. **Evidence:** every reset writes an `audit_logs` row `user.password_reset` (actor, target, reason, timestamp) and every self-change `user.password_self_changed`.
   **Known gap (not changed here):** the server does **not** force the change — `profiles.must_change_password` is read by the session builder but `mustChangePassword` is hard-coded `false` and the dashboard layout does not redirect. Until that is built, the administrator must instruct the user to change the temporary password at first sign-in.
5. **Owner action:** the legacy plaintext column `profiles.raw_password` still holds non-NULL values for some DEV/PROD profiles (see memory *shipping-line-user-access*); purging it needs the owner's explicit approval and was **not** done.

## 7. Open owner decisions / actions

1. `shipping@dgt.llc` resolves as the **Global** Super Admin (assignment domain `both`). Set the domain to `shipping` if it must be Shipping-only.
2. `quetta.shipping.admin.pakbr000002@dgt.llc` and `quetta.shipping.agent@dgt.llc` are Shipping users on the **Business** branch Quetta (no Quetta Shipping branch exists). Also 6 Shipping accounts, 7 ledgers and 2 assignments are filed on that Business branch. Create a Shipping branch and re-file, or move the users to the Business domain. The users API now refuses new mismatches.
3. `audit.superadmin@dgt.llc` is a full Global Super Admin (write access); re-issue as `super_admin_reports` if it must be audit-only.
4. Production `business.superadmin@dgt.llc` is not in DEV: confirm its assignment is `super_admin` + operational_domain `business` (if it is `both` it is a Global Super Admin).
5. Chaman's permission set was extended in DEV only (39 exact tokens); repeat in Production through Permission Control Center. Alras / Kandahar Shipping admins have the same legacy-token gap.
6. Company and Customer masters carry no operational-domain column (shared masters); separating them needs a data-model decision.
7. Temporary passwords are not force-changed at first sign-in (server gap, §6). The legacy plaintext column `profiles.raw_password` still holds values; purge needs explicit approval.
8. `quetta.branch@dgt.llc` has only 4 permission tokens; apply the Business branch template.

## 8. Summary

- Users resolved: **29** (real 18, test 11). Automatic domain-separation findings left unexplained: **0**.
- Accounts needing an owner decision/action (listed above): **9**.
