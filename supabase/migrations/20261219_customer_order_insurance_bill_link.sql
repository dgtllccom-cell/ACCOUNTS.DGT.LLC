-- Migration: 20261219_customer_order_insurance_bill_link.sql
-- Completes the per-leg Insurance feature on top of the existing (backfilled)
-- clearing_order_insurance_policies table:
-- - clearing_customer_order_legs.insurance_required: a per-leg toggle, independent
--   of whether a policy has been registered yet, so Smart Operations can flag
--   "leg requires insurance but has no active policy" as a real, queryable gap.
-- - clearing_payment_bills.insurance_policy_id: lets an insurance premium reuse
--   the EXACT SAME bill/approve/post/pay/remaining-balance pipeline already
--   built (and E2E-verified) for external partner bills — no duplicate
--   accounting path. Nullable/optional, exactly like the existing leg_id link,
--   because a policy can cover a range of legs (from_leg_no..to_leg_no), not
--   always a single leg.
-- Additive & idempotent.

BEGIN;

ALTER TABLE public.clearing_customer_order_legs
  ADD COLUMN IF NOT EXISTS insurance_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.clearing_payment_bills
  ADD COLUMN IF NOT EXISTS insurance_policy_id uuid REFERENCES public.clearing_order_insurance_policies(id);

CREATE INDEX IF NOT EXISTS idx_clearing_payment_bills_insurance_policy
  ON public.clearing_payment_bills (insurance_policy_id)
  WHERE deleted_at IS NULL;

COMMIT;
