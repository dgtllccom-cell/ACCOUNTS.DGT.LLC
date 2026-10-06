-- =============================================================================
-- Conversation Intelligence — strengthens the existing AI Calls / AI
-- Receptionist system (public.ai_calls, from 20261026_ai_calls.sql).
-- Migration: 20261208_ai_call_intelligence.sql
--
-- Adds sentiment/risk/signal analysis ON TOP of the existing call log. This
-- migration creates NO second AI Calls module, NO second CRM, NO second
-- Customer Inquiry system, and does not alter any existing ai_calls column.
--
-- New objects (additive, idempotent):
--   * ai_call_intelligence — one analysis row per call, 1:1 via call_id.
--   * ai_calls.task_id gets a real FK to user_tasks(id) — the column has
--     existed since 20261026 but was never constrained or written; safe to
--     add now (confirmed 0 of 0 rows in ai_calls have it set).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_call_intelligence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id             uuid NOT NULL UNIQUE REFERENCES public.ai_calls(id) ON DELETE CASCADE,

  analysis_status     text NOT NULL DEFAULT 'pending'
                        CHECK (analysis_status IN ('pending','running','completed','error','ai_unavailable')),
  error_message        text,

  sentiment            text CHECK (sentiment IN ('positive','neutral','negative','frustrated')),
  risk_level           text CHECK (risk_level IN ('high','medium','low')),
  urgency_level        text CHECK (urgency_level IN ('high','medium','low')),

  signals              jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{type,present,evidence,confidence}]
  commitments          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{description,party,due_date,status,evidence}]
  payment_promise      jsonb,                                -- {amount,currency,date,confidence,extraction_basis} | null
  financial_context    jsonb NOT NULL DEFAULT '{"available":false}'::jsonb,
  topics                text[] NOT NULL DEFAULT '{}',

  follow_up_required   boolean NOT NULL DEFAULT false,
  summary               text,
  next_best_action      text,

  deterministic_only    boolean NOT NULL DEFAULT true,
  ai_provider            text,
  ai_model               text,
  generated_lang         text NOT NULL DEFAULT 'en',
  rules_version           integer NOT NULL DEFAULT 1,
  source_text_sha256      text,

  analyzed_by             uuid,
  analyzed_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at                timestamptz
);

CREATE INDEX IF NOT EXISTS ai_call_intelligence_risk_idx
  ON public.ai_call_intelligence (risk_level) WHERE deleted_at IS NULL AND risk_level IN ('high','medium');
CREATE INDEX IF NOT EXISTS ai_call_intelligence_status_idx
  ON public.ai_call_intelligence (analysis_status) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.tg_ai_call_intelligence_touch() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_call_intelligence_touch ON public.ai_call_intelligence;
CREATE TRIGGER trg_ai_call_intelligence_touch BEFORE UPDATE ON public.ai_call_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.tg_ai_call_intelligence_touch();

COMMENT ON TABLE public.ai_call_intelligence IS
  'Conversation Intelligence analysis for one AI call (public.ai_calls). One current row per call_id; never a copy of the call itself. financial_context defaults to {"available":false} and is only ever populated from real ERP ledger/order data (getCombinedCustomerStatement / sales_orders) — never fabricated.';

-- Close the exact gap flagged by the owner: task_id has existed since the
-- call table was created but has never been written or constrained.
ALTER TABLE public.ai_calls
  ADD CONSTRAINT ai_calls_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.user_tasks(id);

GRANT SELECT, INSERT, UPDATE ON public.ai_call_intelligence TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20261208_ai_call_intelligence', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
