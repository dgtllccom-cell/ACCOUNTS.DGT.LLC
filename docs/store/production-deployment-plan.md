# Production deployment plan — mobile apps support + security fixes (needs the owner's separate final approval)

**IMPORTANT — Production follows `origin/main`.** On 2026-10-10 the VPS moved by itself to `5d60151` (build `IDoVBSSuZQPZIDkMp6GUd`, the V20 Super Admin dashboard commit) within minutes of that commit being pushed by the owner's own tooling; I did not do that deployment. The mobile / device-approval commits (`5a5d14e` … `830f2fc`) are **local and unpushed**. **Do not push `main` (and stop the auto-push tooling) until the migration in Step 0 is applied and you have approved**; a push will deploy automatically.

**Nothing here has been run by me for this plan.** Production (`https://api.dgt.llc`, VPS `72.60.209.121`, `/var/www/dgt-nextjs`, PM2 `dgt-nextjs`) is unchanged since commit `82c5a2a`.

## What would go live
**One additive database migration** (`20261232_mobile_device_activation.sql`: two NEW tables `mobile_devices`, `mobile_device_events`; nothing existing is touched) plus code. Apply the migration to Production **before** the code (it is applied to DEV only so far). Commits on `main` after `82c5a2a`:
| Commit | What | Risk |
|---|---|---|
| `5fdc4af`, mobile commits | Android shell config files (not used by the web server) | none for the web |
| mobile-app commit (`5a5d14e` and later) | app-channel guard (only active when the User-Agent carries `DGTllc-B/` or `DGTllc-BS/`), `/auth/app-access`, public `/legal/privacy`, middleware `/legal` public path, login "Sandbox" drawer removed unless `NEXT_PUBLIC_ENABLE_SANDBOX_LOGIN=true`, install-banner hidden inside the store apps, table-token guard improvement | low; plain browsers behave as before except the removed sandbox drawer |
| `82378db`, `5d60151`, `8950cb7` | **made by another session / the auto-commit bot, not reviewed by me**: ledger-lp workflow, Super Admin V20 dashboard, V21 edit-history | unknown — owner must confirm these are approved before they ship |
| mobile device approval system (`lib/mobile/device-service.ts`, `/api/erp/auth/device/*`, `/api/erp/mobile-devices/*`, `/auth/device`, Super Admin page Mobile Devices) | active **only** for requests carrying the store-app User-Agent tag; plain browsers and the web ERP are unchanged. Per-request session check adds one cached DB lookup for tagged requests | low; DEV e2e 35/35 |
| purchase/sales wizard fixes | undefined-name crashes fixed | low |

`git pull --ff-only` on the VPS takes **everything on main up to HEAD**. If only part should ship, the owner chooses the commit to deploy (`git checkout <sha>` is not used; instead hold the other work on a branch first).

## Security fixes included
* Public login page no longer offers the Sandbox drawer that listed real account ids (Super Admin, Country Admin, …).
* The install-app banner / "download installer" prompt is not shown inside the store apps.
* Unchanged but worth the owner's attention: the production error log shows a missing table `ai_assistant_audit_logs` and a missing column `enterprise_accounts.linked_companies` (pre-existing, unrelated to the apps).

## Before deploying (all on DEV, already green unless noted)
1. `npx tsc --noEmit` clean for touched files; `npm run i18n:guard`; `npm run build` exit 0.
2. `BASE=http://localhost:3260 node scripts/e2e-app-channel.mjs` → 12/12; `node scripts/e2e-shipment-tracking.mjs` → 67/67.
3. Mobile/tablet sweep of the 191 menu routes (see report) — all failures fixed or listed.

## Step 0 — apply the migration (after the backup in step 1)
Use the Supabase migration tool on project `inmayhrxucimxqhgseqi` with the contents of `supabase/migrations/20261232_mobile_device_activation.sql`; verify with `select count(*) from mobile_devices` (0 rows). Production gets no test devices — the first real device is the owner's own.

## Step 1 — backup (read-only, takes ~1 minute)
```
ssh root@72.60.209.121
cd /var/www/dgt-nextjs && set -a && . ./.env && set +a
F=/root/backups/prod-before-mobile-$(date +%Y%m%d-%H%M%S).dump
pg_dump "$DATABASE_URL" --schema=public --no-owner --no-privileges -Fc -f "$F"
pg_restore --list "$F" | grep -c "TABLE DATA"     # expect ~340
sha256sum "$F"   # then copy the file off the server (scp) and keep the checksum
```
The last backup (before tracking/goods-transfer) is `B:\accounts.dgt.llc.code_project\prod-backups\prod-full-before-tracking-gt-20261009-192247.dump`.
Also record the current state for rollback: `git rev-parse --short HEAD` and `cat .next/BUILD_ID` (now `82c5a2a7` / `E3Rqh7b7MShWC4rAG4dDk`).

## Step 2 — deploy (atomic, zero-downtime reload)
```
cd /var/www/dgt-nextjs && git fetch -q origin && git pull --ff-only origin main
nohup bash scripts/safe-build-deploy.sh > /tmp/deploy.log 2>&1 &      # builds into .next.building, swaps, pm2 reload
```
The script keeps the previous build in `.next.rollback`.

## Step 3 — verify
1. `git rev-parse --short HEAD`, `cat .next/BUILD_ID`, `pm2 describe dgt-nextjs` (online, restarts +1 only).
2. Unauthenticated: `/auth/login` 200, `/legal/privacy` 200 (privacy text in all 5 languages), `/api/erp/tracking/list` → redirect to login, `/dashboard` → redirect to login.
3. **Owner / authorised user, authenticated:** sign in on desktop + in each Android app: Business login in DGT.llc B lands on its dashboard; a shipping-only login in DGT.llc B shows the "use DGT.llc BS" notice; Shipping login in DGT.llc BS lands on the shipping home; Super Admin works in both; the Login page shows no Sandbox drawer.
4. `pm2 logs dgt-nextjs --lines 100` — no new errors.

## Rollback (code only; the database is not touched by this deployment)
```
cd /var/www/dgt-nextjs && bash scripts/safe-build-deploy.sh --rollback       # swaps .next.rollback back in, reloads PM2 (about 10 seconds)
git reset --hard 82c5a2a7 is NOT needed for the running site; only if a rebuild is required later: git checkout --detach 82c5a2a7
```
If the data were ever damaged (not expected: no migration, no data writes): restore from the dump with `pg_restore --clean --if-exists -d "$DATABASE_URL"` only after the owner confirms.

## After the deploy
Submit the apps to the stores (they already point at `https://api.dgt.llc`); the store listings can reference `https://api.dgt.llc/legal/privacy`.
