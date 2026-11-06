# Truck trial access and Shipping office daily rates

This release extends the existing Truck Registration, Person Master, Company Master and Daily Exchange Rate modules. It does not change the Roznamcha posting engine or DR/CR calculations, add financial records, add a database schema, or redesign the sidebar.

## Truck trial provisioning

The supplied `superadmin@dgt.llc` was verified as the Global Super Admin and was not modified. The owner subsequently confirmed the separate existing Salim staff account in Chaman Shipping. That account's existing assignment was retained and its custom permission set was replaced with the minimal truck trial bundle, with a before/after audit record. No new or duplicate user was created. Full live isolation still requires deploying this release and a fresh sign-in; configuration alone is not live acceptance proof.

After identity confirmation, use the existing User Management flow to assign a branch-level staff account and a **manual/custom** permission set matching `TRUCK_TRIAL_PERMISSIONS` in `lib/permissions/truck-trial.ts`. Do not assign an admin role, a wildcard, or a global scope. A trial requires exactly one country, one main branch and one city branch. Require a fresh sign-in when applying this restriction to an existing account so its signed session contains the restriction.

The marker caps inherited grants, the shared route policy filters the existing sidebar, and the signed cookie + middleware + server session guard restrict API paths and methods. Trial sessions cannot fall back to broad role defaults when the database is unavailable. Truck lists and the server-rendered report are scoped to the assigned branch; update/delete operations and financial endpoints are denied.

Owner and Driver additions open the existing embedded Person Master with the proper type. Typed missing names open that form rather than silently creating a generic person. Company additions use the existing Company Master without account linkage. Save callbacks select the created master and preserve the truck draft. Existing Truck A4/PDF builders remain unchanged.

## Shipping office daily rates

The verified Chaman Shipping user already had Cash create/read/post permissions. Requested country-rate read/create/update permissions were added to that user's existing permission set, with a before/after audit record. No role, branch assignment, global privilege, rate value or financial entry was changed.

Daily rates remain country-wide and shared by Business and Shipping branches. The API enforces the requested country's scope and separate create/update grants. Corrections require an explicit reason and retain old/new rates in audit history. The operator identity comes from the authenticated session.

The rate form previously displayed a provisional row before the API succeeded; a rejected write left a fictitious saved-looking rate on screen. It now shows only persisted rates. Choosing a country no longer silently changes today's date to the last saved historical date. Operator wall-clock time is converted to UTC using the submitted timezone offset. Cash Entry refreshes the approved rate after returning to the tab.

The redirect for `/dashboard/currency/daily-rates` was merged in PR #56. The canonical page remains `/dashboard/reports/exchange-rate`.

## Deployment and acceptance

Use the existing controlled deployment gate and verified backup/rollback process. No migration is needed. EPS must pass before Production is promoted. Confirm whether EPS is a separate host; no separate endpoint was available in this session. SSH to the supplied Production host was unreachable from this execution environment, so deployment, restart and live browser acceptance were not performed.

Use only the designated test database for temporary owners, drivers, companies, trucks and a PKR 20,000 DR/CR test. Use an explicitly approved rate for the intended test date, verify USD conversion and ledger effects, and test denial outside the assigned branch. Do not create trial financial transactions in Production. Verify the deployed SHA, both users' sign-in and navigation, owner/driver/company return selection, Truck print/PDF in five languages, rate save/correction/refresh, and capture authenticated screenshots before claiming live completion.
