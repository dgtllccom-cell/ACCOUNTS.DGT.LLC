# HANDOVER – DAMAAN ERP: finish the 16 Nov 2026 production release

Written for the second developer. Read sections 1–3 first; they decide what to run.

## 1. Status in one paragraph

Nothing from the 15–17 Nov work is live on Production yet. The live VPS runs GitHub `main` commit `8621c0c` (Asmatullah's work, deployed outside the gate). The Production database still has the old categories policies, no `carried_forward_from` column, five live test Roznamcha entries, and serial counters at 4. The integration branch below contains both developers' work, builds, and is on GitHub. It still needs DEV browser tests, a decision on one RLS conflict (section 4), the Production SQL and cleanup, and the gate deploy.

## 2. Branches and commits (all pushed to `origin` unless noted)

| Branch | HEAD | Purpose |
|---|---|---|
| `integration/release-20261116` | **`c99acf0`** (ops files), code merge **`5cdbf35`** | **Deploy this.** = live `main` + release work. `npm run build` passed (`BUILD_EXIT=0`) on `5cdbf35`. |
| `release/consolidated-20261116` | `eb1a6cd` | All our work before the merge with live `main`. Does not contain Asmatullah's changes. |
| `fix/cash-entry-credit-usd-order` | `29f3534` | Cash Roznamcha manual DR/CR fix (already in `eb1a6cd`). |
| `fix/location-management-branch-workflows` | `8d1a991` | Location, Country Branch, City Branch fixes (in `eb1a6cd`). |
| `fix/goods-create-edit-validation-report` | `bd4f941` | Goods entry and management fixes (in `eb1a6cd`). |
| `main` (live) | `8621c0c` | Asmatullah: Roznamcha table reorganize (`8621c0c`), categories RLS + FX carry-forward + local purchase (`119e54f`), PR #144 language refresh (`608621e`, `7a42b4d`). |
| `production` (gate source) | `c0856c0` | Last gate deploy, 15 Nov 18:17 UTC. `5cdbf35` fast-forwards from it. |

`c99acf0` adds `sql/` (migrations, cleanup, handover). It does not change the app build.

## 3. Work completed (verified as stated)

- **Country Branch** (`8d1a991`): saved Email shows the saved mailbox; saved location names resolve on edit; Final Review shows the real save result. DEV: B1–B5 pass. B6 partial (reused rows from the first run). **B7 fails: `country_branches` has no area column (needs schema approval).**
- **City Branch** (`8d1a991`): step-1 District select removed; saved mailbox not overwritten on save; one New Account per city branch. DEV: C1–C4 and C6 pass. C5 (UI create with account line) not run. Saves take 30 s or more on DEV.
- **Location Management** (`8d1a991`): wizard tile and tab labels match the DB hierarchy; state and tree summaries no longer hang (single-statement queries, scoped aggregates); stats consistent; area name required message in five languages. DEV: A1–A10 pass. A11 (full tree) not re-run.
- **Goods** (`bd4f941`, `5621443`): variety, origin and extra details saved; duplicate CHS returns 409; save feedback next to the button; registry labels localized. DEV browser: 28 of 29 pass (registry labels fixed after that run).
- **Cash Roznamcha manual DR/CR** (`29f3534`): no automatic offset leg for manual entries; edit no longer creates a visible duplicate; cancelled and REV- rows hidden from the active list; column order CR (local) → rate → USD; USD/AED maths. DEV: page loads with no errors; API DR/CR and edit tests; no browser save test yet.
- **Exchange rates** (`9c521fb`, `7bf707f`, `896a179`): only countries with a live branch (today UAE and Pakistan) on the board and in Roznamcha position cards; rate applies from start of its rate date; carry-forward keeps the source date. DEV API verified. Live UAE rate saved on 16 Nov with old code after the permission fix below.
- **New Account / Categories** (`0acf63a`, `57a5e33`, `09ad1f6`, `82624b1`, `2c96d87`): categories RLS (replaced in SQL, see section 4), S = Sales, five-language names and descriptions for the 13 approved business categories; category picker with edit pencil for super admins; account-number levels by role; Account View/Print uses the profile card with QR and DAMAAN logo fallback. DEV: picker 5 of 5; categories API 20 of 21 (Pashto "Sales" screenshot check fails; DB value is correct). QR and Print not browser-tested.
- **Permission already applied in production DB (16 Nov):** UAE Country Admin (`fcebbbcd-e54d-4227-a782-cb3ffe4dadfb`) rate permissions added to a manual set (113 → 116). Rollback: `sql/prod-permission-fix-20261116.sql`.

## 4. Merge conflicts resolved in `5cdbf35` (review these)

I resolved the five conflicts between `eb1a6cd` and live `main` `8621c0c`:

1. `app/api/erp/account-categories/route.ts`: kept live `includeInactive` parsing (accepts `1`, `true`, `yes`) and one filter condition using `${includeInactive}::boolean or is_active`. Duplicate declarations removed.
2. `app/api/erp/currency/daily-rate/route.ts`: release country-currency resolution (a USD entry in a non-USD country uses the country rate) combined with live carry-forward (latest approved rate, filtered by country currency). Response has the carry-forward fields and the release fields.
3. `app/api/erp/currency/daily-rates/route.ts`: release `targetActive` / `latestActive` status with live carry-forward semantics (`CARRY_FORWARD`, source date).
4. `features/accounts/components/new-account-setup.tsx`: live category fetch (both `operationalDomain` and `domain`, accepts both response shapes).
5. `features/roznamcha/components/cash-entry-form.tsx`: release column order (Credit Local → Exchange Rate → Credit USD) on the body and header. **Not yet fixed:** the CSV export header still lists Exchange Rate before Credit (Local).

**RLS decision (blocking for SQL):** live `main` has `supabase/migrations/20261125_account_categories_hardened_rls.sql` (drops the same old policies, creates `account_categories_read_policy` and `account_categories_write_policy`, deactivates junk categories, keeps the 13 approved ones active). Our `sql/production-release-20261116.sql` creates `account_categories_read_authenticated` and `account_categories_write_super_admin` instead. **Both sets must not run together** (two permissive write policies). Choose one. Recommended: keep `main`'s `20261125` migration for policies and deactivation, and run only the parts of our SQL that are not in it (the `carried_forward_from` column, five-language names and descriptions, S = Sales, P/B/C inserts only if `20261125` does not create them). Check the `20261125` file end to end before deciding.

## 5. SQL, cleanup and backup files

In the repo, in `sql/` on `integration/release-20261116` (commit `c99acf0`):

- `production-release-20261116.sql`: release SQL. Preconditions abort if production differs. Adds `carried_forward_from`; replaces category policies (see section 4); renames S to "Sales"; deactivates 15 extra business categories (never deletes); adds five-language names and descriptions for the 13 approved categories.
- `production-release-20261116-rollback.sql`: restores the snapshot tables `bkp_20261116_*`. Those tables do not exist yet, because the release SQL creates them.
- `production-cleanup-roznamcha-test-20261116.sql`: soft-deletes the five test entries, writes one `record_change_history` row each, sets the seven Roznamcha counters to 1 (next serial 001). Keeps 10 lines and 2 reversal links. Preconditions abort if anything differs.
- `prod-permission-fix-20261116.sql`: already applied; rollback included.
- `owner-session-deploy-eb1a6cd.sh`: old runbook. Update the SHA to `c99acf0` before use.
- `HANDOVER-20261116.md`: earlier handover (superseded by this file).

**Five test entries** (cleanup SQL, production, 16 Nov 2026):

| Entry id | Voucher | Status |
|---|---|---|
| `c87e9a34-d544-4e5e-97fa-3d4edc47e4f7` | V-20261116-9470 | cancelled (265,000 entered as AED) |
| `720e1875-4a16-4208-b926-0d3392fe7067` | REV-V-20261116-9470 | cancelled (reversal) |
| `16e4c56b-2443-4310-8743-167b5d732c21` | V-20261116-YEKX | posted (32,000 USD) |
| `f8bfc422-6e77-41d3-a6bb-40cdd6ba6417` | REV-REV-V-20261116-9470 | posted (reversal of reversal) |
| `e1381fad-f459-4d6a-bd75-ee0a82516314` | V-20261116-0LKJ | posted (re-post) |

The owner has approved this cleanup. Only these five are in scope. The owner counted six; production contains five entries plus two reversal-link rows. Do not touch anything else.

**Serial counters to reset to next_value 1** (`transaction_serial_sequences`, currently 4): `6164cf07-9012-4d4b-a7f0-3713492ff518` (ERP, global); `bbfba621-50e6-43c8-b62c-1e312dec6446` (AE, country); `1446ba9d-4295-44fc-8536-aae1685b12dc` (AREAEDU001, branch); `ba8720ee-fc27-4802-ae34-c3c5533bc42a` (AREAEDU001, city_branch); `8a0f7f57-927c-46af-9e42-5d39c9a23a11` (AREMAIN001, main_branch); `07b237a4-12a5-4283-a9d8-b68da152c561` (DR); `52d15150-d4b9-49a2-85b6-98e5674addd2` (CR).

**Backups (on the VPS, verified 16 Nov):**

- Latest, use as the pre-change backup: `/root/backups/prod-full-before-cleanup-20261116-193322.dump`, full `pg_dump -Fc`, 71,325,332 bytes, SHA-256 `255b63e1d0d44e95e7754d3c6578cae8ab0553e89fea8cd1b4a607e12564d36d`, 8,598 TOC entries.
- `/root/backups/prod-before-release-20261116-184702.dump`: public schema, SHA-256 `cb50119d79621812538f738ea23a1744b4dd8792d437ccc005422d1f102bf3f8`.
- `/root/backups/prod-manual-before-release-20261116-080123.dump`: SHA-256 `e5d9c40ae3b7bd88bbd8b7254652442159bc14d72a41139b63a0e8e9b2b9fd14`.

Take a fresh full backup right before the SQL step (command in section 7).

## 6. Required server permissions

- SSH as root to `72.60.209.121`.
- Production database write access: `psql "$DATABASE_URL"` using `/var/www/dgt-nextjs/.env`. The first developer's session was blocked from this; it must be run from an authorized session.
- Gate approval (`dgt-approve-deploy`, writes `/etc/dgt-deploy/approved`) and push to `origin production` (via the gate script).

## 7. Execution order (do not reorder)

1. **Testing first (DEV):** section 8, items 1–6.
2. **Resolve the RLS decision** (section 4) and update the release SQL if needed. Commit to `integration/release-20261116`, push, and rebuild if the code changed.
3. **Fresh backup, on the VPS:**
   ```bash
   ssh root@72.60.209.121 'set -a; . /var/www/dgt-nextjs/.env; set +a; pg_dump "$DATABASE_URL" -Fc -f /root/backups/prod-pre-run-$(date -u +%Y%m%d-%H%M%S).dump && sha256sum /root/backups/prod-pre-run-*.dump | tail -1 && pg_restore --list /root/backups/prod-pre-run-*.dump | wc -l'
   ```
4. **Upload the SQL:**
   ```bash
   scp sql/production-release-20261116.sql sql/production-cleanup-roznamcha-test-20261116.sql root@72.60.209.121:/root/
   ```
5. **Release SQL first** (adds `carried_forward_from`; the new code writes it):
   ```bash
   ssh root@72.60.209.121 'set -a; . /var/www/dgt-nextjs/.env; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /root/production-release-20261116.sql'
   ```
6. **Cleanup SQL second:**
   ```bash
   ssh root@72.60.209.121 'set -a; . /var/www/dgt-nextjs/.env; set +a; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /root/production-cleanup-roznamcha-test-20261116.sql'
   ```
7. **Gate dry run, then deploy** (`--migrations` is required: the commit adds three migration files):
   ```bash
   scripts/production/deploy-via-gate.sh c99acf0 --migrations --dry-run
   scripts/production/deploy-via-gate.sh c99acf0 --migrations
   ```
   If the code changes after step 2, use the new SHA in both commands.
8. **Live verification** (section 9).

Do not run step 7 before steps 5 and 6. The new code writes `carried_forward_from`, so rate saves fail without the column. Do not enter new Roznamcha transactions until steps 5–7 are done: entries made before the deploy still get the old offset line.

## 8. Testing requirements (before step 7)

1. `npm run build` on the final SHA: `BUILD_EXIT=0`.
2. Targeted typecheck on the touched files (`tsc -p` with a config that extends the repo tsconfig): `TSC_EXIT=0`.
3. API checks on DEV (dev-session login as super_admin): daily-rates board lists only UAE and Pakistan; Pakistan POST at 11:30 PM local stores `effective_from` 2026-11-15T19:00Z; roznamcha list has no cancelled or REV- rows.
4. Browser on DEV, desktop and mobile: Cash Roznamcha: save one DR, one CR; one visible row each; no offset line; edit leaves one active row; columns read CR → rate → USD. Exchange rate board. Country Branch and City Branch save paths. Goods registry in Urdu.
5. Five languages (en, ur, ar, fa, ps) and RTL on the touched pages: no English labels in the new text.
6. Print: New Account View/Print shows the profile card with QR and logo (not yet done).

## 9. Final production verification checklist (after step 7)

- VPS: `cd /var/www/dgt-nextjs && git rev-parse --short HEAD` equals the deployed SHA. `pm2 list` shows `dgt-nextjs` online. The gate log `/var/log/dgt-deploy.log` ends with `DEPLOYED <sha>`.
- Database (read-only queries): `select count(*) from roznamcha_entries where deleted_at is null` = 0. The seven counters = 1. `daily_usd_rates` has `carried_forward_from`. Category policies are exactly the set chosen in section 4. Active business categories = 13. `S` name = "Sales".
- Live UI: the five test vouchers absent from active lists; a new DR and a new CR each create one entry, serial starts at 001; USD/AED amounts match rate × quantity; Roznamcha and Ledger totals match the entries; exchange board lists only UAE and Pakistan.
- Screenshots of each check, saved with the deployment report.

## 10. Open items (not done; assign or include)

- **Location:** country-branch area needs a schema change (approval required). Wizard validation and Super Admin "Saved" text still English; some Super Admin checklist items hard-coded true; no area level in the Location Settings wizard; renaming a state or district to an existing code returns 500 on rerun; City Branch saves are slow.
- **Goods:** registry steps 2–6 hard-coded English; registry delete uses `window.confirm` / `alert`; management delete and export not tested; ar/fa/ps error messages not checked.
- **Cash Roznamcha:** CSV export column order; browser DR/CR save test; reversal rows still shown in other Roznamcha reports; the divide-entry action is admin-gated only in the client.
- **New Account:** Print / QR browser test; the Account View profile card is shared with the live code (verify the live file still renders).
- **Categories:** DEV Pashto "Sales" settings screenshot fails (DB value correct); description translations in the release SQL.
- **Not started:** Purchase Booking and list, Purchase Loading, Stock Register, Customer Orders, Shipping Line, Clearing Agent, permissions matrix (Super Admin, Country Admin, Branch Admin, Normal User), mobile, tablet and print tests across modules.
- **Test data on DEV:** `QX` test country and branches, several `QA-*` goods, DEV test Roznamcha entries.
- **Live-only work to review:** `8621c0c` changed the Roznamcha table layout; confirm it still works with the merged file.
