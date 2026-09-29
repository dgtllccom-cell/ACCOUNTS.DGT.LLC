-- Shipping & Clearing → Customer Order: cargo insurance per leg — ADDITIVE.
--
-- One row per insurance policy / certificate on an EXISTING clearing_customer_orders row, covering
-- a contiguous range of its route legs (from_leg_no … to_leg_no) for a territory and date window.
-- The policy document is attached through the existing documents system
-- (erp_documents.entity_type = 'clearing_order_insurance', entity_id = policy id).
-- Coverage and gaps (uncovered legs, dates outside the window, expired / cancelled policies,
-- missing policy document) are computed by the application from these rows and the legs.
-- No accounting: a premium is recorded for reference only; payment goes through the existing bills.
-- Rollback: DROP TABLE public.clearing_order_insurance_policies;

BEGIN;

CREATE TABLE IF NOT EXISTS public.clearing_order_insurance_policies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES public.clearing_customer_orders(id),
  insurer_name       text NOT NULL,
  insurer_account_id uuid,                       -- optional: the insurer's existing account (enterprise_accounts)
  policy_no          text NOT NULL,
  covered_cargo      text NOT NULL,
  insured_value      numeric(18,2) NOT NULL CHECK (insured_value > 0),
  currency           text NOT NULL,
  coverage_from      date NOT NULL,
  coverage_to        date NOT NULL,
  territory          text,                       -- e.g. "UAE – Iran – Pakistan – Afghanistan – Uzbekistan"
  from_leg_no        int NOT NULL CHECK (from_leg_no >= 1),
  to_leg_no          int NOT NULL,
  premium_amount     numeric(18,2),
  premium_currency   text,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  remarks            text,
  country_id         uuid REFERENCES public.countries(id),
  country_branch_id  uuid REFERENCES public.country_branches(id),
  city_branch_id     uuid REFERENCES public.city_branches(id),
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  CONSTRAINT clearing_order_insurance_dates_chk CHECK (coverage_to >= coverage_from),
  CONSTRAINT clearing_order_insurance_legs_chk CHECK (to_leg_no >= from_leg_no)
);
CREATE INDEX IF NOT EXISTS clearing_order_insurance_order_idx ON public.clearing_order_insurance_policies (order_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clearing_order_insurance_policy_uq
  ON public.clearing_order_insurance_policies (order_id, lower(insurer_name), lower(policy_no)) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.clearing_order_insurance_policies IS 'Cargo insurance on a customer order, covering legs from_leg_no..to_leg_no. Coverage gaps are computed against the legs; the policy file is an erp_documents row (entity_type clearing_order_insurance).';

COMMIT;
