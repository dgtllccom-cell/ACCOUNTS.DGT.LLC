-- =============================================================================
-- UAE TAX — PHASE 7: REPORTS, AUDIT TRAIL & FULL TAX TRACE
-- Migration: 20260907_uae_tax_reports_audit.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Append-only audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_tax_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT NOT NULL,   -- 'tax_line' | 'vat_return' | 'e_invoice' | 'recovery' | 'entity' | 'period' | 'rule'
  entity_id      UUID,
  tax_entity_id  UUID REFERENCES public.uae_tax_entities(id) ON DELETE SET NULL,
  country_id     UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,   -- 'created' | 'updated' | 'classified' | 'documented' | 'return_generated' | 'filed' | 'submitted' | 'status_changed'
  before_state   JSONB,
  after_state    JSONB,
  actor_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name     TEXT,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS uae_tax_audit_log_entity_idx ON public.uae_tax_audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS uae_tax_audit_log_taxentity_idx ON public.uae_tax_audit_log (tax_entity_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.uae_tax_write_audit(
  p_entity_type TEXT, p_entity_id UUID, p_action TEXT,
  p_before JSONB DEFAULT NULL, p_after JSONB DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL, p_country_id UUID DEFAULT NULL, p_actor UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.uae_tax_audit_log (entity_type, entity_id, tax_entity_id, country_id, action, before_state, after_state, actor_id, actor_name)
  VALUES (p_entity_type, p_entity_id, p_tax_entity_id, p_country_id, p_action, p_before, p_after, p_actor,
          (SELECT full_name FROM public.profiles WHERE id = p_actor));
END; $$;

-- Generic change trigger for the key tables
CREATE OR REPLACE FUNCTION public.trg_uae_tax_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type TEXT; v_txentity UUID; v_country UUID;
BEGIN
  v_type := TG_ARGV[0];
  v_txentity := CASE WHEN v_type IN ('tax_line','vat_return','e_invoice','recovery','period')
                     THEN COALESCE(NEW.tax_entity_id, OLD.tax_entity_id) END;
  v_country := CASE WHEN v_type = 'tax_line' THEN COALESCE(NEW.country_id, OLD.country_id) END;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.uae_tax_write_audit(v_type, NEW.id, 'created', NULL, to_jsonb(NEW), v_txentity, v_country, NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.uae_tax_write_audit(v_type, NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), v_txentity, v_country, NULL);
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_uae_audit_tax_lines ON public.uae_tax_lines;
CREATE TRIGGER trg_uae_audit_tax_lines AFTER INSERT OR UPDATE ON public.uae_tax_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_tax_audit('tax_line');

DROP TRIGGER IF EXISTS trg_uae_audit_vat_returns ON public.uae_vat_returns;
CREATE TRIGGER trg_uae_audit_vat_returns AFTER INSERT OR UPDATE ON public.uae_vat_returns
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_tax_audit('vat_return');

DROP TRIGGER IF EXISTS trg_uae_audit_e_invoices ON public.uae_e_invoices;
CREATE TRIGGER trg_uae_audit_e_invoices AFTER INSERT OR UPDATE ON public.uae_e_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_tax_audit('e_invoice');


-- ---------------------------------------------------------------------------
-- 2. Full tax-trace view — "where did this VAT amount come from?"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.uae_tax_trace_v AS
SELECT
  tl.id                        AS tax_line_id,
  tl.tax_entity_id,
  e.trn                        AS tax_entity_trn,
  e.legal_name                 AS tax_entity_name,
  tl.country_id, co.name       AS country_name,
  tl.country_branch_id, cb.name AS main_branch_name,
  tl.city_branch_id, cib.name  AS branch_name,
  pr.full_name                 AS entered_by_name,
  tl.source_module, tl.source_table, tl.source_id, tl.source_line_id, tl.source_reference_no, tl.source_date,
  tl.direction, tl.transaction_category, tl.tax_category,
  tl.party_name, tl.party_trn, tl.description,
  tl.taxable_amount, tl.vat_rate, tl.vat_amount,
  tl.aed_taxable_amount, tl.aed_vat_amount,
  tl.recoverability, tl.recoverable_amount,
  tl.roznamcha_entry_id, re.journal_no AS roznamcha_journal_no, re.entry_date AS roznamcha_date,
  re.source_transaction_type,
  tl.tax_period_id, tp.period_code, tp.status AS period_status,
  tl.vat_return_id, vr.status AS vat_return_status, tl.vat_return_box,
  tl.document_status, tl.evidence_document_id,
  od.file_name AS evidence_file_name, od.document_path AS evidence_folder,
  (SELECT COUNT(*) FROM public.uae_tax_line_documents d WHERE d.tax_line_id = tl.id AND d.deleted_at IS NULL) AS document_count,
  tl.customs_declaration_no, tl.bl_number,
  ei.invoice_number AS e_invoice_number, ei.status AS e_invoice_status, ei.asp_reference,
  rec.status AS recovery_status, rec.amount_aed AS recovery_amount_aed
FROM public.uae_tax_lines tl
LEFT JOIN public.uae_tax_entities e   ON e.id = tl.tax_entity_id
LEFT JOIN public.countries co         ON co.id = tl.country_id
LEFT JOIN public.country_branches cb  ON cb.id = tl.country_branch_id
LEFT JOIN public.city_branches cib    ON cib.id = tl.city_branch_id
LEFT JOIN public.profiles pr          ON pr.id = tl.entered_by
LEFT JOIN public.roznamcha_entries re ON re.id = tl.roznamcha_entry_id
LEFT JOIN public.uae_tax_periods tp   ON tp.id = tl.tax_period_id
LEFT JOIN public.uae_vat_returns vr   ON vr.id = tl.vat_return_id
LEFT JOIN public.office_documents od  ON od.id = tl.evidence_document_id
LEFT JOIN LATERAL (
  SELECT * FROM public.uae_e_invoices x
  WHERE x.source_module = 'sales_order' AND x.source_id = tl.source_id AND x.deleted_at IS NULL
  ORDER BY x.created_at DESC LIMIT 1
) ei ON tl.direction = 'output'
LEFT JOIN LATERAL (
  SELECT * FROM public.uae_vat_recovery x
  WHERE x.tax_line_id = tl.id AND x.deleted_at IS NULL
  ORDER BY x.created_at DESC LIMIT 1
) rec ON tl.direction = 'input'
WHERE tl.deleted_at IS NULL;

GRANT SELECT ON public.uae_tax_trace_v TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 3. Report summary view — per entity / period / category / direction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.uae_tax_report_summary_v AS
SELECT
  tl.tax_entity_id, e.legal_name AS tax_entity_name,
  tl.tax_period_id, tp.period_code,
  tl.direction, tl.transaction_category, tl.tax_category,
  COUNT(*)                    AS line_count,
  SUM(tl.aed_taxable_amount)  AS taxable_aed,
  SUM(tl.aed_vat_amount)      AS vat_aed,
  SUM(tl.recoverable_amount)  AS recoverable_aed,
  COUNT(*) FILTER (WHERE tl.document_status = 'missing') AS missing_documents,
  COUNT(*) FILTER (WHERE tl.review_status = 'needs_review') AS needs_review
FROM public.uae_tax_lines tl
LEFT JOIN public.uae_tax_entities e  ON e.id = tl.tax_entity_id
LEFT JOIN public.uae_tax_periods tp  ON tp.id = tl.tax_period_id
WHERE tl.deleted_at IS NULL
GROUP BY tl.tax_entity_id, e.legal_name, tl.tax_period_id, tp.period_code,
         tl.direction, tl.transaction_category, tl.tax_category;

GRANT SELECT ON public.uae_tax_report_summary_v TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 4. RLS + grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.uae_tax_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uae_tax_audit_log_read ON public.uae_tax_audit_log;
CREATE POLICY uae_tax_audit_log_read ON public.uae_tax_audit_log FOR SELECT USING (
  public.is_super_admin() OR (country_id IS NOT NULL AND public.can_access_country(country_id)));
DROP POLICY IF EXISTS uae_tax_audit_log_insert ON public.uae_tax_audit_log;
CREATE POLICY uae_tax_audit_log_insert ON public.uae_tax_audit_log FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT ON public.uae_tax_audit_log TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_tax_write_audit TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260907_uae_tax_reports_audit', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
