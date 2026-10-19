# Production database hardening — assessment and plan (2026-10-19)

Status: **ASSESSMENT ONLY. Nothing in this document has been applied to Production.** Both changes need the owner's specific approval after the checks below.
Production project: `inmayhrxucimxqhgseqi`. All Production queries used for this assessment were read-only.

---

## 1. Connection pooler: session mode (5432) → transaction mode (6543)

### Problem (evidence)
- The live app's `DATABASE_URL` is `…pooler.supabase.com:5432` = Supabase **session** pooler, `pool_size` 15.
- The live log shows `(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15` (31 occurrences in the last 4,000 log lines) → HTTP 500 for the request that lost the race.
- `withLocalPg()` opens a **new connection per call** (`max: 1`) and several routes fan out 7–12 calls at once (e.g. `reports/journal/meta`, ledger reports), so one request can hold most of the 15 slots.

### Compatibility audit (code, read-only)
| Transaction-pooler risk | Finding |
|---|---|
| Prepared statements | Every `postgres()` client sets `prepare: false` (lib/db/local-postgres.ts, getSharedPg + withLocalPg). OK |
| Session-level advisory locks | None. Only `pg_advisory_xact_lock` (stock_treatments, stock-journal) inside a transaction. OK |
| Session `SET` / `set_config` | All `set_config(..., true)` calls are transaction-local inside `sql.begin`/`tx`. No session `SET`, no `LISTEN/NOTIFY`, no temp tables, no cursors. OK |
| Idempotency lock | `acquire_idempotency_lock` RPC / unique-insert (a row, not a session lock). OK |
| Transactions | `sql.begin(...)` is a single pooled transaction. OK |
| DEV evidence | DEV already runs on `:6543` (`.env.local`) and all financial suites pass on it (payment 16/16, transfer 8/8 incl. simultaneous requests, local purchase 9/9). |
| **Backups / dumps** | `pg_dump` must NOT use the transaction pooler. The deploy gate's `BACKUP_CMD` sources `/var/www/dgt-nextjs/.env`; `dgt-db-backup.sh` reads `.env.local` first. |
| Migrations via `psql` | Run by hand/gate with a session-capable URL. |

### Plan (config only, reversible, no code change, no schema change)
Next.js gives `.env.local` precedence over `.env`, and the VPS has **both** files with the same `:5432` URL:
1. Keep `/var/www/dgt-nextjs/.env` at `:5432` (used by the deploy gate backup and any manual psql/pg_dump).
2. Change **only** `DATABASE_URL` in `/var/www/dgt-nextjs/.env.local` to the same pooler host with port `6543` (credentials unchanged).
3. `dgt-db-backup.sh` currently prefers `.env.local` → change it to prefer `.env` (one-line, root-owned script) **before** step 2, otherwise the cron backup would dump over the transaction pooler.
4. `pm2 restart dgt-nextjs` (seconds of downtime).

### Pre-checks to complete before asking for approval
- [x] Code audit above.
- [ ] Canary: start a second copy of the live build on 127.0.0.1:3001 with `DATABASE_URL=…:6543` and call unauthenticated/health routes + one read query; compare latency and errors.
- [ ] Fresh verified backup (taken through the gate or `pg_dump` over `:5432`) immediately before.
- [ ] Rollback rehearsal text below.

### Rollback (≈30 s)
`cp /var/www/dgt-nextjs/.env.local.bak-<date> /var/www/dgt-nextjs/.env.local && pm2 restart dgt-nextjs` (the plan takes the `.bak` copy first). The database is never altered.

### Recommendation
Approve. Risk is low (config only), benefit is removal of the 500s under load. Separately, `withLocalPg` could later be changed to borrow a bounded shared pool for read paths (code change, not part of this approval).

---

## 2. `profiles.raw_password` (plaintext password column)

### Findings (read-only)
- Column `public.profiles.raw_password` (type text) exists on Production.
- **62 of 75** profiles have a non-empty value (14 profiles are active/not deleted). The values were not read or printed; only counts.
- Row-level security is ON with one policy `profiles_self_read` (`id = auth.uid()`): a signed-in user can read **their own** plaintext value through the Supabase API; `anon` sees nothing. `service_role` (server key) and database roles can read all.
- Column privileges include `anon`, `authenticated`, `service_role`, `postgres` **and an extra role `codex_backup_1785611851964` with SELECT** (created by an earlier agent session; should be reviewed and removed).
- **Database backups contain the column** (every dump in `/root/backups` and any Supabase backup).
- Dependent database objects (views, constraints, indexes, policies): **0**.

### Dependency audit (code)
- **No runtime code reads it.** Writers were removed in the 2026-09-07 incident fix: `POST/PATCH /api/erp/users` and `users/password` now set it to `null`; `branch-management/general-report` and `users/journal-report` return `null`.
- Remaining references: `lib/supabase/types.ts` (generated types), seed/debug **scripts** (`scripts/seed-*.mjs`, `check-auth-users.mjs`, `debug-login.mjs`, `scratch-check-logins.mjs`, `rotate-debug-test-password.mjs`, `db-production-cleanup.mjs`, `db-apply-password-migration.mjs`) and migration `0037_add_raw_password_to_profiles.sql` (history). `20261111_scrub_superadmin_raw_password.sql` already scrubs the bootstrap account only.

### Security impact
- Plaintext credentials for most users exist at rest in the database and in all backups. Anyone with service-role/DB/backup access can log in as those users **if the stored value is still the user's current password** (unknown; the column is no longer updated, so values reflect older passwords).
- Treat the stored values as **compromised**: rotate the passwords of the 14 active users through the secure reset flow after the scrub.

### Safe migration plan (nothing applied)
| Step | Action | Reversible | Needs |
|---|---|---|---|
| 0 | Fresh verified backup (the dump will still contain the old values — keep it root-only, delete after the soak period) | — | approval |
| 1 | `REVOKE SELECT (raw_password) ON public.profiles FROM anon, authenticated;` and review/revoke the `codex_backup_*` role | yes (re-GRANT) | approval |
| 2 | Scrub: `UPDATE public.profiles SET raw_password = NULL WHERE raw_password IS NOT NULL;` (no code reads it; 62 rows) | not without the backup | approval |
| 3 | Rotate the 14 active users' passwords via `POST /api/erp/users/password` (temporary password + change at next login) | — | owner/users |
| 4 | Soak ≥ 7 days, then `ALTER TABLE public.profiles DROP COLUMN raw_password;` as a reviewed migration; remove the column from the scripts and regenerate `lib/supabase/types.ts` | no (backup) | approval |
| 5 | Delete backups older than the scrub that contain the column, after the retention decision | — | owner |

DEV is not affected by Production steps; the same scrub can be rehearsed on DEV first.

### Recommendation
Approve steps 0–3 now (revoke + scrub + rotation); do step 4 after a week with no incidents.
