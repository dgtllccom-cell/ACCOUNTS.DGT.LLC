# Production Deployment Runbook — 2026-08-28 release

Run these steps **on the machine that holds the production VPS SSH key and the
production DB credentials** (this session does not have them). Every command is
copy-paste ready. Do not skip step 1.

Target production VPS: `root@72.60.209.121` — app at `/var/www/dgt-nextjs`, PM2
process `dgt-nextjs`.
Production DB: Supabase `inmayhrxucimxqhgseqi` (pooler URL is hard-coded in
`scripts/deploy-vps-migrations.mjs`).

---

## 0. Pre-flight (local machine)

```bash
git fetch origin
git log --oneline origin/main..HEAD          # confirm the commits you expect
git status --porcelain                        # MUST be clean (deploy:prod refuses a dirty tree)
npx tsc --noEmit                               # expect 0 errors
npm run build                                  # expect exit 0
npm run i18n:guard                             # expect PASS
npx vitest run                                 # expect 111 passed / 1 skipped
```

If the working tree has other contributors' WIP, stash it first:
```bash
git stash push -m "wip-before-prod-deploy" -- <their files>
```

---

## 1. BACK UP PRODUCTION FIRST  ⚠️ mandatory

### 1a. Database snapshot

```bash
npm run backup                 # scripts/db-backup-engine.mjs — full logical backup
# OR the point-in-time production snapshot helper:
node scripts/create-production-snapshot.mjs
```

Verify the backup file exists and is non-empty. Also confirm the Supabase project
`inmayhrxucimxqhgseqi` has **PITR / daily backups enabled** in the dashboard
(Settings → Database → Backups) as a second safety net.

### 1b. Tag the current production commit (rollback anchor)

```bash
git fetch origin
git tag prod-rollback-2026-08-28 origin/main
git push origin prod-rollback-2026-08-28
```

### 1c. Capture the current VPS build (optional, fast rollback)

```bash
ssh root@72.60.209.121 "cd /var/www/dgt-nextjs && git rev-parse HEAD > /root/prod-head-$(date +%F).txt && cat /root/prod-head-*.txt"
```

---

## 2. Apply DB migrations to PRODUCTION

The migrations to apply (all additive, `IF NOT EXISTS`, idempotent):

```
20260827_step1_accounting_architecture   (super_admin_capital_accounts, country_investment_ledger,
                                          country_accounts, inter_country_transfers, general_brand_print_settings)
20260901_uae_tax_einvoicing_foundation
20260902_uae_tax_ingestion
20260903_uae_tax_documents
20260904_uae_vat_return
20260905_uae_tax_ledger_reconciliation
20260906_uae_import_export_einvoicing
20260907_uae_tax_reports_audit
20260908_uae_tax_finalize_fixes
20260909_uae_tax_view_hardening
20260910_uae_tax_rules_dedupe
20260911_uae_tax_order_item_triggers
20260912_uae_tax_sync_fn_dedupe
```

### 2a. Dry check — what's already on prod

```bash
PROD_DB='postgresql://postgres.inmayhrxucimxqhgseqi:<PROD_DB_PW>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres'
psql "$PROD_DB" -c "SELECT name, status, applied_at FROM erp_schema_migrations ORDER BY applied_at DESC LIMIT 25;"
psql "$PROD_DB" -c "SELECT to_regclass('public.uae_tax_lines') AS uae_tax_lines, to_regclass('public.inter_country_transfers') AS ict, to_regclass('public.super_admin_capital_accounts') AS sac;"
```
(The pooler password is in `scripts/deploy-vps-migrations.mjs`. Do not paste it into shared logs.)

### 2b. Apply the dedicated UAE-tax runner (skips already-applied, transactional per file)

Point it at production for this one run:

```bash
DATABASE_URL="$PROD_DB" node scripts/db-apply-uae-tax.mjs
```

Expected: `skip (already applied)` for anything present, `APPLIED` + a recorded
`erp_schema_migrations` row for the rest. It runs each migration inside its own
`BEGIN…COMMIT`.

### 2c. Apply `20260827_step1` if the dry check showed it missing

```bash
DATABASE_URL="$PROD_DB" node scripts/db-apply-all-migrations.mjs
```
(This runner now includes `20260827_step1_accounting_architecture`; it `[SKIP]`s
everything already applied.)

### 2d. Post-migration verification

```bash
psql "$PROD_DB" -c "SELECT to_regclass('public.uae_tax_entities'), to_regclass('public.uae_vat_returns'), to_regclass('public.uae_e_invoices');"
psql "$PROD_DB" -c "SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname LIKE 'sync_uae_tax%' ORDER BY 1,2;"
#   -> each sync_uae_tax_from_(purchase|sales)_orders must appear EXACTLY ONCE (3-arg form)
psql "$PROD_DB" -c "NOTIFY pgrst, 'reload schema';"
```

---

## 3. Deploy the code to the VPS

```bash
npm run deploy:prod
```

What it does: pushes `HEAD` → `origin/main` with `--force-with-lease`, then SSHes
to `root@72.60.209.121` and runs `git reset --hard origin/main`, `npm install`,
the ports seeder, `rm -rf .next && npm run build`, `pm2 restart`, `nginx reload`.

Watch for `=== PRODUCTION DEPLOYMENT COMPLETED ON THIS VPS ===`. The VPS build
runs `prebuild` (`i18n:guard`) — it will pass (the SmartSearchFilter parallel
dict is grandfathered).

If the build fails on the VPS, it is almost always OOM at static-gen — re-run
`npm run deploy:prod` once.

---

## 4. Post-deploy verification (production)

```bash
BASE='https://<prod-domain>'      # or http://72.60.209.121

# a. App is up
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/login"        # 200

# b. Log in as Super Admin in a browser and check:
#    - Dashboard loads; switch EN→UR→AR→FA→PS, whole screen flips + RTL correct
#    - Purchase Booking list loads; open one order
#    - Roznamcha list + a Cash Entry page load
#    - Ledger → Country Ledger loads
#    - Settlement dashboard loads
#    - CRM dashboard loads
#    - Tax & e-Invoicing → United Arab Emirates → Control Center loads with real KPIs
#    - Tax → UAE → Purchase Input VAT: the "Tax Status" column shows per line
#    - Tax → UAE → VAT Return: preview a period; boxes populate
#    - Reports → Journal Report and Stock Report both return data (not a 500)

# c. Accounting reconciliation spot check (in the DB):
psql "$PROD_DB" -c "
  SELECT * FROM public.uae_tax_reconciliation_v LIMIT 5;"          -- variance surfaced, no error
psql "$PROD_DB" -c "
  SELECT direction, SUM(aed_vat_amount) FROM public.uae_tax_lines
  WHERE deleted_at IS NULL GROUP BY direction;"                    -- input vs output totals sane
```

```bash
# d. Server logs — no repeating 500s
ssh root@72.60.209.121 "pm2 logs dgt-nextjs --lines 100 --nostream | grep -iE 'error|500' | tail -30"
```

---

## 5. Rollback (only if step 4 fails badly)

### Code rollback
```bash
git push origin +prod-rollback-2026-08-28:main        # force main back to the tag
npm run deploy:prod                                    # redeploy the old code
```

### Database rollback
The 2026-08 migrations are **purely additive** (new tables / functions / columns
with defaults) — leaving them in place is harmless even after a code rollback.
If a table genuinely must be removed:
```bash
psql "$PROD_DB" -c "BEGIN; DROP TABLE IF EXISTS public.uae_tax_lines CASCADE; /* …etc… */ DELETE FROM erp_schema_migrations WHERE name LIKE '202609%'; COMMIT;"
```
Prefer restoring from the step-1 backup over hand-dropping.

---

## 6. After a successful deploy

- Delete the local dev bootstrap route if you don't want it in the tree:
  `app/api/erp/auth/dev-session/route.ts` is DEV-gated (404 unless
  `APP_ENV=development` + demo auth) so it is inert on prod, but you may remove it.
- Open follow-up tickets for the § 3 open items in the master report
  (`audit/user-activity` rewrite, `goods-master` decision, `locations/summary`
  perf, `smart-search-filter` i18n migration).
- Begin the external ASP accreditation process for live e-invoice clearance.
