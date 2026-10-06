-- =============================================================================
-- Contract Intelligence — integrated into the existing Contract Control Center
-- Migration: 20261204_contract_intelligence_foundation.sql
--
-- Adds AI-assisted clause/risk/obligation analysis ON TOP of the existing
-- Central Contract Control Center (public.erp_contract_register_v,
-- contract_followups, contract_register_audit — all from 20260914) and the
-- existing AI Document Intake engine (document_intake_jobs / office_documents
-- — 20260925 / base schema). This migration creates NO new contract entity,
-- NO new document-intake pipeline, and does not modify either existing system.
--
-- New objects (additive, idempotent):
--   * contract_intelligence_analyses    — one current analysis row per
--                                          (source_module, source_id), same
--                                          identity convention as
--                                          contract_followups.
--   * contract_standard_clause_library  — small reference/seed table of
--                                          standard clause definitions used
--                                          for missing-clause detection.
--   * sync_contract_intelligence_reminders(int) — sibling function to the
--                                          existing sync_contract_reminders();
--                                          does NOT modify it.
--
-- Analysis runs are logged into the EXISTING contract_register_audit table
-- (action='intelligence_analyzed') — no new audit table.
-- =============================================================================

BEGIN;

-- ── 1. contract_intelligence_analyses ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_intelligence_analyses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module         text NOT NULL CHECK (source_module IN ('purchase_order','sales_order','hr_employee')),
  source_id             uuid NOT NULL,

  -- resolved document source — at most one of the two FKs is set
  source_kind           text NOT NULL DEFAULT 'none' CHECK (source_kind IN ('document_intake','office_document','none')),
  document_intake_job_id uuid REFERENCES public.document_intake_jobs(id) ON DELETE SET NULL,
  office_document_id    uuid REFERENCES public.office_documents(id) ON DELETE SET NULL,
  CHECK (num_nonnulls(document_intake_job_id, office_document_id) <= 1),

  analysis_status       text NOT NULL DEFAULT 'pending'
                           CHECK (analysis_status IN ('pending','running','completed','error','ai_unavailable')),
  error_message          text,

  overall_risk_level    text CHECK (overall_risk_level IN ('high','medium','low','unknown')),
  risk_summary           text,

  clauses                jsonb NOT NULL DEFAULT '[]'::jsonb,           -- [{clauseKey,title,present,riskLevel,explanation,excerpt}]
  obligations             jsonb NOT NULL DEFAULT '[]'::jsonb,          -- [{description,responsibleParty,dueDate,status}]
  missing_clauses        jsonb NOT NULL DEFAULT '[]'::jsonb,           -- [{clauseKey,title,severity,whyItMatters}]
  renewal                jsonb,                                       -- {hasAutoRenewal,noticeDays,riskLevel,explanation}
  termination            jsonb,                                       -- {conditions[],noticePeriod,riskLevel,explanation}
  payment_warnings       jsonb NOT NULL DEFAULT '[]'::jsonb,           -- [{kind,message,severity}]
  key_dates               jsonb NOT NULL DEFAULT '[]'::jsonb,          -- [{label,date,kind}]

  -- honesty flags — the UI must show these, never hide them
  deterministic_only     boolean NOT NULL DEFAULT true,
  ai_provider             text,
  ai_model                text,

  source_text_sha256      text,                                        -- cache key: unchanged doc => fast no-op re-run

  analyzed_by             uuid,
  analyzed_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_intelligence_analyses_source_uidx
  ON public.contract_intelligence_analyses (source_module, source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contract_intelligence_analyses_risk_idx
  ON public.contract_intelligence_analyses (overall_risk_level)
  WHERE deleted_at IS NULL AND overall_risk_level IN ('high','medium');
CREATE INDEX IF NOT EXISTS contract_intelligence_analyses_status_idx
  ON public.contract_intelligence_analyses (analysis_status) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.contract_intelligence_analyses IS
  'AI-assisted clause/risk/obligation analysis for one contract from the Central Contract Control Center. One current row per (source_module, source_id); never a copy of the contract itself. Source document is resolved from the existing document_intake_jobs (AI Document Intake) or office_documents (plain attachment) — never a new upload path.';

-- ── 2. contract_standard_clause_library — reference/seed data ───────────────
CREATE TABLE IF NOT EXISTS public.contract_standard_clause_library (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clause_key          text NOT NULL,
  category            text NOT NULL,
  applies_to          text[] NOT NULL DEFAULT '{all}',
  is_required          boolean NOT NULL DEFAULT true,
  severity_if_missing  text NOT NULL DEFAULT 'medium' CHECK (severity_if_missing IN ('high','medium','low')),
  is_active            boolean NOT NULL DEFAULT true,
  rank_order           int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contract_standard_clause_library_key_uidx
  ON public.contract_standard_clause_library (lower(clause_key));

COMMENT ON TABLE public.contract_standard_clause_library IS
  'Reference list of standard contract clauses used for missing-clause detection and standard-clause comparison. Labels are looked up via lib/i18n/ui.ts contract.clause_<key>_title — this table holds no translated text. Detection patterns live in lib/document-intelligence/contract-clause-rules.ts, not here.';

INSERT INTO public.contract_standard_clause_library (clause_key, category, applies_to, is_required, severity_if_missing, rank_order)
VALUES
  ('payment_terms',        'payment',      '{all}',                                            true,  'high',   10),
  ('termination',          'termination',  '{all}',                                             true,  'high',   20),
  ('auto_renewal',         'renewal',      '{purchase_booking,purchase_order,sales_booking,sales_order,employment}', false, 'medium', 30),
  ('notice_period',        'termination',  '{all}',                                             true,  'medium', 40),
  ('force_majeure',        'risk',         '{purchase_booking,purchase_order,sales_booking,sales_order}', true,  'medium', 50),
  ('confidentiality',      'legal',        '{all}',                                             false, 'low',    60),
  ('indemnity',            'liability',    '{purchase_booking,purchase_order,sales_booking,sales_order}', true,  'high',   70),
  ('liability_cap',        'liability',    '{purchase_booking,purchase_order,sales_booking,sales_order}', false, 'medium', 80),
  ('dispute_resolution',   'legal',        '{all}',                                             true,  'medium', 90),
  ('governing_law',        'legal',        '{all}',                                             true,  'low',    100),
  ('delivery_obligations', 'performance',  '{purchase_booking,purchase_order,sales_booking,sales_order}', true,  'high',   110),
  ('penalty_late_fee',     'payment',      '{purchase_booking,purchase_order,sales_booking,sales_order}', false, 'medium', 120),
  ('assignment',           'legal',        '{all}',                                             false, 'low',    130),
  ('warranty',             'performance',  '{purchase_booking,purchase_order,sales_booking,sales_order}', false, 'medium', 140),
  ('ip_ownership',         'legal',        '{purchase_booking,purchase_order,sales_booking,sales_order}', false, 'low',    150),
  ('probation_period',     'employment',   '{employment}',                                       true,  'medium', 160),
  ('leave_entitlement',    'employment',   '{employment}',                                       true,  'medium', 170),
  ('salary_terms',         'payment',      '{employment}',                                       true,  'high',   180)
ON CONFLICT DO NOTHING;

-- ── 3. sync_contract_intelligence_reminders — sibling to sync_contract_reminders ─
-- Does NOT modify public.sync_contract_reminders(int). Uses module =
-- 'contract_intelligence' (distinct from the existing 'contract_control') so
-- Smart CRM can tell the two reminder sources apart. crm_action_items.item_type
-- has no CHECK constraint, so these new values are safe with no further migration.
CREATE OR REPLACE FUNCTION public.sync_contract_intelligence_reminders(p_days_ahead int DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.crm_action_items (
    source_type, source_id, reference_no, party_name, due_date, item_type, module,
    amount, paid_amount, remaining_amount, currency,
    country_id, country_name, country_branch_id, city_branch_id, branch_name,
    responsible_user_id, urgency_class, status, next_follow_up, notes
  )
  SELECT
    'contract_intelligence_' || r.source_module,
    r.source_id,
    COALESCE(r.contract_no, r.booking_order_no, r.global_serial),
    r.party_name,
    COALESCE(r.expiry_date, current_date),
    CASE
      WHEN a.overall_risk_level = 'high' THEN 'contract_risk_high'
      WHEN jsonb_array_length(COALESCE(a.missing_clauses, '[]'::jsonb)) > 0 THEN 'contract_missing_clause'
      WHEN (a.renewal->>'riskLevel') IN ('high','medium') AND r.expiry_date IS NOT NULL AND r.expiry_date <= current_date + p_days_ahead THEN 'contract_renewal_risk'
      WHEN jsonb_array_length(COALESCE(a.payment_warnings, '[]'::jsonb)) > 0 THEN 'contract_payment_warning'
      ELSE 'contract_risk_medium'
    END,
    'contract_intelligence',
    r.original_amount, r.paid_amount, r.remaining_balance, r.original_currency,
    r.country_id, r.country_name, r.country_branch_id, r.city_branch_id, r.main_branch_name,
    r.created_by, CASE WHEN a.overall_risk_level = 'high' THEN 'high' ELSE 'medium' END, 'open',
    COALESCE(r.expiry_date, current_date + p_days_ahead),
    'Auto-generated from Contract Intelligence'
  FROM public.contract_intelligence_analyses a
  JOIN public.erp_contract_register_v r
    ON r.source_module = a.source_module AND r.source_id = a.source_id
  WHERE a.deleted_at IS NULL
    AND r.watch_status <> 'muted'
    AND a.analysis_status = 'completed'
    AND (
      a.overall_risk_level = 'high'
      OR jsonb_array_length(COALESCE(a.missing_clauses, '[]'::jsonb)) > 0
      OR jsonb_array_length(COALESCE(a.payment_warnings, '[]'::jsonb)) > 0
      OR ((a.renewal->>'riskLevel') IN ('high','medium') AND r.expiry_date IS NOT NULL AND r.expiry_date <= current_date + p_days_ahead)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_action_items x
      WHERE x.source_id = r.source_id AND x.module = 'contract_intelligence'
        AND x.is_completed = false
        AND x.created_at > current_date - 7
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.contract_intelligence_analyses TO authenticated, service_role;
GRANT SELECT ON public.contract_standard_clause_library TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_contract_intelligence_reminders(int) TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20261204_contract_intelligence_foundation', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
