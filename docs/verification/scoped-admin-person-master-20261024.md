# Country Admin, Chaman delegation and Person Master — release evidence

Status: DRAFT / NOT APPROVED FOR PRODUCTION. The follow-up completed read-only audits of both connected Supabase projects. No database write, migration, user-role change or deployment was performed.

Source: isolated `fix/scoped-user-delegation-20261024` branch based on `main` commit `003cae3c669d329598f9349c80ef1d3c45b9518b`. Remote `production` observed at `43ed2160acc11a698080bd2a4f2ca1cb2cf9d02f`. A remote ref is not proof of the running VPS version. The correct existing DEV integration branch must be confirmed before integration; neither `dev` nor `production` was overwritten.

## 1. UAE Country Admin

Confirmed code findings:

- `isUserManager` already recognizes the effective `country_admin` role. Its rejection of the actual UAE login cannot be attributed to a missing country-admin entry without inspecting that User ID's assignments and effective access profile.
- Registration's existing-login UI sent `use_existing`, but the API schema accepts `assign_scope`. The wire value is now mapped correctly.
- Shipping Branch Admin selected `main_branch_admin` even though the wizard resolves a city branch. It now selects `city_branch_admin`; internal shipping staff use `staff_user`, with external agent roles retained in the detailed selector for authorized managers.
- The creation API now validates saved city/main branch geography before allocating a user code or creating an Auth user. Caller-supplied country and branch IDs cannot be assumed to belong together.
- Country creation targets must match one authoritative country-admin assignment and its operational domain. The UI uses the same delegated-role allowlist. Administrative country/global roles remain restricted.
- Requested route permissions previously bypassed the creator's permission limit. They must now pass the same limit as other permission tokens.

Still blocked: exact UAE signed-in User ID and effective session, both real user-creation workflows and entered-data retention under a real save failure. The only active UAE assignment found in the cloud Production project is Staff at main-branch scope; it is not promoted or assumed to be the reported login. No role label was replaced or production assignment altered.

## 2. Chaman Branch Admin

Confirmed code findings:

- The existing manager predicate excludes `city_branch_admin` and blocks creation. The city role template also lacks `users:create`.
- A separate `isUserCreator` predicate now permits explicitly delegated city admins to create staff. It does not turn them into unrestricted existing-user managers: password reset, existing-user edits, login management and global permission-set changes keep their original manager gate.
- City creation requires an explicit effective `users:create` or `users:*` grant, a single active authoritative assignment and an exact country/main/city/domain match. It rejects administrative roles, external agent bindings, administrative access profiles, existing-login scope assignment and multi-scope delegation.
- No automatic grant was added to any existing user's role template or saved permission set. An authorized administrator must first validate whether Chaman's authoritative assignment includes delegated creation.

Live read-only verification later identified the exact Chaman login as Staff and matched its saved Shipping assignment; its branch classification and account-read/cross-country rejection were verified. Remaining blockers: authorized admin designation/delegation, account save/visibility, display-name editing and complete shipping isolation. No branch ID or classification was changed. Do not substitute a new Chaman branch for the existing one.

## 3. Shared Person / Party Master

Confirmed existing architecture: `customers` is the shared identity referenced by `employees.person_master_id`, `profiles.person_master_id`, `companies.owner_person_id` and `companies.manager_person_id` in the repository's migration and service code. Application code is not proof that these migrations are installed in both databases.

Changes:

- Duplicate-name matching now preserves Unicode letters/numbers, so Urdu, Arabic, Persian and Pashto names do not normalize to empty strings. Compatibility normalization also handles full-width Latin names.
- Duplicate lookup errors stop creation while preserving form state; a failed search no longer silently proceeds to save.
- Drafts already linked to an existing person use `effectiveCustomerId` and bypass the new-record check before the existing update path.
- Matching remains a review aid. No fuzzy result is automatically merged, no IDs are rewritten, and no company/employee registration system is duplicated.

Still blocked: verified phone/ID duplicate protection through the actual API, company-owner/contact reuse, employee reuse, party-type form/preview/external wording, external submission review/approval, selector reuse and cross-domain/country isolation. The existing name check is not a complete identity uniqueness guarantee, and concurrent duplicate prevention has not been established.

Additional security review finding: `app/api/erp/general-office/person-detail/route.ts` authenticates a session but does not visibly authorize the selected person's country/branch relationships before returning linked roles/documents. This is an unresolved release blocker, not a security PASS. The country-only customer search and linked-record selectors also need an authenticated scope audit against the installed schema.

## Local verification

`npm test -- tests/permissions tests/document-intelligence/party-match-and-modules.test.ts`: 180/180 passed across nine suites after the live-discovered dashboard gate fix. The new API suite calls the real exported POST handler with mocked storage: 16 tests cover allowed UAE branch admin/staff, allowed delegated shipping staff, capped permissions and forbidden roles/countries/branches/domains/profiles/existing-scope changes. These are local API unit tests, not DEV or Production end-to-end evidence.

Repository safety, five-language UI parity, multilingual contract, navigation and Stock Journal guards passed. `git diff --check` passed. The default 2 GB TypeScript check ran out of heap; a 6 GB retry exited successfully without diagnostics. The clean non-incremental 6 GB TypeScript check also passed. The full Next build passed with offline placeholder credentials pointing only to 127.0.0.1:1. This verifies compilation and prerendering, not a configured DEV/Production deployment. No deployed-code success or business-record mutation workflow is claimed. The later live-read section records the authenticated browser evidence.

## Required access and release actions

1. Supabase is now connected and read-only access to both named projects is confirmed. It does not supply the running VPS configuration, SSH access or an authenticated ERP browser session. Securely supply this execution environment with the authorized DEV configuration for project `csesvyxxjivnkkozgopt`, read-only Production database access for `inmayhrxucimxqhgseqi`, and the approved VPS access. Do not put credentials in the repository, PR, or report.
2. Confirm the DEV integration branch and read the exact UAE signed-in User ID and confirm the intended administrative assignments. Chaman's actual signed-in Staff assignment and Shipping branch are now verified; do not promote it without authoritative designation. Confirm access profiles, permission-set sources and runtime database settings for release. Run the real workflows using authorized sessions. Resolve the remaining blockers above before marking this work ready.
3. Complete the combined build/regression and review against the then-current production source, preserving other agents' changes. Obtain the protected release review; merging this draft into `main` is not a Production deployment.
4. Follow `docs/production-deployment-control.md`: approved commit on `production`, verified required backups, then the owner's exact-commit approval through `dgt-approve-deploy <commit>` and execution through `dgt-deploy`. Do not use disabled legacy deployment scripts or approve an untested commit.
5. Verify live authorized workflows without adding fake Production users, accounts, customers or transactions. Attach actual screenshots, page URLs and PASS/FAIL results. Until then, all actual DEV/Production workflow rows are NOT RUN / BLOCKED.


## Connected Supabase follow-up — 24 October 2026

Read-only queries explicitly targeted DEV `csesvyxxjivnkkozgopt` and the project named Production `inmayhrxucimxqhgseqi`. No data was changed. Internal user identifiers and names are deliberately excluded from this public repository report.

| Finding | DEV | Named Production project |
| --- | --- | --- |
| Non-deleted profiles | 43 | 7 |
| Active, non-deleted assignments | 36 | 7 |
| Non-deleted shared identities | 213 | 5 |
| Employees with person links | 55 | 4 |
| Companies with owner-person links | 17 | 2 |
| Orphan employee/person links | 0 | 0 |
| Duplicate non-null person codes | 0 | 0 |

- Production's existing Chaman branch is active, `operational_domain=shipping`, `is_business_branch=false`. Its original branch ID was not changed or replaced.
- The named Production project's assignment table has no Country Admin or City Branch Admin rows. One active Chaman-linked login is saved as Staff with manual account create/read permissions. This is a candidate record, not proof of the user's currently signed-in identity. Do not promote it by inference.
- DEV has an active UAE business Country Admin candidate and an active Chaman shipping City Branch Admin candidate. The Chaman candidate has manual account create/read permissions but no saved user-creation grant. This supports keeping explicit delegation, not automatically granting creation to every branch admin.
- The application supports a direct DATABASE_URL and Supabase-backed reads/authentication. The named cloud project is not proven to be the live VPS datasource. The later authenticated verification resolves that difference for Chaman: the inspected login really is Staff, matching the saved record, while its dashboard title falsely implies admin status. UAE identity remains unverified.
- DEV already reuses two person identities as both Employee and Company Owner (three employee links, two company links). This is read-only evidence of existing reuse, not a new owner-relationship creation or approval test.
- Both projects have installed Employee and Company foreign keys to the shared identity. DEV profile person/employee identifiers are text columns whereas Production uses UUID foreign keys. DEV text values had zero invalid UUID strings; no conversion or migration was attempted.
- Security advisors were read. They report pre-existing findings, including security-definer views in both projects and public tables without RLS in Production. No bulk security changes were made. Security remains NOT VERIFIED for release.

GitHub CI follow-up: the first build run stopped in the safety guard because the new mocked API test contained a literal synthetic password. The local guard had initially omitted the untracked test file. The fixture now generates its value at runtime; all new files were staged before re-running the full guard. All 172 tests passed again. The guard was not bypassed, and no real credential was involved. The amended commit must pass GitHub CI before integration.


## Authenticated Chaman live verification and additional root cause

A secure browser sign-in completed against `https://api.dgt.llc`. The authenticated session API returned Staff as both the saved/effective role, Shipping as the only operational domain and the existing Chaman branch scope. The session User ID and scope exactly match the read-only cloud Production candidate previously inspected. This login has account read/create and the specific account-setup route grant, but no user-management grant. Its Staff profile label is therefore consistent with its authoritative saved assignment; no promotion was performed. The earlier datasource uncertainty is resolved for this particular Chaman login, not for an unseen UAE login or every backend connection.

The live City Dashboard independently displays a hard-coded Branch Admin Dashboard title even for this Staff login. The component now uses the existing translated City Branch Dashboard title, avoiding any claim of administrative authority. The profile remains backed by the saved role.

Actual read-only live API/UI evidence, before deployment:

| Workflow | Observed result |
| --- | --- |
| Authenticated session API | Staff, Shipping, assigned Chaman branch; matches saved assignment |
| Account-list API for assigned Chaman country/branch | Allowed; empty account list |
| Account-list API requesting UAE | Rejected with FORBIDDEN / country-scope error |
| User-detail API under Staff login | Rejected as not authorized |
| New Account Setup page | Sidebar offers it, but content says Form Access Restricted |

The account-form failure is a separate confirmed code defect: DashboardFrame has an extra Shipping-prefix blacklist covering all account and user-entry pages. The server and sidebar use evaluateRouteAccess and permit allotted operational accounts, while the client blacklist overrides that decision. DashboardContentGate now uses the same canonical policy as the server/sidebar; backend row/domain guards remain in place. The canonical policy additionally prevents a lower role's saved route token from opening pages whose sole authority is Super Admin.

Eight rendered-component regression tests cover allotted Shipping account/user-entry forms and denied unallotted, purchase, sales, Super Admin and strict-operations finance access. All 180 selected tests and the full TypeScript check passed after this change. The amended offline full build passed (449 generated pages), as did the full TypeScript check and all local guards. GitHub checks must also pass on the amended commit before integration. The prior commit a6830e1 passed all three GitHub checks.

No Production form was submitted, account created, user promoted or permission set changed during live verification. Account save/visibility, authoritative admin delegation, UAE sign-in and Person Master mutation/approval workflows remain NOT RUN. A private screenshot of the observed account-form restriction was retained outside this public repository.
