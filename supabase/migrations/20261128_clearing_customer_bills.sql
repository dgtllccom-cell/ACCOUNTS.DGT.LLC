-- ============================================================================
-- MIGRATION: 20261128_clearing_customer_bills.sql
-- Customer Bill workflow for Clearing & Shipping module.
-- Fully links Customer Orders -> Customer Bills -> General Ledger (Roznamcha).
-- Reuses existing Customer Account, Ledger, Goods, Shipment, Branch, Currency.
-- ============================================================================

DO $$
BEGIN
  -- 1. clearing_customer_bills
  CREATE TABLE IF NOT EXISTS public.clearing_customer_bills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.clearing_customer_orders(id) ON DELETE CASCADE,
    order_no text,
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    customer_name text,
    customer_account_id uuid REFERENCES public.enterprise_accounts(id),
    customer_account_number text,
    bill_no text NOT NULL,
    bill_date date NOT NULL DEFAULT current_date,
    due_date date,
    currency_code text NOT NULL DEFAULT 'USD',
    exchange_rate numeric(18,6) NOT NULL DEFAULT 1.0,
    
    -- Shipment / Route snapshot
    transport_mode text,
    movement_type text,
    shipment_type text,
    loading_port_name text,
    destination_port_name text,
    truck_number text,
    
    -- Financial Totals
    subtotal numeric(18,4) NOT NULL DEFAULT 0,
    tax_amount numeric(18,4) NOT NULL DEFAULT 0,
    discount_amount numeric(18,4) NOT NULL DEFAULT 0,
    other_charges numeric(18,4) NOT NULL DEFAULT 0,
    grand_total numeric(18,4) NOT NULL DEFAULT 0,
    paid_amount numeric(18,4) NOT NULL DEFAULT 0,
    balance_due numeric(18,4) NOT NULL DEFAULT 0,
    
    -- Status lifecycle: draft -> submitted -> approved -> posted -> paid -> cancelled
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'posted', 'paid', 'cancelled')),
    
    -- Audit & Approval
    submitted_by uuid REFERENCES public.profiles(id),
    submitted_at timestamptz,
    approved_by uuid REFERENCES public.profiles(id),
    approved_at timestamptz,
    posted_by uuid REFERENCES public.profiles(id),
    posted_at timestamptz,
    roznamcha_entry_id uuid,
    
    -- 4-level serial tracking
    super_admin_serial text,
    country_serial text,
    branch_serial text,
    entry_serial text,
    
    -- Multi-branch tenancy scope
    country_id uuid REFERENCES public.countries(id),
    country_branch_id uuid REFERENCES public.country_branches(id),
    city_branch_id uuid REFERENCES public.city_branches(id),
    
    remarks text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );

  CREATE INDEX IF NOT EXISTS clearing_customer_bills_order_idx
    ON public.clearing_customer_bills (order_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS clearing_customer_bills_customer_idx
    ON public.clearing_customer_bills (customer_id) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS clearing_customer_bills_status_idx
    ON public.clearing_customer_bills (status) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS clearing_customer_bills_bill_no_idx
    ON public.clearing_customer_bills (bill_no) WHERE deleted_at IS NULL;

  ALTER TABLE public.clearing_customer_bills ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS clearing_customer_bills_all_policy ON public.clearing_customer_bills;
  CREATE POLICY clearing_customer_bills_all_policy ON public.clearing_customer_bills
    FOR ALL USING (true) WITH CHECK (true);

  -- 2. clearing_customer_bill_items
  CREATE TABLE IF NOT EXISTS public.clearing_customer_bill_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id uuid NOT NULL REFERENCES public.clearing_customer_bills(id) ON DELETE CASCADE,
    item_order integer NOT NULL DEFAULT 0,
    charge_type text NOT NULL DEFAULT 'freight',
    charge_name text NOT NULL,
    description text,
    quantity numeric(18,4) NOT NULL DEFAULT 1,
    unit text DEFAULT 'unit',
    rate numeric(18,4) NOT NULL DEFAULT 0,
    amount numeric(18,4) NOT NULL DEFAULT 0,
    tax_pct numeric(8,2) NOT NULL DEFAULT 0,
    tax_amount numeric(18,4) NOT NULL DEFAULT 0,
    total_amount numeric(18,4) NOT NULL DEFAULT 0,
    remarks text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
  );

  CREATE INDEX IF NOT EXISTS clearing_customer_bill_items_bill_idx
    ON public.clearing_customer_bill_items (bill_id) WHERE deleted_at IS NULL;

  ALTER TABLE public.clearing_customer_bill_items ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS clearing_customer_bill_items_all_policy ON public.clearing_customer_bill_items;
  CREATE POLICY clearing_customer_bill_items_all_policy ON public.clearing_customer_bill_items
    FOR ALL USING (true) WITH CHECK (true);

END $$;
