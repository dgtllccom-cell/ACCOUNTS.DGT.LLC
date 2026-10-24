# Country Admin, Chaman delegation and Person Master — release evidence

Status: DRAFT / NOT APPROVED FOR PRODUCTION. No database connection, migration, user-role change or deployment was performed in this workspace.

Source: isolated `fix/scoped-user-delegation-20261024` branch based on `main` commit `003cae3c669d329598f9349c80ef1d3c45b9518b`. Remote `production` observed at `43ed2160acc11a698080bd2a4f2ca1cb2cf9d02f`. A remote ref is not proof of the running VPS version. The correct existing DEV integration branch must be confirmed before integration; neither `dev` nor `production` was overwritten.

## 1. UAE Country Admin

Confirmed code findings:

- `isUserManager` already recognizes the effective `country_admin` role. Its rejection of the actual UAE login cannot be attributed to a missing country-admin entry without inspecting that User ID's assignments and effective access profile.
- Registration's existing-login UI sent `use_existing`, but the API schema accepts `assign_scope`. The wire value is now mapped correctly.
- Shipping Branch Admin selected `main_branch_admin` even though the wizard resolves a city branch. It now selects `city_branch_admin`; internal shipping staff use `staff_user`, with external agent roles retained in the detailed selector for authorized managers.
- The creation API now validates saved city/main branch geography before allocating a user code or creating an Auth user. Caller-supplied country and branch IDs cannot be assumed to belong together.
- Country creation targets must match one authoritative country-admin assignment and its operational domain. The UI uses the same delegated-role allowlist. Administrative country/global roles remain restricted.
- Requested route permissions previously bypassed the creator's permission limit. They must now pass the same limit as other permission tokens.

Still blocked: exact UAE User ID, saved assignment, effective session, actual profile mismatch, both real user-creation workflows and entered-data retention under a real save failure. No role label was replaced or production assignment altered.

## 2. Chaman Branch Admin

Confirmed code findings:

- The existing manager predicate excludes `city_branch_admin` and blocks creation. The city role template also lacks `users:create`.
- A separate `isUserCreator` predicate now permits explicitly delegated city admins to create staff. It does not turn them into unrestricted existing-user managers: password reset, existing-user edits, login management and global permission-set changes keep their original manager gate.
- City creation requires an explicit effective `users:create` or `users:*` grant, a single active authoritative assignment and an exact country/main/city/domain match. It rejects administrative roles, external agent bindings, administrative access profiles, existing-login scope assignment and multi-scope delegation.
- No automatic grant was added to any existing user's role template or saved permission set. An authorized administrator must first validate whether Chaman's authoritative assignment includes delegated creation.

Still blocked: exact Chaman User ID, actual delegated permissions, Production branch classification, account-creation/visibility tests, display-name editing and actual shipping isolation. No branch ID or classification was changed. Do not substitute a new Chaman branch for the existing one.

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

`npm test -- tests/permissions tests/document-intelligence/party-match-and-modules.test.ts`: 172/172 passed across eight suites. The new API suite calls the real exported POST handler with mocked storage: 16 tests cover allowed UAE branch admin/staff, allowed delegated shipping staff, capped permissions and forbidden roles/countries/branches/domains/profiles/existing-scope changes. These are local API unit tests, not DEV or Production end-to-end evidence.

Repository safety, five-language UI parity, multilingual contract, navigation and Stock Journal guards passed. `git diff --check` passed. The default 2 GB TypeScript check ran out of heap; a 6 GB retry exited successfully without diagnostics. The clean non-incremental 6 GB TypeScript check also passed. The full Next build passed with offline placeholder credentials pointing only to 127.0.0.1:1. This verifies compilation and prerendering, not a configured DEV/Production deployment. No live build, database workflow, or browser screenshot is claimed here.

## Required access and release actions

1. The Supabase integration was offered for installation; it is not yet installed or connected. It may supply the database audit access after authorization, but it does not supply VPS SSH access. Securely supply this execution environment with the authorized DEV configuration for project `csesvyxxjivnkkozgopt`, read-only Production database access for `inmayhrxucimxqhgseqi`, and the approved VPS access. Do not put credentials in the repository, PR, or report.
2. Confirm the DEV integration branch and read the actual signed-in UAE and Chaman User IDs, active assignments, access profiles, permission-set sources, branch IDs/domain classifications and installed schema. Run the real workflows using authorized sessions. Resolve the remaining blockers above before marking this work ready.
3. Complete the combined build/regression and review against the then-current production source, preserving other agents' changes. Obtain the protected release review; merging this draft into `main` is not a Production deployment.
4. Follow `docs/production-deployment-control.md`: approved commit on `production`, verified required backups, then the owner's exact-commit approval through `dgt-approve-deploy <commit>` and execution through `dgt-deploy`. Do not use disabled legacy deployment scripts or approve an untested commit.
5. Verify live authorized workflows without adding fake Production users, accounts, customers or transactions. Attach actual screenshots, page URLs and PASS/FAIL results. Until then, all actual DEV/Production workflow rows are NOT RUN / BLOCKED.
