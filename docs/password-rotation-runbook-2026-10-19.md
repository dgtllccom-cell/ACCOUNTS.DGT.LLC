# Plaintext-password remediation — result and rotation runbook (2026-10-19)

## Done on Production (owner-approved, 2026-10-19)
| Step | Result |
|---|---|
| Fresh verified backup (taken over the direct session connection) | `/root/backups/prod-before-pw-scrub-20261019-182212.dump`, 84.6 MB, 8,494 restore entries; the dump still contains the old values, so the file is `chmod 600` in a `700` directory — **delete it after the safety period** |
| Dependency audit | Login verifies `auth.users.encrypted_password` (pgcrypto) and Supabase Auth. No runtime code reads `profiles.raw_password`; the only writers set it to `NULL`. Only seed/debug scripts and generated types mention it |
| Scrub migration `20261238_scrub_profiles_raw_password.sql` | **62 rows → NULL**, 0 non-empty values remain. 75 profiles, 14 active profiles, 14 active assignments, 77 auth users, translation trigger re-enabled, business tables unchanged |
| Smoke test | Live login route with an invalid credential answers 401 (not 500) |
| Backup role `codex_backup_1785611851964` | NOLOGIN, no members, `BYPASSRLS`, SELECT on all 166 tables. It cannot connect by itself; recommended to drop it (`DROP OWNED BY … ; DROP ROLE …`) — **not done, needs the owner's yes** |

## Not done (by design)
- Column-level REVOKE: `anon`/`authenticated` hold table-wide grants; revoking one column would break any `select *` on `profiles`. With every value NULL there is nothing to read, so this is skipped.
- `ALTER TABLE public.profiles DROP COLUMN raw_password` — scheduled for **2026-10-26 or later** as a separate reviewed migration (remove the column from `scripts/seed-*.mjs`, `scripts/*debug*`, `lib/supabase/types.ts` first).

## Password rotation — the 14 active users
Only two of the 14 have ever signed in (`SUPERADMIN`, `22222222` Shipping Line Super Admin). The other 12 have never logged in, so their stored values were never-used initial passwords. Because those values existed in the database and in backups, treat them as compromised and replace them **before first use**.

| Group | User codes |
|---|---|
| Super Admin | SUPERADMIN, 22222222, (Business Super Admin — no user code) |
| Country Admin | AFG-CA-000001, PAKISTAN.ADMIN, UAE.ADMIN |
| Main Branch Admin | PAK-MA-000001 |
| City Branch Admin | ALRAS.SHIPPING, CHAMAN.BRANCH, CHAMAN.SHIPPING, DUBAI.BRANCH, QUETTA.BRANCH, SHIPPING |
| Staff | USR-2051 |

Procedure (no password is ever written to a log, ticket or chat):
1. Sign in as Super Admin → **Users** → select the user → **Reset password** (generates a temporary password, shown once on screen; API: `POST /api/erp/users/password { userId, generateTemporary }`).
2. Hand the temporary password to the user over a private channel and ask them to change it at first sign-in (**gap:** `must_change_password` is read but not enforced by the server — tracked as a code follow-up).
3. Super Admin accounts first, then country admins, then branch admins.
4. Do not reset a user who is currently working until they know; resetting does not change roles, scope or data.
