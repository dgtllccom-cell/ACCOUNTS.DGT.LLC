-- Migration: 20261212_customer_order_external_partner_bills.sql
-- Strengthens Customer Order route legs handled by external partners
-- (customs agent, transporter, shipping provider, etc.) with accounting linkage:
-- - Route leg: handler_type ('our_branch' | 'external_partner'), partner_type, partner_name, partner_account_id
-- - Clearing payment bills: provider_account_id, expense_account_id, invoice_ref, expense_category, posting_status, roznamcha_entry_id, paid_amount, remaining_balance
-- - New table: clearing_payment_bill_payments for partial and full payments against provider bills
-- Additive & idempotent.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. clearing_customer_order_legs: External Partner attribution
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clearing_customer_order_legs
  ADD COLUMN IF NOT EXISTS handler_type text DEFAULT 'our_branch'
    CHECK (handler_type IN ('our_branch', 'external_partner')),
  ADD COLUMN IF NOT EXISTS partner_type text
    CHECK (partner_type IN ('customs_agent', 'transporter', 'shipping_provider', 'airline', 'railway', 'other_partner')),
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS partner_account_id uuid REFERENCES public.ledgers(id),
  ADD COLUMN IF NOT EXISTS partner_account_number text,
  ADD COLUMN IF NOT EXISTS partner_country_name text;

CREATE INDEX IF NOT EXISTS idx_clearing_customer_order_legs_partner_account
  ON public.clearing_customer_order_legs (partner_account_id)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. clearing_payment_bills: Provider accounting, posting, and balance columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clearing_payment_bills
  ADD COLUMN IF NOT EXISTS provider_account_id uuid REFERENCES public.ledgers(id),
  ADD COLUMN IF NOT EXISTS expense_account_id uuid REFERENCES public.ledgers(id),
  ADD COLUMN IF NOT EXISTS invoice_ref text,
  ADD COLUMN IF NOT EXISTS expense_category text DEFAULT 'customs_clearance',
  ADD COLUMN IF NOT EXISTS country_of_service text,
  ADD COLUMN IF NOT EXISTS posting_status text DEFAULT 'unposted'
    CHECK (posting_status IN ('draft', 'unposted', 'posted', 'void')),
  ADD COLUMN IF NOT EXISTS roznamcha_entry_id uuid REFERENCES public.roznamcha_entries(id),
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(18,6) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supporting_documents jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_balance numeric(18,4) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clearing_payment_bills_provider_account
  ON public.clearing_payment_bills (provider_account_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clearing_payment_bills_posting_status
  ON public.clearing_payment_bills (posting_status)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. clearing_payment_bill_payments: Payments against provider bills
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clearing_payment_bill_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id             uuid NOT NULL REFERENCES public.clearing_payment_bills(id) ON DELETE CASCADE,
  order_id            uuid REFERENCES public.clearing_customer_orders(id),
  leg_id              uuid REFERENCES public.clearing_customer_order_legs(id),
  payment_serial      integer NOT NULL DEFAULT 1,
  payment_no          text,
  payment_date        date NOT NULL DEFAULT current_date,
  amount              numeric(18,4) NOT NULL CHECK (amount > 0),
  currency_code       text NOT NULL DEFAULT 'USD',
  exchange_rate       numeric(18,6) NOT NULL DEFAULT 1,
  provider_account_id uuid NOT NULL REFERENCES public.ledgers(id),
  payment_account_id  uuid NOT NULL REFERENCES public.ledgers(id),
  payment_method      text DEFAULT 'bank_transfer',
  reference_no        text,
  narration           text,
  roznamcha_entry_id  uuid REFERENCES public.roznamcha_entries(id),
  created_by          uuid REFERENCES public.profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_clearing_payment_bill_payments_bill
  ON public.clearing_payment_bill_payments (bill_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clearing_payment_bill_payments_order
  ON public.clearing_payment_bill_payments (order_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clearing_payment_bill_payments_leg
  ON public.clearing_payment_bill_payments (leg_id)
  WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger to sync bill paid_amount and remaining_balance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_clearing_payment_bill_balance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_bill_id uuid;
  v_total numeric(18,4);
  v_paid numeric(18,4);
  v_remaining numeric(18,4);
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_bill_id := OLD.bill_id;
  ELSE
    v_bill_id := NEW.bill_id;
  END IF;

  SELECT total_amount INTO v_total
  FROM public.clearing_payment_bills
  WHERE id = v_bill_id;

  v_total := COALESCE(v_total, 0);

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.clearing_payment_bill_payments
  WHERE bill_id = v_bill_id AND deleted_at IS NULL;

  v_remaining := GREATEST(0, v_total - v_paid);

  IF v_paid <= 0 THEN
    v_status := 'pending';
  ELSIF v_remaining <= 0 THEN
    v_status := 'paid';
  ELSE
    v_status := 'partially_paid';
  END IF;

  UPDATE public.clearing_payment_bills
  SET paid_amount = v_paid,
      remaining_balance = v_remaining,
      payment_status = v_status,
      updated_at = now()
  WHERE id = v_bill_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_clearing_bill_payments ON public.clearing_payment_bill_payments;
CREATE TRIGGER trg_sync_clearing_bill_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.clearing_payment_bill_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_clearing_payment_bill_balance();

COMMIT;
