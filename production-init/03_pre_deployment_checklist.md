# Digital Dock ERP — Production Init & Pre-Deployment Checklist

This folder contains everything for the production cleanup + Location Management
seed + go-live. **Claude cannot connect to, back up, or modify your live Supabase
DB, and cannot run the build/deploy.** You run these steps; the scripts are built
against your actual schema and are statically verified (balanced SQL, correct
table/column names, idempotent).

## Run order
1. **Backup (mandatory).** `pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M).dump`
2. `01_production_cleanup_reset.sql` — fill placeholders, run step-by-step, review each PREVIEW, then COMMIT.
3. `02_location_seed.sql` — countries + all states/provinces + one capital city each.
4. `02b_location_major_cities.sql` — major/trade cities per state.
5. Run the VERIFICATION queries at the end of each file (expected counts are noted inline).
6. Rebuild + redeploy the app (below), then smoke-test.

## Cleanup — two ways to choose what to KEEP
**Option A (you list them):** fill the `<<..._CODE>>` (one main branch code per country)
and `<<..._EMAIL>>` (1 super admin + 5 country admins) placeholders in File 1.

**Option B (rule-based, no list needed):** replace File 1 STEP 2 & STEP 3 filters with these.

```sql
-- Branches: keep the current is_main branch per country, drop everything else
UPDATE public.country_branches cb SET deleted_at=now(), status='inactive', updated_at=now()
WHERE cb.deleted_at IS NULL AND cb.is_main IS NOT TRUE;   -- keep only flagged main branches
UPDATE public.country_branches cb SET deleted_at=now(), status='inactive', updated_at=now()
WHERE cb.deleted_at IS NULL AND cb.country_id NOT IN (
  SELECT id FROM public.countries WHERE iso2 IN ('AE','PK','AF','IN','IR') AND deleted_at IS NULL);
UPDATE public.city_branches SET deleted_at=now(), status='inactive', updated_at=now() WHERE deleted_at IS NULL;

-- Users: keep the OLDEST super_admin + the OLDEST country_admin per country
WITH keep AS (
  SELECT ura.user_id FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  WHERE r.name = 'super_admin'
  ORDER BY ura.created_at ASC LIMIT 1
  UNION
  SELECT DISTINCT ON (ura.country_id) ura.user_id
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  WHERE r.name = 'country_admin' AND ura.country_id IS NOT NULL
  ORDER BY ura.country_id, ura.created_at ASC
)
SELECT u.id, u.email FROM auth.users u WHERE u.id NOT IN (SELECT user_id FROM keep);  -- PREVIEW to delete
-- (verify role names in your `roles` table first; then DELETE the non-kept ids as in File 1 STEP 3)
```
> Confirm your `roles.name` values before using Option B — role naming can differ.

## Tier-B reset decision (your call, currently NOT cleared)
`ledgers`, `accounts` / `enterprise_accounts` / `account_groups` / `account_types`
are **chart-of-accounts configuration**, so File 1 **keeps** them by default. Clear
them only if you truly want to re-create the chart of accounts from scratch.
Shipping/clearing records, approvals, and rate history are also left for you to decide.

## Final engineering review — status
What was verified statically (no live build available to Claude):
- **Schema alignment:** every table/column used exists in your migrations (countries, country_branches, city_branches, states_provinces, districts, cities, journal/ledger/roznamcha/purchase/sales/employees, etc.).
- **Multilingual:** location seed uses the 0078 `name_en/ur/ar/fa/ps` contract; `erp_resolve_language_text()` falls back to English, so partially-translated rows never break.
- **Referential safety:** cleanup uses soft-delete (`deleted_at`) for FK-linked masters; only transactional tables are hard-`TRUNCATE`d, children before parents, `CASCADE` scoped to the listed set.
- **Idempotency:** location inserts use the existing partial unique indexes via `ON CONFLICT DO NOTHING/UPDATE` — safe to re-run.
- **Nav (Phase 1, commit 661fd36):** Purchase/Sales menus regrouped (Local Purchase Management, Sales Order / Local Sales Management) with 5-language labels; all links point to existing pages (no broken routes).

What only YOU can verify (needs the real environment):
- `npm run build` passes on Windows/VPS (Claude cannot run it here).
- Pages load **real** data (depends on the Supabase **Service Role key** being the true `service_role` secret — the earlier root cause of blank/zero pages).
- Post-cleanup smoke test: login as super admin + each country admin; open Purchase, Sales, Journal, Ledger, Roznamcha, Location Management; create one test entry per module.

## Deployment
```bash
git pull origin main            # includes 661fd36 (nav) + any later commits
npm install --legacy-peer-deps
npm run build                   # must be green before restart
pm2 restart digital-dock-erp    # or your process name
pm2 logs --lines 50
curl -I http://localhost:3000   # expect 200/redirect to /login
```
Apply the idempotency migration once if not yet applied:
`psql "$DATABASE_URL" -f supabase/migrations/20260727_idempotency_keys.sql`

## Not done / honest gaps
- **Exhaustive every-town city list** (India/Iran especially) is not hand-authored — use a GeoNames import if you need every settlement; the current set covers capitals + major trade/port cities.
- Remaining per-language transliterations (each place name in all 5 scripts) can be filled incrementally; English fallback keeps the UI correct meanwhile.
- Cleanup placeholders (Option A) still need your branch codes / admin emails, or use Option B.
