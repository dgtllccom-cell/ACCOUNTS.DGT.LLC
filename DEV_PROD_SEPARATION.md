# Dev / Production Database Separation

Until now, local development and the production VPS pointed at the **same**
Supabase project, so every change and every row written in testing landed in
production. This document describes the separation that fixes that.

## The two environments

| | Development | Production |
|---|---|---|
| Supabase project | `csesvyxxjivnkkozgopt` (existing) | `inmayhrxucimxqhgseqi` (new) |
| API URL | `https://csesvyxxjivnkkozgopt.supabase.co` | `https://inmayhrxucimxqhgseqi.supabase.co` |
| Used by | local `.env.local` | VPS `/var/www/dgt-nextjs/.env.local` |
| `APP_ENV` | `development` | `production` |
| Cost | free | $10 / month |

The existing project stays as **dev** (keeps its current data). The new project
is **production** and was created **schema-only** — same structure, no rows.

## How separation is enforced (the guard)

`lib/env/environment.ts` runs at every database connection (Drizzle client and
every Supabase client). It **hard-fails at startup** if the wiring is wrong:

- `APP_ENV=production` → the app may **only** connect to the production project
  (`inmayhrxucimxqhgseqi`). Anything else throws and the app refuses to boot.
- `APP_ENV` not production → the app may **never** connect to the production
  project. Pointing dev at prod throws.
- `NEXT_PUBLIC_SUPABASE_URL` and `DATABASE_URL` must reference the **same**
  project (catches half-edited env files).

Overridable via env: `PROD_SUPABASE_REF`, `DEV_SUPABASE_REF`, `APP_ENV`.

## One-time production setup

1. **Fill prod secrets.** In the Supabase dashboard for *ACCOUNTS.DGT.LLC -
   Production*: copy the `service_role` secret (Settings → API) and set/reset the
   database password (Settings → Database). Put both into `.env.production.template`
   values.
2. **Load the schema** into prod from a machine with network access (your PC or
   the VPS — not the sandbox):
   ```
   set PROD_DATABASE_URL=postgresql://postgres.inmayhrxucimxqhgseqi:<PW>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres
   node scripts/load-prod-schema.mjs
   ```
   This applies `supabase/production-schema.sql` (148 tables, 28 types, 146 RLS
   policies, 52 functions, 5 views, indexes & triggers) in one transaction.
3. **Install the prod env on the VPS.** Copy the filled `.env.production.template`
   into `/var/www/dgt-nextjs/.env.local`, then `pm2 restart dgt-nextjs`. The
   deploy script already preserves `.env.local`, so future deploys won't touch it.

## Notes / things to be aware of

- **Reference data is NOT copied** (schema-only, as requested). If the app needs
  master/reference rows in prod (countries, permissions, cities, etc.), seed them
  separately — `supabase/seed.sql` and the reference tables are the starting point.
- **Fixed env typo.** The old env files used the project ref `csesvyxqjivnkkozgopt`
  (an `xq`) which is not a real project. It has been corrected to the real dev ref
  `csesvyxxjivnkkozgopt`, and `DATABASE_URL` now uses the verified pooler host.
- **Auth users** live in Supabase's `auth` schema and are per-project; production
  starts with no users. Create the first admin/superadmin in prod as needed.
