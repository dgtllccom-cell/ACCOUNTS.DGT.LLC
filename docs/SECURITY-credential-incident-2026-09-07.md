# Security incident — hardcoded Super Admin credential & plaintext password fields

**Date:** 2026-09-07
**Branch:** `security/plaintext-credential-cleanup` (off `origin/main` @ `82b09ea`)
**Severity:** High — a Super Admin credential was committed to `main` (and is running in Production), and several APIs returned plaintext user passwords.

---

## 1. What happened

`main` moved past the frozen release `94a7b6d`. The current `main` / `origin/main` / **Production** HEAD is:

```
82b09ea  feat(reports): apply VIP SuperAdminReportView design to reports and update Super Admin password to <redacted>
```

Commit `82b09ea`:

- put a **plaintext Super Admin password in the commit message**;
- hardcoded that same password as an accepted literal in `app/api/erp/auth/login/route.ts` and `features/auth/actions.ts` (in addition to the pre-existing `"Admin@123"` literal), so it was accepted **regardless of the demo-auth gate**;
- added `scripts/change-superadmin-password.mjs`, which writes that plaintext value into `profiles.raw_password` for **LOCAL and PROD** and prints it to the console.

Separately, pre-existing code:

- `profiles.raw_password` is a **plaintext password column** (migration `0037`). It was:
  - **returned** by `GET /api/erp/users/journal-report` (`rawPassword`), `GET /api/branch-management/general-report` (`temporaryPassword`), `GET /api/erp/users/login-management` (`temporaryPassword`);
  - **written** on every user create/update by `POST/PATCH /api/erp/users`;
  - **compared** as a valid login path in `app/api/erp/auth/login/route.ts` (plaintext == submitted password), unconditionally;
  - **displayed** (with reveal/copy) in `features/branch-management/components/branch-general-report-view.tsx`, `features/users/components/user-journal-report.tsx`, `app/dashboard/new-entry/users/all/page.tsx`;
- an `Admin@123` + `<city>@dgt.llc` login shortcut existed in `login/route.ts`;
- ~20 seed/provisioning scripts hardcode admin/superadmin passwords (`Password123!`, `Admin@123`, `TestUser@1234`, `DevTest@12345`, `Dgt<City>123`) and several SSH to Production;
- **`scripts/vps-db-probe.mjs` and `scripts/test-db-dns.mjs` hardcoded a Supabase Postgres password** (a real DB credential, project ref `csesvyxqjivnkkozgopt`). `scripts/sync-supabase-db.mjs` used it as a fallback. **This DB password must be rotated in the Supabase dashboard (Settings → Database → Reset database password) and every consumer's connection string / env updated.**

## 2. What this branch fixes (code — done, no secrets in the diff)

| Area | Change |
|---|---|
| `app/api/erp/auth/login/route.ts` | Removed every hardcoded password literal. Bootstrap Super Admin login now requires `BOOTSTRAP_SUPERADMIN_PASSWORD` env **and** demo auth (never a default). Removed the `Admin@123` + `@dgt.llc` shortcut. The `profiles.raw_password` plaintext compare is now **off unless demo auth is on**, with an `ALLOW_LEGACY_RAW_PASSWORD_LOGIN=true` recovery hatch. |
| `features/auth/actions.ts` | Same — env-only bootstrap password, no literals. |
| `POST/PATCH /api/erp/users` | No longer writes `profiles.raw_password`. Credential goes only to Supabase Auth (hashed). |
| `GET /api/erp/users/journal-report` | No longer selects or returns any password field. |
| `GET /api/branch-management/general-report` | No longer selects `raw_password` or returns `temporaryPassword`. |
| `GET /api/erp/users/login-management` | Same. |
| UI (`branch-general-report-view`, `user-journal-report`, `users/all`, `admin-user-management-panel`, `user-live-report-panel`, `user-profile-report-modal`, `user-registration-wizard`, `open-user-a4-report-window`) | Removed plaintext-password columns / reveal / copy / audit-reason text. |
| `features/branch-management/services/hierarchy-service.ts` | `"ChangeMe123!"` → random one-time password. |
| Scripts | Deleted 21 obsolete scripts that carried credentials or targeted Production: `change-superadmin-password.mjs`, `generate-pdf.mjs` (credential list), the VPS superadmin seeders (`create-vps-superadmins.mjs`, `vps_create_admins.mjs`, `vps-stable-seed.mjs`, `vps_seed_stable.mjs`, `seed-vps-core.mjs`, `vps_seed_core.mjs`, `vps-deep-audit-and-clean.mjs`, `vps_deep_clean.mjs`), the DB-password probes (`vps-db-probe.mjs`, `test-db-dns.mjs`, `find-local-postgres-password.mjs`, `check-local-postgres.mjs`, `migrate-data-from-remote-to-local.mjs`), `clean-purchase-vps.mjs`, `db-standardize-branches-users.mjs`, `tmp-browser-qa.mjs`, `tmp-kyc-fetch.mjs`. `seed-superadmin.mjs` / `setup-admins.mjs` / `db-ensure-country-branch-users.mjs` / `sync-supabase-db.mjs` now **require an env var** and stop writing/printing plaintext. |
| `supabase/migrations/20261111_scrub_superadmin_raw_password.sql` | Nulls `profiles.raw_password` for the bootstrap Super Admin (non-destructive). |

## 3. What the owner must still do (cannot be automated safely)

1. **Rotate the Super Admin credential in Supabase Auth** — set a new strong password for `superadmin@damaan.com` via the Supabase dashboard (Authentication → Users) or an admin API call from a secure machine. Do this now; the old value is in public commit history.
2. **Rotate the other admin passwords** that were hardcoded (`Password123!`, `Dgt<City>123`, …) for any account that exists in Production.
3. **Broad plaintext scrub** (after confirming every active account has a Supabase Auth entry — run the check below):
   ```sql
   -- how many active profiles have NO matching auth.users row?
   select count(*) from public.profiles p
   left join auth.users u on u.id = p.id
   where p.deleted_at is null and u.id is null;
   -- if that is 0, it is safe to run:
   update public.profiles set raw_password = null where raw_password is not null;
   -- then, in a later migration, drop the column:
   -- alter table public.profiles drop column raw_password;
   ```
4. **Purge the secret from git history.** The password is in the message and diff of `82b09ea`, which is on `origin/main` and every clone. Options, in order of preference:
   - If acceptable to rewrite `main`: `git filter-repo` (or BFG) to redact the commit message + the `login/route.ts` / `actions.ts` / `change-superadmin-password.mjs` blobs, then coordinated force-push and have every worktree/clone re-clone. The VPS auto-deploy pulls `main`, so schedule this.
   - If a history rewrite of `main` is too disruptive: treat the credential as permanently compromised (step 1 already does), and at minimum `git commit` a follow-up that removes the literals (this branch) so `HEAD` is clean going forward.
   - Either way: enable GitHub secret scanning / push protection on the repo.
5. **Set env on Production** (`/var/www/dgt-nextjs/.env`): ensure `ALLOW_DEMO_AUTH=false`, do **not** set `BOOTSTRAP_SUPERADMIN_PASSWORD` or `ALLOW_LEGACY_RAW_PASSWORD_LOGIN` unless actively recovering a lockout.
6. **Rotate the Supabase DB password** (see §1) and update every connection string / `DATABASE_URL` that used it.
7. **Finish the seed-script sweep** — ~35 dev QA / seed scripts still contain dev-domain password literals (`Admin@123`, `DevTest@12345`, `TestUser@1234`, `AdminPassword123!`): `seed-dev-test-master-data.mjs`, `seed-database-users-accounts-employees.mjs`, `setup-all-upcountry-logins.mjs`, `setup-standardized-users.mjs`, `master-seed-everything.mjs`, `verify-*`, `e2e-*`, `capture-*`. Lower risk (dev domains, run against a local/dev server), but env-ify or delete them in a follow-up. None write to Production.

## 4. Release sequencing

Merge this branch to `main` **before** the report-redesign branch. Deploy, then do step 1 (rotate) immediately. The report redesign stays on `feat/report-redesign` until its own full verification.
