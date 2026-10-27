# Production release rc2 — runbook (owner-run gate)

Release branch: `release/rc2` (origin). Production runs `dffd724` (deployed through the gate 2026-10-26 20:35Z). rc2 is a strict
superset of it (`git merge-base --is-ancestor dffd724 <release sha>` holds) and adds **no database migration**.

## What it contains (on top of production `dffd724`)
- **Names in five languages** — account, customer, company, bank and branch names show an approved variant (entered by a person
  or a whole-name entry of the curated dictionary), otherwise exactly the saved name, on every screen: Account Setup (edit keeps
  the saved name), account / ledger lists and reports, live report panel, Customer Register, Party Directory, Truck registration,
  company / bank / clearing-agent / shipping-line pickers, 360 views, company-360 print, General Office. No phonetic re-spelling, no
  word-by-word dictionary substitution inside a name. Places (country, city) keep their translations.
- **Approved variants** — Account Setup accepts a person's variant per language (stored as a manual, approved entry; the other
  languages keep the saved name). Settings → Translations (Super Admin) does the same for companies, banks and branches.
- **BL Entry** — no invented values in the summary cards (BL-871867, ISS-871867, truck ABC-123, seal S-5542, 22 Wheeler,
  PK / UAE); the Quality Report no longer shows fixed sample readings (moisture 5.2 %, Grade A 99.1 %, "Passed") — a line is
  "Not inspected" until a real result exists; no literal "$" before rate 1; summary cards, pop-ups, goods step and B/L print in
  the selected language.
- **Users page / tables** — the shared Grid / List toggle appears once (a second, floating copy flashed on load).
- **Security: Business ↔ Shipping** — purchase / sales payments, booking transfers and local-purchase payments saved their
  Roznamcha entry with no operational domain, and the Roznamcha list shows such entries to every domain: a Shipping-only login
  saw Business payments (DEV: several hundred rows; Production: 0 transactions, nothing leaked). An unclassified entry now
  belongs to its branch's domain; new entries are stamped Business (or the branch's domain). The Supabase fallback path had no
  domain filter at all — added.
- **No invented figures** (all live in Production today): Super Admin dashboard (sample shipments / activities, a sample profit
  curve and sales split, "$" sums of mixed currencies), Shipping Line dashboard (24 / 56 / 342 / 286 … shown when the real
  count is 0, fake trend %, sample shipments / tasks / documents), KYC Reports (90 / 82 / 28 …), Audit Monitoring (1,842 added
  to the real count; branches floored at 9, countries at 5), purchase reports (HS 0802.1200, Premium, USA, 260,000 kg, $5.20,
  "Global Commodities Supplier", serials built from the booking number), City Branch wizard (sample accounts), Account Setup
  ("Created by: Super Admin" for everyone).
- **Five languages** — menu labels and table headings fall back to the central dictionary (no English menu entries); leftover
  English labels on ~40 screens found by a full sweep; Super Admin / Shipping Line dashboards; CHS Products hydration error.
- **Permissions (from the earlier rc2 work)** — scope leaks on shipping dashboards, branch reports and the permission screen
  closed; branch pages respect the login's operational domain; menu = route gate.

## Evidence (DEV database `csesvyxxjivnkkozgopt` only; Production was only read)
See `docs/MASTER-PROGRESS-REPORT.md` (section "rc2 final") for the PASS / FAIL table of this build.

## Gate steps (owner)
```bash
# 1. GitHub: open the pull request release/rc2 → production, review, merge it.
# 2. On the VPS (root):
cd /var/www/dgt-nextjs && git fetch -q origin production
RELEASE_SHA=$(git rev-parse origin/production)      # the merge commit you just created
git merge-base --is-ancestor dffd7245fb1bf0b7c4e7a46aca7b4391ba2cd9fa "$RELEASE_SHA" && echo "superset OK"
git diff --name-only dffd7245fb1bf0b7c4e7a46aca7b4391ba2cd9fa "$RELEASE_SHA" -- supabase/migrations   # expect: nothing
dgt-approve-deploy "$RELEASE_SHA"                     # NO --migrations: this release has none
dgt-deploy --dry-run && dgt-deploy                     # backup + atomic build; dgt-deploy --rollback restores the previous build
```

## Live verification after the deploy
1. `git rev-parse HEAD` on the VPS = `RELEASE_SHA`; `pm2 status dgt-nextjs` online; `curl -sI http://localhost:3000/login` answers 307/200;
   `/var/log/dgt-deploy.log` ends with `DEPLOYED <RELEASE_SHA>`.
2. Sign in as the Global Super Admin, switch EN → UR → AR → FA → PS: Accounts list, an account's Account Setup (the Account Name
   field shows the saved name in every language), Companies picker (names unchanged, country / city translated).
3. Users page on a phone: one Grid / List toggle.
4. BL Entry → New B/L Entry: summary cards show "—" for empty fields, goods step heading in the selected language.

## Rollback
`dgt-deploy --rollback` (previous build restored, database untouched — this release changes no schema and no data).
