-- ==============================================================================
-- Migration: Hardened RLS and Cleanup for Account Categories (Safe Non-Destructive)
-- 1. Drops the overly-permissive account_categories_all_policy (USING true / WITH CHECK true)
-- 2. Establishes secure RLS policies for read and admin-managed write
-- 3. Safely deactivates test/junk categories without deleting rows (is_active = false)
-- 4. Ensures the 13 approved business and shipping categories are active and standard
-- 5. Preserves all accounts assigned to category S or other valid categories
-- ==============================================================================

DO $$
BEGIN

  -- 1. Replace overly-permissive RLS policy on account_categories
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'account_categories'
  ) THEN
    ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS account_categories_all_policy ON public.account_categories;
    DROP POLICY IF EXISTS account_categories_read_policy ON public.account_categories;
    DROP POLICY IF EXISTS account_categories_insert_policy ON public.account_categories;
    DROP POLICY IF EXISTS account_categories_update_policy ON public.account_categories;
    DROP POLICY IF EXISTS account_categories_delete_policy ON public.account_categories;

    -- Permissive read for non-deleted active categories
    CREATE POLICY account_categories_read_policy ON public.account_categories
      FOR SELECT
      USING (deleted_at IS NULL);

    -- Admin/staff write policy
    CREATE POLICY account_categories_write_policy ON public.account_categories
      FOR ALL
      TO authenticated
      USING (
        deleted_at IS NULL AND (
          EXISTS (
            SELECT 1 FROM public.user_role_assignments ura
            JOIN public.roles r ON r.id = ura.role_id
            WHERE ura.user_id = auth.uid()
              AND r.name IN ('super_admin', 'country_admin', 'admin', 'accountant', 'finance_manager')
          )
          OR auth.jwt() ->> 'role' = 'service_role'
        )
      )
      WITH CHECK (
        deleted_at IS NULL AND (
          EXISTS (
            SELECT 1 FROM public.user_role_assignments ura
            JOIN public.roles r ON r.id = ura.role_id
            WHERE ura.user_id = auth.uid()
              AND r.name IN ('super_admin', 'country_admin', 'admin', 'accountant', 'finance_manager')
          )
          OR auth.jwt() ->> 'role' = 'service_role'
        )
      );

    -- 2. Safely deactivate accidental test/junk categories without dropping records
    UPDATE public.account_categories
    SET is_active = false, updated_at = now()
    WHERE deleted_at IS NULL
      AND (
        code IN ('001', '010', '0121', '1', '420', 'AN', 'AS', 'ا س', 'چمن')
        OR lower(name) IN ('pocket money', 'u', 'g', '420', 'test', 'demo', 'as', 'an')
      );

    -- 3. Ensure the 13 approved canonical business and shipping categories exist and are active
    -- Canonical Business Categories
    INSERT INTO public.account_categories (code, name, description, account_type, operational_domain, is_active, is_system, sort_order)
    VALUES
      ('P/S', 'Purchases & Sales / Trading', 'Accounts for core trading, customer invoicing, supplier purchases', 'Customer', 'business', true, true, 10),
      ('B/C', 'Bank & Cash Accounts', 'Liquid cash counters, bank operational accounts, petty cash', 'Bank', 'business', true, true, 20),
      ('B/P', 'Bills & Payables', 'Trade vendor bills, recurring payables, freight invoices', 'Company', 'business', true, true, 30),
      ('EX', 'General Operating Expenses', 'Administrative overhead, supplies, communication, daily operations', 'Expenses Account', 'business', true, true, 40),
      ('S', 'Staff & Payroll Expenses', 'Employee basic salaries, allowances, bonuses, reimbursements', 'Expenses Account', 'business', true, true, 50),
      ('OFFICE_EXP', 'Office & Administrative Expenses', 'Rent, stationery, computer hardware, maintenance', 'Expenses Account', 'business', true, true, 60),
      ('TRAVEL_EXP', 'Travel & Conveyance Expenses', 'Field travel, boarding, lodging, transport costs', 'Expenses Account', 'business', true, true, 70),
      ('UTILITY_EXP', 'Utilities & Facilities', 'Electricity, water, gas, broadband internet services', 'Expenses Account', 'business', true, true, 80),
      ('TAX_EXP', 'Tax & Statutory Dues', 'VAT, income tax withholding, customs tariffs, government fees', 'Expenses Account', 'business', true, true, 90),
      -- Canonical Shipping & Clearing Categories
      ('SHIPPING_LINE', 'Shipping Lines & Vessel Operators', 'Carriers, container operators, slot charters, freight bookings', 'Shipping Line', 'shipping', true, true, 100),
      ('CLEARING_AGENT', 'Clearing & Forwarding Agents', 'Customs clearance brokers, forwarding agents, transit handlers', 'Clearing Agent', 'shipping', true, true, 110),
      ('CUSTOMS_PORT', 'Port, Customs & Terminal Operators', 'Port authorities, terminal operators, customs inspection agencies', 'Vendor', 'shipping', true, true, 120),
      ('CONTAINER_RENT', 'Container Depot & Yard Operations', 'Container leasing, yard storage, detention and demurrage', 'Vendor', 'shipping', true, true, 130)
    ON CONFLICT (code) DO UPDATE
    SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      account_type = EXCLUDED.account_type,
      operational_domain = EXCLUDED.operational_domain,
      is_active = true,
      deleted_at = NULL,
      updated_at = now();

    -- Ensure category S specifically is active and correctly mapped
    UPDATE public.account_categories
    SET is_active = true, operational_domain = 'business', deleted_at = NULL, updated_at = now()
    WHERE code = 'S';

  END IF;

END $$;
