-- =====================================================================
-- PRODUCTION TEST-DATA CLEANUP  (Digital Dock ERP)
-- =====================================================================
-- PURPOSE: Remove ALL test transactional / business data so the system
--   starts clean for production, while KEEPING all system configuration,
--   master data, the 4 production countries, and admin users.
--
-- SAFETY MODEL:
--   * Runs entirely inside ONE transaction.
--   * Ends with ROLLBACK  => running it as-is is a DRY RUN. It prints,
--     via NOTICE, how many rows WOULD be deleted from each table, and
--     changes nothing.
--   * To actually apply: read the NOTICES, confirm the counts look right,
--     then change the final `ROLLBACK;` to `COMMIT;` and run once more.
--   * Every DELETE is guarded by to_regclass, so a missing table is
--     skipped instead of erroring.
--
-- >>> BEFORE RUNNING (even the dry run), TAKE A FULL DATABASE BACKUP: <<<
--       pg_dump "$DATABASE_URL" -Fc -f backup_before_cleanup.dump
--     (or Supabase Dashboard -> Database -> Backups -> create backup)
--
-- WHAT IS **KEPT** (never touched by this script):
--   countries, states_provinces, districts, cities, postal_codes,
--   country_company_profiles (branding), roles, permissions,
--   role_permissions, user_role_assignments, user_permission_sets,
--   erp_role_templates(+permissions), languages, translation_keys,
--   translation_values, record_translations, product_translations,
--   currency_rates, daily_usd_rates, exchange_rate_history, tax_codes,
--   payment_methods, contact_types, account_groups, account_types,
--   erp_modules, module_settings, report_definitions, and all master
--   catalogs (goods, products, banks, warehouses, areas_locations,
--   product_units/brands/categories, ports). Users are pruned in the
--   OPTIONAL section further down (disabled by default).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SECTION 1 — Clear transactional / business-entity data.
-- Full-table clears; FK order is neutralised for the duration of the
-- transaction only (reset automatically at COMMIT/ROLLBACK).
-- ---------------------------------------------------------------------
SET LOCAL session_replication_role = 'replica';  -- suspend FK/trigger checks for bulk clear

DO $cleanup$
DECLARE
  t      text;
  n      bigint;
  total  bigint := 0;
  tbls   text[] := ARRAY[
    -- Sales
    'sales_order_payments','sales_orders',
    -- Purchases
    'purchase_order_payments','purchase_order_expenses','purchase_order_items',
    'purchase_order_reports','purchase_loading_records','purchase_orders','local_purchases',
    -- Customers (transactional business entities — test only)
    'customer_contacts','customer_registrations','customers',
    -- Employees (test only)
    'employee_advances_loans','employee_salaries_due','employees',
    -- Journal / Roznamcha
    'journal_lines','journal_reversals','journal_entries',
    'roznamcha_lines','roznamcha_reversals','roznamcha_entries',
    -- Ledger (posted/derived movement — safe to clear with the source docs)
    'ledger_posting_lines','ledger_posting_batches','ledger_transaction_audit_trail',
    'inter_branch_ledger_transfers','enterprise_ledger_reversals','ledger_entries',
    'ledger_balances','ledger_opening_balances','ledgers',
    -- Treasury / exchange
    'money_exchange_entries','usd_purchase_sales','transactions',
    'expenses_bill_lines','expenses_bills',
    -- Clearing agent / logistics
    'shipment_documents','shipping_bl_records','purchase_loading_records',
    'import_truck_loadings','transit_truck_loadings','truck_loadings','trucks',
    -- Documents & attachments
    'erp_document_versions','erp_documents','attachments','communication_attachments',
    -- Approvals / record movement / locks / idempotency (test residue)
    'approval_status_history','approval_request_items','approval_requests',
    'erp_record_transfers','record_change_history','record_locks',
    'idempotency_keys',
    -- Communication / whatsapp message traffic (keep templates & accounts)
    'communication_messages','communication_conversations','communication_center_messages',
    'communication_center_followups','communication_center_leads',
    'whatsapp_messages','whatsapp_message_media','whatsapp_conversations','whatsapp_activity_log'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        EXECUTE format('DELETE FROM public.%I', t);
        RAISE NOTICE 'cleared % : % rows', rpad(t,32), n;
        total := total + n;
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE '--------------------------------------------------';
  RAISE NOTICE 'TOTAL rows to delete (transactional): %', total;
END
$cleanup$;

-- ---------------------------------------------------------------------
-- SECTION 2 (OPTIONAL) — reset per-form serial sequences so the FIRST
-- real production entry starts at 1 again. Uncomment to enable.
-- ---------------------------------------------------------------------
-- DO $seq$
-- BEGIN
--   IF to_regclass('public.transaction_serial_sequences') IS NOT NULL THEN
--     DELETE FROM public.transaction_serial_sequences;
--     RAISE NOTICE 'serial sequences reset';
--   END IF;
--   IF to_regclass('public.voucher_sequences') IS NOT NULL THEN
--     DELETE FROM public.voucher_sequences;
--   END IF;
--   IF to_regclass('public.module_number_sequences') IS NOT NULL THEN
--     DELETE FROM public.module_number_sequences;
--   END IF;
-- END $seq$;

-- ---------------------------------------------------------------------
-- SECTION 3 (OPTIONAL, DISABLED) — prune TEST branches / companies /
-- users. This is disabled by default because it needs YOU to confirm
-- which branch is the "main" branch to keep for each country, and which
-- user accounts are the real admins. Review, edit the keeper lists, then
-- uncomment.
-- ---------------------------------------------------------------------
-- -- 3a. Keep only the designated MAIN country branch per country.
-- --     Fill in the branch IDs you want to KEEP:
-- -- DELETE FROM public.city_branches   WHERE id <> ALL (ARRAY['<keep-uuid>','...']::uuid[]);
-- -- DELETE FROM public.country_branches WHERE id <> ALL (ARRAY['<keep-uuid>','...']::uuid[]);
-- -- DELETE FROM public.branches         WHERE id <> ALL (ARRAY['<keep-uuid>','...']::uuid[]);
-- -- DELETE FROM public.companies        WHERE id <> ALL (ARRAY['<keep-uuid>','...']::uuid[]);
--
-- -- 3b. Keep only Super Admin + the 4 Country Admins. Delete every other
-- --     profile that is NOT assigned a super_admin / country_admin role.
-- -- DELETE FROM public.profiles p
-- --  WHERE NOT EXISTS (
-- --    SELECT 1 FROM public.user_role_assignments ura
-- --      JOIN public.roles r ON r.id = ura.role_id
-- --     WHERE ura.user_id = p.id
-- --       AND r.slug IN ('super_admin','country_admin')
-- --  );

-- =====================================================================
-- DRY RUN by default. Review the NOTICES above.
-- When satisfied, change ROLLBACK to COMMIT and run again to apply.
-- =====================================================================
ROLLBACK;
-- COMMIT;
