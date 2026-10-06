-- ============================================================================
-- MIGRATION: 20261122_shipping_billing_receipts_approval.sql
-- Shipping Customer Order — billing, receipts, approval workflow extension.
-- 1. Order-level approval columns on clearing_customer_orders
-- 2. Order/customer link on clearing_payment_bills
-- 3. New table: clearing_bill_customer_charges (customer charge / revenue side,
--    deliberately separate from bill_expense_lines, the actual-expense side)
-- 4. New tables: customer_receipts + customer_receipt_allocations
-- 5. operational_domain column on roznamcha_entries (business/shipping tagging)
-- 6. Shipping revenue account category seed (Income Account type)
-- 7. Translation registry for new free-text fields
-- All additive — no destructive changes, no existing column/table dropped or
-- renamed, no CHECK constraint tightened on any existing row.
-- ============================================================================

DO $$
BEGIN
  -- 1. clearing_customer_orders approval columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clearing_customer_orders' AND column_name = 'requested_by'
  ) THEN
    ALTER TABLE public.clearing_customer_orders ADD COLUMN requested_by uuid REFERENCES public.profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clearing_customer_orders' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.clearing_customer_orders ADD COLUMN approved_by uuid REFERENCES public.profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clearing_customer_orders' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.clearing_customer_orders ADD COLUMN approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clearing_customer_orders' AND column_name = 'rejected_reason'
  ) THEN
    ALTER TABLE public.clearing_customer_orders ADD COLUMN rejected_reason text;
  END IF;

  -- 2. clearing_payment_bills order/customer link
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clearing_payment_bills' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE public.clearing_payment_bills ADD COLUMN order_id uuid REFERENCES public.clearing_customer_orders(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clearing_payment_bills' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE public.clearing_payment_bills ADD COLUMN customer_id uuid REFERENCES public.customers(id);
  END IF;

  -- 3. clearing_bill_customer_charges — customer charge / revenue side
  CREATE TABLE IF NOT EXISTS public.clearing_bill_customer_charges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.clearing_payment_bills(id) ON DELETE CASCADE,
    order_id uuid REFERENCES public.clearing_customer_orders(id),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    charge_type text NOT NULL DEFAULT 'other',
    currency_code text NOT NULL DEFAULT 'USD',
    amount numeric(18,4) NOT NULL DEFAULT 0,
    remarks text,
    posting_status text NOT NULL DEFAULT 'unposted' CHECK (posting_status IN ('unposted', 'posted', 'void')),
    revenue_account_id uuid,
    customer_account_id uuid,
    roznamcha_entry_id uuid,
    posted_at timestamptz,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );

  CREATE INDEX IF NOT EXISTS clearing_bill_customer_charges_bill_idx
    ON public.clearing_bill_customer_charges (bill_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS clearing_bill_customer_charges_customer_idx
    ON public.clearing_bill_customer_charges (customer_id) WHERE deleted_at IS NULL;

  ALTER TABLE public.clearing_bill_customer_charges ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS clearing_bill_customer_charges_all_policy ON public.clearing_bill_customer_charges;
  CREATE POLICY clearing_bill_customer_charges_all_policy ON public.clearing_bill_customer_charges
    FOR ALL USING (true) WITH CHECK (true);

  -- 4. customer_receipts + customer_receipt_allocations
  CREATE TABLE IF NOT EXISTS public.customer_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_no text,
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    country_id uuid REFERENCES public.countries(id),
    country_branch_id uuid REFERENCES public.country_branches(id),
    city_branch_id uuid REFERENCES public.city_branches(id),
    receipt_date date NOT NULL DEFAULT current_date,
    currency_code text NOT NULL DEFAULT 'USD',
    amount numeric(18,4) NOT NULL DEFAULT 0,
    payment_method text NOT NULL DEFAULT 'cash',
    bank_id uuid REFERENCES public.banks(id),
    cash_ledger_id uuid,
    allocation_type text NOT NULL DEFAULT 'unallocated' CHECK (allocation_type IN ('business', 'shipping', 'split', 'unallocated')),
    remarks text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
    roznamcha_entry_id uuid,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );

  CREATE TABLE IF NOT EXISTS public.customer_receipt_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id uuid NOT NULL REFERENCES public.customer_receipts(id) ON DELETE CASCADE,
    domain text NOT NULL CHECK (domain IN ('business', 'shipping', 'unallocated')),
    amount numeric(18,4) NOT NULL DEFAULT 0,
    target_ledger_id uuid NOT NULL,
    reference_type text,
    reference_id uuid,
    remarks text,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS customer_receipts_customer_idx
    ON public.customer_receipts (customer_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS customer_receipt_allocations_receipt_idx
    ON public.customer_receipt_allocations (receipt_id);

  ALTER TABLE public.customer_receipts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS customer_receipts_all_policy ON public.customer_receipts;
  CREATE POLICY customer_receipts_all_policy ON public.customer_receipts
    FOR ALL USING (true) WITH CHECK (true);

  ALTER TABLE public.customer_receipt_allocations ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS customer_receipt_allocations_all_policy ON public.customer_receipt_allocations;
  CREATE POLICY customer_receipt_allocations_all_policy ON public.customer_receipt_allocations
    FOR ALL USING (true) WITH CHECK (true);

  -- 5. roznamcha_entries domain tagging (nullable, no CHECK — same convention as
  -- other lightly-used tag columns in this codebase; populated by the posting
  -- engine, never required on existing historical rows)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roznamcha_entries' AND column_name = 'operational_domain'
  ) THEN
    ALTER TABLE public.roznamcha_entries ADD COLUMN operational_domain text;
  END IF;

  -- 6. Shipping revenue account category (Income Account type) — additive seed,
  -- alongside the existing LOGISTICS_EXP expense category from 20261118.
  IF NOT EXISTS (SELECT 1 FROM public.account_categories WHERE code = 'SHIP_REV') THEN
    INSERT INTO public.account_categories (code, name, description, account_type, operational_domain)
    VALUES ('SHIP_REV', 'Shipping & Clearing Revenue', 'Customer charges for freight, customs clearance, and shipping services', 'Income Account', 'shipping')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 7. Translation registry — only genuinely free customer-facing text fields.
  -- charge_type / allocation_type / status / payment_method are codes, their
  -- display labels live in lib/i18n/ui.ts, not record_translations.
  INSERT INTO public.translation_field_registry (table_name, field_name, mode)
  VALUES
    ('clearing_bill_customer_charges', 'remarks', 'translate'),
    ('customer_receipts', 'remarks', 'translate')
  ON CONFLICT (table_name, field_name) DO NOTHING;

END $$;

SELECT public.attach_translation_triggers();
