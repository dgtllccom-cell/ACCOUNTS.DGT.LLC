# Security incidents & credential hygiene

## 2026-09-10 — `generate-country-users-pdf.mjs` publicly served credentials PDF

**What:** `scripts/generate-country-users-pdf.mjs` wrote a "Verified Credentials
Register" PDF listing all 8 TEST-project (`csesvyxxjivnkkozgopt`) demo users' emails
and a shared plaintext password into `public/Country_Branch_Users_Credentials_Register.pdf`
— anything under `public/` is served by Next.js unauthenticated. Two links in
`components/layout/dashboard-frame.tsx` ("ERP Credentials (PDF)", visible to every
logged-in user regardless of role) pointed straight at it. Confirmed live and
downloadable with no auth at `https://api.dgt.llc/Country_Branch_Users_Credentials_Register.pdf`
(`HTTP 200`) before this fix. The password literal was also split into
`["DgtAdmin","@","2026","!"].join("")` fragments in the script — a deliberate
obfuscation to dodge `repo-safety-guard.mjs`'s regex, not a rotation.

**Remediation:**
- Rotated `public.profiles.raw_password` for all 8 listed accounts on the TEST
  project (`superadmin@dgt.llc` got its own value via `scripts/rotate-debug-test-password.mjs`
  during the prior Accounts Report/security-cleanup pass; the other 7 share a new
  value set via a one-off rotation script, not committed).
- `generate-country-users-pdf.mjs` now reads `DGT_TEST_PASSWORD` /
  `DGT_DEMO_USERS_PASSWORD` from the environment (refuses to run without them) and
  writes its PDF to a local, git-ignored output path only — never `public/`.
- Deleted the tracked `public/Country_Branch_Users_Credentials_Register.pdf` and
  removed both "ERP Credentials (PDF)" links from `dashboard-frame.tsx`.
- No production data or accounts were involved — this was entirely the TEST
  project's demo-user set, per CLAUDE.md's DB policy.

## Guard

`scripts/repo-safety-guard.mjs` (`npm run safety:guard`) runs in `prebuild` and the
pre-commit hook. It **fails the build/commit** on:

- a plaintext credential literal anywhere in a version-controlled file
  (`password: '…'`, `<word>@<digits>!`);
- a loose script running destructive identity SQL
  (`DELETE FROM auth.users`, `DELETE FROM public.profiles`,
  `encrypted_password = crypt('literal', …)`).

Rotation happens through the Supabase Auth dashboard. User cleanup happens through a
reviewed, guarded migration — never a `scripts/*.mjs` that anyone with repo or VPS
read access can run or read.

---

## 2026-09-08 — `setup-three-superadmins.mjs` (plaintext credential + destructive auth)

**What:** commit `284aedc` (a DeployBot auto-commit sweeping a concurrent session's
work) added `scripts/setup-three-superadmins.mjs` and `scripts/vps-test-crypt.mjs`,
both containing the plaintext password **`Gulistan@123`**. The setup script also ran
`DELETE FROM auth.users WHERE id NOT IN (3 ids)` and the same on `public.profiles`.

**Ran against production?** Yes — prod `auth.users` and `public.profiles` are now
exactly 3 rows (Global / Shipping / Business super admin), all with
`encrypted_password = crypt('Gulistan@123', …)`, `updated_at` 2026-09-08 14:54 UTC.

**Data-loss assessment (prod):**
- 17 real customers, 1 country branch, 1 city branch — **intact**.
- 0 orphaned `created_by` / `user_id` references across the master tables checked
  (customers, enterprise_accounts, country/city branches, goods, employees,
  clearing_agents, user_role_assignments).
- 0 audit-log activity (and 0 logins) by any deleted account within the audit window
  (audit_logs start 2026-09-07). The deleted accounts were the dummy/seed users the
  owner had already flagged for cleanup (cf. blocked migration
  `20261008_cleanup_user_directory_master`).
- **Not 100% provable:** a never-used, never-logged-in staff account created before
  2026-09-07 would leave no trace. Owner should confirm from memory whether any real
  Country-Admin / Branch-User account existed on prod before today.

**Remediation:**
- ✅ `setup-three-superadmins.mjs` + `vps-test-crypt.mjs` + 3 read-only `vps-*` junk
  scripts deleted from the tree (commit below).
- ✅ `repo-safety-guard.mjs` added → prebuild + pre-commit.
- ⏳ **Owner must rotate `Gulistan@123`** on all 3 accounts (`superadmin@dgt.llc`,
  `shipping.superadmin@dgt.llc`, `business.superadmin@dgt.llc`) via Supabase Auth →
  Users → reset password. Until then it is a live login on `https://api.dgt.llc`.
- ⏳ `Gulistan@123` remains in git history at `284aedc` — history purge (BFG /
  `git filter-repo`) + force-push is owner-side, same as the 2026-09-07 incident.

## 2026-09-07 — `Admin@123` / Supabase DB password committed (prior incident)

See memory `credential-incident-2026-09-07`. `Admin@123` still present in
**gitignored** `scratch/*.mjs` (local only, never committed) and referenced in
`QA-REVIEW-ISSUES.md` (security-review notes). Owner rotation of the real Supabase
super-admin password still pending.

## Legacy destructive DEV-reset scripts (grandfathered in the guard)

`scripts/repo-safety-guard.mjs` → `EXEMPT` lists ~10 pre-existing
`db-*reset*` / `cleanup` / `vps-pg-clean` scripts. Each should be deleted or
converted to a reviewed migration. **Shrink that list.**

## Session-cookie secret — checked 2026-09-08, OK

`QA-REVIEW-ISSUES.md` C4: `getSessionSecret()` falls back to the literal
`"dev-insecure-erp-session-secret"` when the secret env vars are unset.
**Verified on the prod VPS: `ERP_SESSION_SECRET` is set** (non-empty in both `.env`
and `.env.local`) → the insecure fallback is not in use, cookie forgery not
exploitable. The fallback still ought to `throw` in production rather than default.
