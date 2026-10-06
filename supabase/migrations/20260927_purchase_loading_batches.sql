-- =============================================================================
-- AI Document Intake — Phase 6 (Partial Container Purchase Workflow)
-- Migration: 20260927_purchase_loading_batches.sql
--
-- One Purchase Booking for N containers → documents arrive for a SUBSET →
-- scan/upload → the AI proposes a Loading Batch (LOAD-01, LOAD-02, …) of just
-- those containers, scoped to the SAME business / country / branch / purchase.
-- The user confirms; the existing Purchase Loading form then creates the loading
-- records (pre-filled from the batch). No second Purchase Booking, no duplicated
-- Payment / Loading / Container records.
--
-- Non-destructive: 1 new table + 2 nullable columns on purchase_loading_records
-- (existing rows stay NULL) + 1 progress view. No existing write path changes.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.purchase_loading_batches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_no             text NOT NULL,                 -- LOAD-01, LOAD-02 … per purchase order
  purchase_order_id    uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  purchase_order_no    text,
  purchase_contract_no text,
  -- scope (must equal the purchase order's scope — enforced by the service)
  country_id           uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id    uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id       uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  -- origin of the proposal
  source_intake_job_id uuid REFERENCES public.document_intake_jobs(id) ON DELETE SET NULL,
  source_intake_draft_id uuid REFERENCES public.document_intake_drafts(id) ON DELETE SET NULL,
  -- the containers this batch covers
  container_numbers    text[] NOT NULL DEFAULT '{}',
  container_count      int NOT NULL DEFAULT 0,
  planned_container_count int,                        -- snapshot of the booking's planned total
  -- lifecycle
  status               text NOT NULL DEFAULT 'proposed'
                         CHECK (status IN ('proposed','confirmed','loaded','cancelled')),
  confirmed_by         uuid,
  confirmed_at         timestamptz,
  cancelled_reason     text,
  notes                text,
  created_by           uuid,
  created_by_name      text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_loading_batches_no_uidx
  ON public.purchase_loading_batches (purchase_order_id, lower(batch_no))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS purchase_loading_batches_po_idx
  ON public.purchase_loading_batches (purchase_order_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS purchase_loading_batches_scope_idx
  ON public.purchase_loading_batches (country_id, country_branch_id, city_branch_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.purchase_loading_batches IS
  'Groups a subset of a purchase booking''s containers into a loading batch (LOAD-01, LOAD-02). Proposal + grouping only — loading records are still created by the existing Purchase Loading flow.';

-- link loading records to a batch (nullable; existing rows unaffected)
ALTER TABLE public.purchase_loading_records
  ADD COLUMN IF NOT EXISTS loading_batch_id uuid REFERENCES public.purchase_loading_batches(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_loading_records
  ADD COLUMN IF NOT EXISTS loading_batch_no text;
CREATE INDEX IF NOT EXISTS purchase_loading_records_batch_idx
  ON public.purchase_loading_records (loading_batch_id)
  WHERE deleted_at IS NULL AND loading_batch_id IS NOT NULL;

-- per-purchase-order container progress (Planned / Loaded / Remaining / status)
CREATE OR REPLACE VIEW public.purchase_loading_progress_v AS
WITH planned AS (
  SELECT
    po.id AS purchase_order_id,
    po.country_id, po.country_branch_id,
    NULLIF(regexp_replace(COALESCE(
      po.form_data->'form'->>'containerCount',
      po.form_data->>'containerCount',
      '0'), '[^0-9]', '', 'g'), '')::int AS planned_containers
  FROM public.purchase_orders po
  WHERE po.deleted_at IS NULL
),
loaded AS (
  SELECT
    plr.purchase_order_id,
    count(DISTINCT plr.container_number) FILTER (WHERE plr.container_number IS NOT NULL AND plr.container_number <> '') AS loaded_containers,
    count(*) AS loading_records,
    count(DISTINCT plr.loading_batch_id) FILTER (WHERE plr.loading_batch_id IS NOT NULL) AS batches
  FROM public.purchase_loading_records plr
  WHERE plr.deleted_at IS NULL
  GROUP BY plr.purchase_order_id
)
SELECT
  p.purchase_order_id,
  p.country_id, p.country_branch_id,
  COALESCE(p.planned_containers, 0)                               AS planned_containers,
  COALESCE(l.loaded_containers, 0)                                AS loaded_containers,
  GREATEST(COALESCE(p.planned_containers, 0) - COALESCE(l.loaded_containers, 0), 0) AS remaining_containers,
  COALESCE(l.loading_records, 0)                                  AS loading_records,
  COALESCE(l.batches, 0)                                          AS batches,
  CASE
    WHEN COALESCE(l.loaded_containers, 0) = 0 THEN 'planned'
    WHEN COALESCE(p.planned_containers, 0) = 0 THEN 'loaded'
    WHEN COALESCE(l.loaded_containers, 0) >= p.planned_containers THEN 'fully_loaded'
    ELSE 'partially_loaded'
  END AS loading_progress_status
FROM planned p
LEFT JOIN loaded l ON l.purchase_order_id = p.purchase_order_id;

GRANT SELECT ON public.purchase_loading_progress_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.purchase_loading_batches TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260927_purchase_loading_batches', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
