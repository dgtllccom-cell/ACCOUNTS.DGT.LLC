# Production Schema Reconciliation — Plan & Rehearsal Evidence

_Prepared 2026-08-29. Steps 1–4 complete and rehearsed on an isolated replica.
**Step 5 (apply to the live production database) requires explicit owner GO.**_

---

## 1. Why this is needed

The production database (`inmayhrxucimxqhgseqi`, "ACCOUNTS.DGT.LLC - Production")
was built through a **non-linear migration path** — its `erp_schema_migrations`
table lists 26 hand-picked migrations, and additional schema arrived via one-off
sync scripts. Meanwhile DEV evolved through the full `supabase/migrations/`
history plus the multilingual generator.

| | Production | DEV (verified target) |
|---|---|---|
| public tables | 188 | 847 (699 excl. `zz_bak_*` + recursive `*_lang_lang`) |
| functions | 79 | 164 |
| RLS policies | 193 | 258 |
| `post_purchase_order_payment` etc. | **old / buggy** | fixed (`20261001`) |

The verified release (HRM, AI Document Intelligence, Real-Contract workflow,
Multi-Currency Purchase Accounting) was validated end-to-end against **DEV's**
schema. Production is missing the tables, functions and RLS it needs; the release
migrations cannot simply be replayed because the older migration files are not
idempotent and depend on foundational objects (`clearing_payment_bills`, …) that
were never migrated to production.

The production **code** is already live (`b9ce7a0`, auto-deployed) — it is
currently running against the older schema, so HRM / Doc-Intelligence / Multi-
Currency pages are non-functional until this reconciliation is applied.

---

## 2. The corrective set (ordered, additive, idempotent)

Rehearsed against an **isolated local replica** restored from the verified
production backup (`pg_dump` schema + data — exact match: 188 tables, 691
indexes, 193 policies, 696 FKs, 118 checks, 80 triggers, 9 views, 3365 columns,
~69 800 rows).

**53 migrations applied + 1 recorded-as-pre-satisfied. 0 failures. No data touched.**

### 2a. Pre-existing feature + foundation migrations (`20260818` → `20261002`) — 50

```
20260818_shipping_clearing_rbac                20260827_branch_owner_fk
20260819_create_transit_entries_table          20260827_clearing_agent_custom_entry_and_payment_bill
20260819_shipping_intercountry_transfer        20260827_import_transit_truck_master_fk
20260820_office_hr_modules                     20260827_local_purchase_master_fk
20260821_purchase_loading_transport_receiving  20260827_money_exchange_master_fk
20260822_create_idempotency_keys_table         20260827_purchase_loading_master_fk
20260822_fix_payment_source_transaction_id_uniqueness  20260827_trucks_transport_company_fk
20260823_add_enterprise_accounts_qvc_columns   20260828_external_form_links
20260823_add_sales_orders_is_edited_since_transfer     20260829_settlement_integration_registry
20260823_fix_sales_order_payment_roznamcha_overload_ambiguity   20260913_goods_master_category
20260825_add_office_documents_canonical_fields  20260914_contract_control_center
20260825_office_documents_phase1_context        20260915_hr_departments_designations
20260826_bank_master_phase2                     20260916_hr_employment_history
20260826_company_master_phase2                  20260917_hr_employee_kyc
20260826_erp_documents_phase1                   20260918_hr_attendance_leave
20260826_expenses_account_type                  20260919_hr_payroll_runs
20260826_office_documents_storage_bucket        20260920_hr_payroll_tax_config
20260826_shipping_line_and_clearing_agent_master 20260921_hr_smart_crm_reminders
20260826_truck_loading_booking_company          20260922_hr_gratuity_settlement
20260826_truck_person_links                     20260923_hr_country_currency
20260826_warehouse_master_phase2                20260924_hr_onboarding
20260925_document_intelligence_foundation       20260928_business_shipping_handovers
20260926_document_intake_drafts                 20260929_document_intake_roznamcha
20260927_purchase_loading_batches               20260930_hr_leave_attendance_reconciliation
20261001_multicurrency_purchase_payment_fix     20261002_goods_variety_and_extra_details
```

`20260821_purchase_orders_destination_scope` — **pre-satisfied**: its check
constraint already exists on production (non-idempotent migration). Recorded in
`erp_schema_migrations` without re-running.

### 2b. New reconciliation migrations — 3

| Migration | What it does |
|---|---|
| `20261003_prod_reconcile_rls_hardening` | `ENABLE ROW LEVEL SECURITY` on 49 HRM / doc-intake / clearing / contract tables + the 5 scoped policies DEV carries (`employees`, `employee_advances_loans`, `employee_salaries_due`). The app reaches these tables through the service-role `withLocalPg` connection (bypasses RLS) and enforces scope in code, so **application behaviour is unchanged** — this only closes the PostgREST (`anon`/`authenticated`) direct-read hole, matching DEV. |
| `20261004_prod_reconcile_functions` | `CREATE OR REPLACE` for **65 functions** brought to the verified DEV definitions — `post_roznamcha_entry` (both overloads), `assert_enterprise_scope_access` (the no-JWT early-return the `withLocalPg` path needs), `is_super_admin` / `can_access_*`, `reverse_roznamcha_entry`, `write_erp_audit_log`, `next_transaction_serial`, and the HR-Payroll RPCs the UI calls (`list_employees_with_relations`, `insert_salary_due`, `finalize_salary_due_payment`, `apply_advance_loan_recovery`, …). UAE-tax functions excluded. |
| `20261005_prod_reconcile_missing_objects` | 8 tables that exist on DEV with **no migration file** — `crm_action_items`, `crm_followup_notes`, `sales_order_items`, `enterprise_audit_events`, `user_activity_events`, `saved_reports`, `report_auto_email_configs`, `daily_branch_summaries` — plus `daily_usd_rates` audit columns and `shipping_lines` 4-level serial columns. All `CREATE … IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. |

### 2c. Deferred — UAE Tax module (12)

`20260901`…`20260912` (`uae_tax_*`, `uae_vat_*`, `uae_e_invoice*`). **No release
component depends on them** (verified — no `20260914`+ migration or release code
path references a `uae_*` object). They ship with the separate UAE Tax &
e-Invoicing deployment.

---

## 3. Rehearsal results (isolated replica — production NOT touched)

| Check | Result |
|---|---|
| Replica = production baseline | schema **exact** (188 tbl / 691 idx / 193 pol / 696 fk / 118 chk / 80 trg / 9 view / 3365 col); data exact (profiles 72, employees 5, customers 17, ledgers 11, roznamcha 2/4, purchase_orders 0, permissions 105, user_role_assignments 68) |
| Corrective set applied | 53 migrations, **0 failures** |
| Replica after reconciliation | 235 tables, 878 indexes, 214 policies, 139 functions |
| Pre-existing data after reconciliation | **unchanged** — every pre-existing row count identical to production |
| FK integrity | 178 FK constraints with data — **0 orphan rows** |
| RLS | every release table RLS-ON, matching DEV; `employees` carries its 3 scoped policies |
| `post_purchase_order_payment` / `recalc_...` | **FIXED version** present |
| Multi-currency regression (`scratch/mc-regression-replica.mts`) | **79 / 79** — USD→AED, AED→AED, USD→USD, EUR→AED, partial, multiple, advance+final, over/under, duplicate-block, reversal |
| Historical-recalc regression | 30 / 30 POs — identical values (no drift) |
| AI Document Intake 18-scenario (`scratch/di-18-scenarios.mts`) | **18 / 18** on the replica |
| HR reconcile (`scratch/reconcile-check.mjs`) on DEV post-migration | Register = Run = Salary Due = Roznamcha Cr = true |
| App booted against the replica (`next dev`, port 3100) | dev-session auth 200; `hr/reports`, `hr-payroll/employees`, `document-intelligence`, `document-types`, `purchases/orders`, `settlement/dashboard`, `roznamcha` all **200** |
| Multi-currency purchase via the real HTTP route on the replica | PO `AE-001-0001` → transfer → payment row `amount 220 500 USD @ 3.675 → base 810 337.50 AED`, entry `original_currency_code USD`, roznamcha lines **DR = CR = 810 337.50 AED** (labelled AED, never "USD"). **USD 220 500 × 3.675 = AED 810 337.50** ✅ |
| DEV gates after the 3 new migrations | `i18n:guard` green · DI 18/18 · HR reconcile true |

---

## 4. Exact live production migration plan (Step 5 — needs owner GO)

> Run on the operator machine that holds the production pooler credentials.
> Never paste the connection string into shared logs.

```bash
# 0. pre-flight
git fetch origin && git checkout main && git pull        # HEAD must include the corrective migrations
git status --porcelain                                    # clean
npx tsc --noEmit                                          # 0
npm run build                                             # exit 0

# 1. BACK UP PRODUCTION FIRST  (already done 2026-08-29 —
#    backups/PROD-pre-release-2026-08-29T09-52-03-300Z, 188 tables, verified;
#    take a fresh one if time has passed)
DATABASE_URL="$PROD" node scripts/db-backup-engine.mjs --output "backups/PROD-pre-reconcile-$(date +%FT%H-%M-%S)"

# 2. rollback anchors
git tag prod-rollback-2026-08-29-pre-hrm-docintel ff7bffc && git push origin prod-rollback-2026-08-29-pre-hrm-docintel   # (already pushed)
ssh root@72.60.209.121 "cd /var/www/dgt-nextjs && git rev-parse HEAD"   # record

# 3. DRY RUN — confirm what will apply
TARGET_DB="$PROD" node scratch/prod-migrate.mjs dry

# 4. APPLY the corrective set (per-file transactions; stops on first failure)
TARGET_DB="$PROD" node scratch/apply-corrective-set.mjs

# 5. post-migration verification
DATABASE_URL="$PROD" node scratch/replica-integrity.mjs        # FK orphans 0, RLS on, functions FIXED
psql "$PROD" -c "NOTIFY pgrst, 'reload schema';"
ssh root@72.60.209.121 "pm2 restart dgt-nextjs && pm2 logs dgt-nextjs --lines 60 --nostream | grep -iE 'error|does not exist' | tail"

# 6. live smoke — https://dgt.llc
#    Login/Permissions → Purchase → Multi-currency payment (USD→AED) → Roznamcha →
#    Journal → Ledger → Settlement → Reports/Print/PDF → HRM → AI Doc Intake →
#    Shipping/Loading → 5 languages/RTL → Desktop/Mobile/Tablet
```

### Rollback

- **Code:** `git push origin +prod-rollback-2026-08-29-pre-hrm-docintel:main` then redeploy.
- **Functions:** `20261004` is `CREATE OR REPLACE` only — re-apply the prior bodies from
  `scratch/post_purchase_order_payment.sql` / `scratch/recalc_full.sql` /
  `scratch/fn-replica.json` if needed.
- **New tables/columns/RLS:** additive — harmless to leave in place after a code rollback.
  If a table genuinely must go, restore from the step-1 backup.

---

## 5. What is required from the owner

**A single explicit GO to run Step 4 (§4) against the live production database.**
Everything up to that point is rehearsed and reversible. Nothing else is outstanding.
