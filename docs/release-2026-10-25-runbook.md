# Production release 2026-10-25 — runbook (owner-run gate)

Release branch: `release/rc-expense-framework` (origin). Production now runs `a86355d`. This release is a strict superset of it
(`git merge-base --is-ancestor a86355d <release sha>` holds).

## What it contains
- **One expense-accounting framework** for every expense module (stand-alone expense bills, Bill Expenses lines, DHL / transport / customs /
  clearing, clearing partner bills): original amount + currency + rate per row → converted into the BASE currency read from the branch /
  country configuration → tax exclusive / inclusive / exempt with the code and rate of THAT country → one posting at rate 1 (never converted
  twice). Server recalculates and refuses wrong figures. Exactly-once posting (per-record lock + DB unique indexes), atomic Roznamcha engine.
- **Business vs Shipping Line separation** on expense bills, Bill Expenses, registers and reports, with the *All / Business / Shipping Line*
  filter for Branch / Country / Super Admins explicitly authorised for both. Money is totalled **per currency**, never across currencies
  (register, Bill Cost report, Job Cost / Profit).
- **Four-language fixes** (UR / AR / FA / PS) from the page-by-page sweep, language-aware customer names (Register, Details, picker),
  localisation of the permission-management and branch-report screens that arrived with production `658c4be`.

## Database (additive, owner approval + backup first)
`supabase/migrations/20261240_expense_posting_uniqueness.sql` (5 unique indexes) and
`supabase/migrations/20261241_expense_lines_tax_mode_base_currency.sql` (new columns + CHECK constraints).
Verified read-only on Production on 2026-10-25: 0 expense bills, 0 expense lines, 0 register lines, 0 duplicate ledger references, none of the
new columns exist → the migrations change no existing row. Old code ignores the new columns, so **apply the migrations first, then deploy the code**.

```bash
# on the VPS (root) — 1. verified backup, 2. migrations, 3. approve, 4. deploy
/usr/local/bin/dgt-db-backup.sh && ls -la /root/backups | tail -3          # backup must be listed and non-empty
cd /var/www/dgt-nextjs && git fetch -q origin production
set -a; . ./.env; set +a                                                    # .env keeps the direct :5432 URL
git show origin/production:supabase/migrations/20261240_expense_posting_uniqueness.sql | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
git show origin/production:supabase/migrations/20261241_expense_lines_tax_mode_base_currency.sql | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
dgt-approve-deploy <RELEASE_SHA> --migrations
dgt-deploy --dry-run && dgt-deploy                                          # backup + atomic build; dgt-deploy --rollback restores the previous build
```

## Live verification after the deploy
1. `git rev-parse HEAD` on the VPS = `<RELEASE_SHA>`; `pm2 status dgt-nextjs` online; `curl -sI https://api.dgt.llc/login` answers 200.
2. Sign in as the Global Super Admin: Expenses → New expense bill (branch of each country shows its own base currency + tax list);
   Bill Expenses → open a bill → add a foreign-currency line (rate + tax treatment) → totals in the base currency.
3. Business-only and Shipping-only users: each sees only its own section; Super Admin sees the *All / Business / Shipping Line* filter.
4. Customer Register in UR / AR / FA / PS: one name per row in the selected language, RTL, no raw keys.

## Rollback
`dgt-deploy --rollback` (previous build restored, database untouched). The two migrations are additive and can stay; to remove them:
`DROP INDEX IF EXISTS` for the five indexes and `ALTER TABLE … DROP COLUMN` for the new columns (all new, unused by older code).
