-- Migration: 20261218_customer_order_insurance.sql
-- Backfill: this migration was applied directly to the DEV database
-- (csesvyxxjivnkkozgopt, applied version 20260929200744) without ever being
-- committed to the repo. This file reconstructs it EXACTLY from the live DEV
-- schema (via information_schema / pg_catalog introspection on 2026-09-30) so
-- that git history matches what is actually running, before any application
-- code or further schema changes are built on top of it.
--
-- Per-leg cargo/marine insurance policies for Customer Orders. A policy can
-- cover a single leg or a contiguous range of legs (from_leg_no..to_leg_no).
-- No application code reads/writes this table yet — it exists as schema only.
--
-- NOTE (carried over from live DEV state, not changed by this backfill):
-- RLS is enabled with ZERO policies defined, which fail-closes all access
-- under the anon/authenticated roles (the app reads/writes via the
-- service-role client, which bypasses RLS, so this is not currently a
-- functional blocker — but real per-scope RLS policies should be added
-- before any client-side/anon access path is built against this table).
--
-- Additive & idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.clearing_order_insurance_policies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES public.clearing_customer_orders(id),
  insurer_name        text NOT NULL,
  insurer_account_id  uuid REFERENCES public.ledgers(id),
  policy_no           text NOT NULL,
  covered_cargo       text NOT NULL,
  insured_value       numeric NOT NULL CHECK (insured_value > 0),
  currency            text NOT NULL,
  coverage_from       date NOT NULL,
  coverage_to         date NOT NULL,
  territory           text,
  from_leg_no         integer NOT NULL CHECK (from_leg_no >= 1),
  to_leg_no           integer NOT NULL,
  premium_amount      numeric,
  premium_currency    text,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  remarks             text,
  country_id          uuid REFERENCES public.countries(id),
  country_branch_id   uuid REFERENCES public.country_branches(id),
  city_branch_id      uuid REFERENCES public.city_branches(id),
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT clearing_order_insurance_dates_chk CHECK (coverage_to >= coverage_from),
  CONSTRAINT clearing_order_insurance_legs_chk CHECK (to_leg_no >= from_leg_no)
);

CREATE INDEX IF NOT EXISTS clearing_order_insurance_order_idx
  ON public.clearing_order_insurance_policies (order_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clearing_order_insurance_policy_uq
  ON public.clearing_order_insurance_policies (order_id, lower(insurer_name), lower(policy_no))
  WHERE deleted_at IS NULL;

ALTER TABLE public.clearing_order_insurance_policies ENABLE ROW LEVEL SECURITY;

COMMIT;
