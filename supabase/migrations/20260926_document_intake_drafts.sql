-- =============================================================================
-- AI Document Intake, Verification & Workflow Automation — Phase 4 (Confirm Draft)
-- Migration: 20260926_document_intake_drafts.sql
--
-- A confirmed intake job produces exactly one REVIEWED DRAFT here. The draft is
-- a normalized, human-verified payload for the target source module (e.g. a new
-- Purchase Booking). It is NOT a posting: the AI never writes to purchase_orders
-- / sales_orders / roznamcha_entries / journal / ledgers / stock. The target
-- module's own authorized "new entry" screen consumes this draft (Entry Method
-- Selector → "Continue Saved Draft"), and the human completes creation there,
-- which runs all serials / validation / approval / audit / posting.
--
-- Non-destructive: 1 new table + 1 view. Nothing existing is modified.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.document_intake_drafts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL REFERENCES public.document_intake_jobs(id) ON DELETE CASCADE,
  draft_no            text NOT NULL,
  operational_domain  text NOT NULL CHECK (operational_domain IN ('business','shipping')),
  target_module       text NOT NULL,               -- purchase_orders | sales_orders | shipping_bl_records | ...
  doc_type_code       text,
  -- scope (copied from the job; every consumer re-checks scope)
  company_id          uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  country_id          uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id   uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id      uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  clearing_agent_id   uuid REFERENCES public.clearing_agents(id) ON DELETE SET NULL,
  scope_composite_id  text,
  -- link intent
  link_mode           text NOT NULL DEFAULT 'new_record'
                        CHECK (link_mode IN ('new_record','append_existing')),
  linked_source_module text,                        -- set when link_mode = append_existing
  linked_source_id    uuid,
  -- the reviewed payload
  draft_payload       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { field_key: verified_value, ... } mapped to module fields
  line_items          jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_provenance    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { field_key: {confidence,page,verified,source_value} }
  currency            text,
  -- lifecycle
  status              text NOT NULL DEFAULT 'prepared'
                        CHECK (status IN ('prepared','consumed','discarded','superseded')),
  consumed_source_module text,
  consumed_source_id  uuid,
  consumed_by         uuid,
  consumed_by_name    text,
  consumed_at         timestamptz,
  discarded_reason    text,
  created_by          uuid,
  created_by_name     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- one live prepared draft per job
CREATE UNIQUE INDEX IF NOT EXISTS document_intake_drafts_job_live_uidx
  ON public.document_intake_drafts (job_id)
  WHERE deleted_at IS NULL AND status IN ('prepared','consumed');
CREATE UNIQUE INDEX IF NOT EXISTS document_intake_drafts_no_uidx
  ON public.document_intake_drafts (lower(draft_no)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS document_intake_drafts_module_status_idx
  ON public.document_intake_drafts (target_module, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS document_intake_drafts_scope_idx
  ON public.document_intake_drafts (operational_domain, country_id, country_branch_id, city_branch_id, clearing_agent_id)
  WHERE deleted_at IS NULL;
-- hard guard: a consumed draft can only point at one created record
CREATE UNIQUE INDEX IF NOT EXISTS document_intake_drafts_consumed_uidx
  ON public.document_intake_drafts (consumed_source_module, consumed_source_id)
  WHERE consumed_source_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE public.document_intake_drafts IS
  'One reviewed draft per confirmed intake job. Consumed by the target module''s authorized new-entry flow. Never a posting.';

CREATE OR REPLACE VIEW public.document_intake_drafts_v AS
SELECT
  d.*,
  j.job_no,
  j.original_filename,
  j.doc_type_confidence,
  co.name  AS country_name,
  cb.name  AS country_branch_name,
  cib.name AS city_branch_name,
  ca.name  AS clearing_agent_name
FROM public.document_intake_drafts d
JOIN public.document_intake_jobs j ON j.id = d.job_id
LEFT JOIN public.countries        co  ON co.id  = d.country_id
LEFT JOIN public.country_branches cb  ON cb.id  = d.country_branch_id
LEFT JOIN public.city_branches    cib ON cib.id = d.city_branch_id
LEFT JOIN public.clearing_agents  ca  ON ca.id  = d.clearing_agent_id
WHERE d.deleted_at IS NULL;

GRANT SELECT ON public.document_intake_drafts_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.document_intake_drafts TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260926_document_intake_drafts', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
