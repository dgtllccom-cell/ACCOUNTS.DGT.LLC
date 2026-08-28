-- =============================================================================
-- AI Document Intake — Phase 7 (Controlled Business → Shipping Handover)
-- Migration: 20260928_business_shipping_handovers.sql
--
-- A Business Purchase/Sales record reaches the Shipping / Clearing Agent system
-- ONLY through an explicit authorized handover action (Create Shipping Request /
-- Send to Shipping Line / Assign Clearing Agent / Approve Shipping Handover).
-- The controlled link carries the Business source id, the assigned agent, the
-- country/branch, the containers and a WHITELISTED shipping payload — never
-- internal prices, profit, payments or ledgers. Shipping/clearing users read the
-- shared view only; they never touch the business record.
--
-- Non-destructive: 1 new table + 1 restricted view. Nothing existing changes.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.business_shipping_handovers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_no            text NOT NULL,
  action_type            text NOT NULL CHECK (action_type IN
                           ('create_shipping_request','send_to_shipping_line','assign_clearing_agent','approve_shipping_handover')),
  -- business side (source of truth stays in its own module)
  business_source_module text NOT NULL CHECK (business_source_module IN ('purchase_orders','sales_orders')),
  business_source_id     uuid NOT NULL,
  business_reference_no  text,
  contract_reference     text,
  -- scope
  country_id             uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id      uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id         uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  -- shipping side
  clearing_agent_id      uuid REFERENCES public.clearing_agents(id) ON DELETE SET NULL,
  shipping_line_id       uuid REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  shipping_customer_id   uuid,
  shipping_request_id    uuid,                       -- set when a clearing_customer_order is created from this handover
  bl_reference           text,
  container_numbers      text[] NOT NULL DEFAULT '{}',
  -- the ONLY data shipping/clearing users see (whitelisted; no price/profit/ledger)
  shared_payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- lifecycle
  status                 text NOT NULL DEFAULT 'submitted'
                           CHECK (status IN ('draft','submitted','accepted','rejected','cancelled')),
  rejected_reason        text,
  created_by             uuid,
  created_by_name        text,
  approved_by            uuid,
  approved_by_name       text,
  approved_at            timestamptz,
  source_intake_job_id   uuid REFERENCES public.document_intake_jobs(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS business_shipping_handovers_no_uidx
  ON public.business_shipping_handovers (lower(handover_no)) WHERE deleted_at IS NULL;
-- one live handover per (business record, action, agent)
CREATE UNIQUE INDEX IF NOT EXISTS business_shipping_handovers_live_uidx
  ON public.business_shipping_handovers (business_source_module, business_source_id, action_type, coalesce(clearing_agent_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL AND status IN ('draft','submitted','accepted');
CREATE INDEX IF NOT EXISTS business_shipping_handovers_business_idx
  ON public.business_shipping_handovers (business_source_module, business_source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS business_shipping_handovers_agent_idx
  ON public.business_shipping_handovers (clearing_agent_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS business_shipping_handovers_scope_idx
  ON public.business_shipping_handovers (country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.business_shipping_handovers IS
  'Explicit authorized link from a Business Purchase/Sales record to the Shipping/Clearing system. shared_payload is whitelisted — no price, profit, payment or ledger data ever crosses.';

-- Restricted projection for shipping / clearing agent users: identity + logistics
-- fields only. No business_source_id join, no amounts.
CREATE OR REPLACE VIEW public.business_shipping_handover_shared_v AS
SELECT
  h.id,
  h.handover_no,
  h.action_type,
  h.status,
  h.contract_reference,
  h.country_id,
  h.country_branch_id,
  h.city_branch_id,
  h.clearing_agent_id,
  h.shipping_line_id,
  h.shipping_customer_id,
  h.shipping_request_id,
  h.bl_reference,
  h.container_numbers,
  h.shared_payload,
  h.created_by_name,
  h.approved_by_name,
  h.approved_at,
  h.created_at,
  ca.name AS clearing_agent_name
FROM public.business_shipping_handovers h
LEFT JOIN public.clearing_agents ca ON ca.id = h.clearing_agent_id
WHERE h.deleted_at IS NULL;

GRANT SELECT ON public.business_shipping_handover_shared_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.business_shipping_handovers TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260928_business_shipping_handovers', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
