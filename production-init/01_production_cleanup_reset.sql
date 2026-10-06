-- =====================================================================
--  DIGITAL DOCK ERP — PRODUCTION CLEANUP + DATA RESET
--  File 1 of 3  (run AFTER File 0 backup; run BEFORE File 2 location seed)
-- ---------------------------------------------------------------------
--  ⚠️  DESTRUCTIVE. This deletes/soft-deletes production records.
--  ⚠️  Claude did NOT and CANNOT run this on your DB. YOU run it.
--
--  BEFORE YOU RUN:
--    1. TAKE A FULL BACKUP (see File 0 / command below). No backup = no run.
--    2. Fill in the <<PLACEHOLDER>> lists (branch codes + admin emails).
--    3. Run each STEP inside a transaction, review the PREVIEW SELECT,
--       and only COMMIT when the preview looks correct. ROLLBACK otherwise.
--
--  BACKUP COMMAND (run in your shell, not here):
--    pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M).dump
--
--  Schema facts this script relies on (verified against your migrations):
--    countries(id uuid, name, iso2, currency_code, is_active, deleted_at)
--    country_branches(id, country_id, name, code, is_main bool, deleted_at)
--    city_branches(id, country_id, country_branch_id, name, code, deleted_at)
--    profiles(id uuid = auth.users.id), user_role_assignments, memberships
--  All these tables use SOFT DELETE (deleted_at). We prefer soft-delete for
--  FK safety; hard TRUNCATE is only used for transactional data in STEP 4.
-- =====================================================================


-- =====================================================================
-- STEP 1 — COUNTRIES: keep only the five, soft-delete the rest
-- =====================================================================
BEGIN;

-- PREVIEW (what will be soft-deleted):
SELECT id, name, iso2, currency_code
FROM   public.countries
WHERE  deleted_at IS NULL
  AND  iso2 NOT IN ('AE','PK','AF','IN','IR')
  AND  name  NOT IN ('United Arab Emirates','Pakistan','Afghanistan','India','Iran');

-- APPLY:
UPDATE public.countries
SET    deleted_at = now(), is_active = false, updated_at = now()
WHERE  deleted_at IS NULL
  AND  iso2 NOT IN ('AE','PK','AF','IN','IR')
  AND  name  NOT IN ('United Arab Emirates','Pakistan','Afghanistan','India','Iran');

-- Review the two results above, then:
-- COMMIT;   -- or  ROLLBACK;
ROLLBACK;   -- <-- change to COMMIT after you verify the preview


-- =====================================================================
-- STEP 2 — BRANCHES: keep ONE main branch per country; drop the rest
-- ---------------------------------------------------------------------
-- You chose "I will give the names/emails". Put the branch CODES you want
-- to KEEP here (one main branch per country). Everything else (other main
-- branches, ALL city branches, legacy branches) is soft-deleted.
-- =====================================================================
BEGIN;

-- >>> EDIT THIS LIST: the country_branches.code values to KEEP (one per country)
--     Example: ('UAE-MB','PK-MB','AF-MB','IN-MB','IR-MB')
WITH keep_codes AS (
  SELECT unnest(ARRAY[
     '<<UAE_MAIN_BRANCH_CODE>>',
     '<<PK_MAIN_BRANCH_CODE>>',
     '<<AF_MAIN_BRANCH_CODE>>',
     '<<IN_MAIN_BRANCH_CODE>>',
     '<<IR_MAIN_BRANCH_CODE>>'
  ]) AS code
)
-- PREVIEW country_branches that WILL be removed:
SELECT cb.id, c.name AS country, cb.name, cb.code, cb.is_main
FROM   public.country_branches cb
JOIN   public.countries c ON c.id = cb.country_id
WHERE  cb.deleted_at IS NULL
  AND  cb.code NOT IN (SELECT code FROM keep_codes);

-- APPLY (country branches not in keep list):
UPDATE public.country_branches
SET    deleted_at = now(), status = 'inactive', updated_at = now()
WHERE  deleted_at IS NULL
  AND  code NOT IN (
     '<<UAE_MAIN_BRANCH_CODE>>','<<PK_MAIN_BRANCH_CODE>>',
     '<<AF_MAIN_BRANCH_CODE>>','<<IN_MAIN_BRANCH_CODE>>','<<IR_MAIN_BRANCH_CODE>>'
  );

-- APPLY (remove ALL city branches — production starts with main branches only):
UPDATE public.city_branches
SET    deleted_at = now(), status = 'inactive', updated_at = now()
WHERE  deleted_at IS NULL;

-- APPLY (legacy 'branches' table, if used):
UPDATE public.branches
SET    deleted_at = now(), updated_at = now()
WHERE  deleted_at IS NULL;

-- COMMIT;   -- after verifying the preview
ROLLBACK;   -- <-- change to COMMIT


-- =====================================================================
-- STEP 3 — USERS: keep 1 Super Admin + 1 Country Admin per country
-- ---------------------------------------------------------------------
-- profiles.id == auth.users.id. Deleting a user is an AUTH operation.
-- Put the exact emails to KEEP below (6 total). Everything else is removed.
-- Run the PREVIEW first; it lists who would be deleted.
-- =====================================================================
BEGIN;

-- >>> EDIT: emails to KEEP (1 super admin + 5 country admins)
WITH keep AS (
  SELECT lower(unnest(ARRAY[
     '<<SUPER_ADMIN_EMAIL>>',
     '<<UAE_COUNTRY_ADMIN_EMAIL>>',
     '<<PK_COUNTRY_ADMIN_EMAIL>>',
     '<<AF_COUNTRY_ADMIN_EMAIL>>',
     '<<IN_COUNTRY_ADMIN_EMAIL>>',
     '<<IR_COUNTRY_ADMIN_EMAIL>>'
  ])) AS email
)
-- PREVIEW users to be deleted:
SELECT u.id, u.email, p.full_name
FROM   auth.users u
LEFT   JOIN public.profiles p ON p.id = u.id
WHERE  lower(u.email) NOT IN (SELECT email FROM keep)
ORDER  BY u.email;

-- APPLY — remove role/membership rows for non-kept users first (FK hygiene):
DELETE FROM public.user_role_assignments
WHERE  user_id IN (
  SELECT u.id FROM auth.users u
  WHERE lower(u.email) NOT IN (
    '<<SUPER_ADMIN_EMAIL>>','<<UAE_COUNTRY_ADMIN_EMAIL>>','<<PK_COUNTRY_ADMIN_EMAIL>>',
    '<<AF_COUNTRY_ADMIN_EMAIL>>','<<IN_COUNTRY_ADMIN_EMAIL>>','<<IR_COUNTRY_ADMIN_EMAIL>>'
  )
);
DELETE FROM public.memberships
WHERE  user_id IN (
  SELECT u.id FROM auth.users u
  WHERE lower(u.email) NOT IN (
    '<<SUPER_ADMIN_EMAIL>>','<<UAE_COUNTRY_ADMIN_EMAIL>>','<<PK_COUNTRY_ADMIN_EMAIL>>',
    '<<AF_COUNTRY_ADMIN_EMAIL>>','<<IN_COUNTRY_ADMIN_EMAIL>>','<<IR_COUNTRY_ADMIN_EMAIL>>'
  )
);

-- APPLY — delete the auth users (cascades to profiles if FK is ON DELETE CASCADE;
--         if not, delete from public.profiles first with the same filter):
DELETE FROM auth.users u
WHERE  lower(u.email) NOT IN (
  '<<SUPER_ADMIN_EMAIL>>','<<UAE_COUNTRY_ADMIN_EMAIL>>','<<PK_COUNTRY_ADMIN_EMAIL>>',
  '<<AF_COUNTRY_ADMIN_EMAIL>>','<<IN_COUNTRY_ADMIN_EMAIL>>','<<IR_COUNTRY_ADMIN_EMAIL>>'
);

-- COMMIT;   -- after verifying preview
ROLLBACK;   -- <-- change to COMMIT


-- =====================================================================
-- STEP 4 — TRANSACTIONAL DATA RESET (fresh production)
-- ---------------------------------------------------------------------
-- KEEPS master data + settings + chart of accounts + locations + config.
-- CLEARS purchase, sales, journal, ledger movements, roznamcha, payments,
-- inventory balances, employee records, generic transactions, expenses.
-- TRUNCATE ... RESTART IDENTITY CASCADE is atomic and resets sequences.
-- =====================================================================
BEGIN;

-- Tier A — CONFIRMED transactional tables (safe to clear):
TRUNCATE TABLE
  public.purchase_order_payments,
  public.purchase_order_expenses,
  public.purchase_order_items,
  public.purchase_order_reports,
  public.purchase_loading_records,
  public.purchase_orders,
  public.local_purchases,
  public.sales_order_payments,
  public.sales_orders,
  public.journal_lines,
  public.journal_reversals,
  public.journal_entries,
  public.roznamcha_lines,
  public.roznamcha_reversals,
  public.roznamcha_entries,
  public.ledger_entries,
  public.ledger_posting_lines,
  public.ledger_posting_batches,
  public.ledger_transaction_audit_trail,
  public.ledger_balances,
  public.ledger_opening_balances,
  public.enterprise_ledger_reversals,
  public.inter_branch_ledger_transfers,
  public.enterprise_account_history,
  public.transactions,
  public.expenses_bill_lines,
  public.expenses_bills,
  public.money_exchange_entries,
  public.usd_purchase_sales,
  public.product_inventory_balances,
  public.employee_advances_loans,
  public.employee_salaries_due,
  public.employees
RESTART IDENTITY CASCADE;

-- Reset numbering counters so live production starts fresh:
TRUNCATE TABLE
  public.transaction_serial_sequences,
  public.voucher_sequences,
  public.module_number_sequences
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- Tier B — REVIEW before clearing (uncomment ONLY if you want these gone).
-- These are ambiguous between "transactional" and "master/config":
--   ledgers                -> ledger ACCOUNTS master (usually KEEP)
--   accounts/enterprise_accounts/account_groups/account_types -> chart of
--                             accounts = configuration (usually KEEP)
--   shipping_line_records, shipping_bl_records, shipment_documents
--   clearing_agents, clearing_agent_branches
--   approval_requests, approval_request_items, approval_status_history
--   exchange_rate_history, currency_rates, daily_usd_rates (rate history)
--   erp_email_messages, erp_pdf_email_jobs, communication_*, whatsapp_*
-- Example (leave commented unless intended):
--   TRUNCATE TABLE public.shipping_bl_records, public.shipping_line_records,
--                  public.shipment_documents RESTART IDENTITY CASCADE;
-- ---------------------------------------------------------------------

-- COMMIT;   -- after you are satisfied
ROLLBACK;   -- <-- change to COMMIT


-- =====================================================================
-- STEP 5 — VERIFICATION (read-only; run after COMMITting steps 1-4)
-- =====================================================================
-- 5.1 Exactly five active countries:
SELECT count(*) AS active_countries FROM public.countries WHERE deleted_at IS NULL;   -- expect 5

-- 5.2 One main branch per country, no city branches:
SELECT c.name, count(cb.*) AS main_branches
FROM public.countries c
LEFT JOIN public.country_branches cb
  ON cb.country_id = c.id AND cb.deleted_at IS NULL AND cb.is_main
WHERE c.deleted_at IS NULL
GROUP BY c.name ORDER BY c.name;                                                      -- expect 1 each
SELECT count(*) AS active_city_branches FROM public.city_branches WHERE deleted_at IS NULL;  -- expect 0

-- 5.3 Six users kept:
SELECT count(*) AS remaining_users FROM auth.users;                                   -- expect 6

-- 5.4 Transactional tables empty:
SELECT 'purchase_orders' t, count(*) n FROM public.purchase_orders
UNION ALL SELECT 'sales_orders', count(*) FROM public.sales_orders
UNION ALL SELECT 'journal_entries', count(*) FROM public.journal_entries
UNION ALL SELECT 'ledger_entries', count(*) FROM public.ledger_entries
UNION ALL SELECT 'roznamcha_entries', count(*) FROM public.roznamcha_entries
UNION ALL SELECT 'transactions', count(*) FROM public.transactions
UNION ALL SELECT 'employees', count(*) FROM public.employees;                          -- expect 0

-- 5.5 Master data preserved (should be > 0 / unchanged):
SELECT 'customers' t, count(*) n FROM public.customers
UNION ALL SELECT 'goods', count(*) FROM public.goods
UNION ALL SELECT 'products', count(*) FROM public.products
UNION ALL SELECT 'enterprise_accounts', count(*) FROM public.enterprise_accounts
UNION ALL SELECT 'module_settings', count(*) FROM public.module_settings
UNION ALL SELECT 'roles', count(*) FROM public.roles;

-- 5.6 No orphaned foreign keys after cleanup (spot checks):
SELECT count(*) AS orphan_country_branches
FROM public.country_branches cb
LEFT JOIN public.countries c ON c.id = cb.country_id
WHERE cb.deleted_at IS NULL AND (c.id IS NULL OR c.deleted_at IS NOT NULL);            -- expect 0
