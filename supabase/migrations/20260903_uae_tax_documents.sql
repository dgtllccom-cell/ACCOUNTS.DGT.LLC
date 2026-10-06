-- =============================================================================
-- UAE TAX — PHASE 3: DOCUMENTATION & SOURCE-INVOICE LINKING
-- Migration: 20260903_uae_tax_documents.sql
--
-- Extends the EXISTING office_documents store (no new document system):
--   - uae_tax_line_documents  : one source invoice -> many taxable lines
--   - uae_attach_tax_evidence(): "upload once, link to every taxable line"
--   - auto-link trigger on office_documents for tax source modules
--   - uae_tax_period_completeness_v : expected / attached / missing per period
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.uae_tax_line_documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_line_id          UUID NOT NULL REFERENCES public.uae_tax_lines(id) ON DELETE CASCADE,
  office_document_id   UUID NOT NULL REFERENCES public.office_documents(id) ON DELETE CASCADE,
  relationship         TEXT NOT NULL DEFAULT 'source_invoice'
                         CHECK (relationship IN (
                           'source_invoice', 'supporting', 'customs_declaration',
                           'export_evidence', 'credit_note', 'other'
                         )),
  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uae_tax_line_documents_pair_idx
  ON public.uae_tax_line_documents (tax_line_id, office_document_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS uae_tax_line_documents_doc_idx
  ON public.uae_tax_line_documents (office_document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS uae_tax_line_documents_line_idx
  ON public.uae_tax_line_documents (tax_line_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.uae_tax_line_documents IS
  'Links one office_documents row (the original source invoice, uploaded once) to
   every taxable line of that source bill. Never upload the same document twice.';


-- ---------------------------------------------------------------------------
-- Folder path for the Tax-Period document tree
--   UAE / <Tax Entity> / <Tax Year> / <Tax Period> / <Category>
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_tax_document_path(p_tax_line_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 'UAE'
       || '/' || COALESCE(NULLIF(e.legal_name, ''), 'Entity')
       || '/' || COALESCE(to_char(tl.source_date, 'YYYY'), 'Year')
       || '/' || COALESCE(tp.period_code, to_char(tl.source_date, 'YYYY-MM'))
       || '/' || CASE tl.transaction_category
                   WHEN 'daily_expense'    THEN 'Daily Expenses'
                   WHEN 'local_purchase'   THEN 'Local Purchases'
                   WHEN 'local_sale'       THEN 'Local Sales'
                   WHEN 'booking_purchase' THEN 'Booking Purchases'
                   WHEN 'booking_sale'     THEN 'Booking Sales'
                   WHEN 'import'           THEN 'Imports'
                   WHEN 'export'           THEN 'Exports'
                   WHEN 're_export'        THEN 'Re-Exports'
                   WHEN 'free_zone'        THEN 'Free Zone'
                   WHEN 'designated_zone'  THEN 'Designated Zone'
                   ELSE 'Other'
                 END
  FROM public.uae_tax_lines tl
  LEFT JOIN public.uae_tax_entities e  ON e.id = tl.tax_entity_id
  LEFT JOIN public.uae_tax_periods  tp ON tp.id = tl.tax_period_id
  WHERE tl.id = p_tax_line_id;
$$;


-- ---------------------------------------------------------------------------
-- uae_attach_tax_evidence — link one office_documents row to every taxable
-- line of a source bill, mark those lines document-complete, and file the
-- document under the correct Tax-Period folder.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_attach_tax_evidence(
  p_office_document_id UUID,
  p_source_module      TEXT,
  p_source_id          UUID,
  p_relationship       TEXT DEFAULT 'source_invoice',
  p_actor              UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked INTEGER := 0;
  v_first_line UUID;
BEGIN
  INSERT INTO public.uae_tax_line_documents (tax_line_id, office_document_id, relationship, created_by)
  SELECT tl.id, p_office_document_id, p_relationship, p_actor
  FROM public.uae_tax_lines tl
  WHERE tl.deleted_at IS NULL
    AND tl.source_module = p_source_module
    AND tl.source_id = p_source_id
  ON CONFLICT (tax_line_id, office_document_id) WHERE deleted_at IS NULL DO NOTHING;

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  UPDATE public.uae_tax_lines tl
  SET evidence_document_id = p_office_document_id,
      document_status = CASE WHEN document_status IN ('missing','pending') THEN 'complete' ELSE document_status END,
      updated_at = NOW()
  WHERE tl.deleted_at IS NULL
    AND tl.source_module = p_source_module
    AND tl.source_id = p_source_id;

  SELECT id INTO v_first_line
  FROM public.uae_tax_lines
  WHERE source_module = p_source_module AND source_id = p_source_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_first_line IS NOT NULL THEN
    UPDATE public.office_documents
    SET module_type   = 'Tax & e-Invoicing',
        document_type  = COALESCE(NULLIF(document_type, ''), 'Supplier Tax Invoice'),
        document_path  = public.uae_tax_document_path(v_first_line),
        updated_at     = NOW()
    WHERE id = p_office_document_id;
  END IF;

  RETURN v_linked;
END;
$$;


-- ---------------------------------------------------------------------------
-- uae_tax_backfill_documents — link tax lines to any office_documents row
-- already attached to their source bill.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_tax_backfill_documents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_total INTEGER := 0;
  v_map JSONB := jsonb_build_object(
    'expenses_bill', 'expenses_bill',
    'local_purchase', 'local_purchase',
    'purchase_order', 'purchase',
    'sales_order', 'sales'
  );
BEGIN
  FOR r IN
    SELECT DISTINCT tl.source_module, tl.source_id
    FROM public.uae_tax_lines tl
    WHERE tl.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.uae_tax_line_documents d
        WHERE d.tax_line_id = tl.id AND d.deleted_at IS NULL
      )
  LOOP
    PERFORM public.uae_attach_tax_evidence(od.id, r.source_module, r.source_id, 'source_invoice', NULL)
    FROM public.office_documents od
    WHERE od.deleted_at IS NULL
      AND od.source_record_id = r.source_id
      AND (od.source_module ILIKE '%' || COALESCE(v_map->>r.source_module, r.source_module) || '%'
           OR od.source_module IS NULL)
    LIMIT 1;
    v_total := v_total + 1;
  END LOOP;
  RETURN v_total;
END;
$$;


-- ---------------------------------------------------------------------------
-- Auto-link trigger — when a document is attached to a tax source bill
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_uae_tax_autolink_document()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mod TEXT;
BEGIN
  IF NEW.source_record_id IS NULL THEN RETURN NEW; END IF;

  v_mod := CASE
    WHEN NEW.source_module ILIKE '%expense%'       THEN 'expenses_bill'
    WHEN NEW.source_module ILIKE '%local%purchase%' THEN 'local_purchase'
    WHEN NEW.source_module ILIKE '%purchase%'       THEN 'purchase_order'
    WHEN NEW.source_module ILIKE '%sale%'           THEN 'sales_order'
    ELSE NULL
  END;

  IF v_mod IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.uae_tax_lines tl
    WHERE tl.source_module = v_mod AND tl.source_id = NEW.source_record_id AND tl.deleted_at IS NULL
  ) THEN
    PERFORM public.uae_attach_tax_evidence(NEW.id, v_mod, NEW.source_record_id, 'source_invoice', NULL);
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_uae_tax_autolink_document ON public.office_documents;
CREATE TRIGGER trg_uae_tax_autolink_document
  AFTER INSERT OR UPDATE OF source_record_id, source_module
  ON public.office_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_tax_autolink_document();


-- ---------------------------------------------------------------------------
-- Completeness view — per entity / period / category
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.uae_tax_period_completeness_v AS
SELECT
  tl.tax_entity_id,
  e.legal_name                              AS tax_entity_name,
  tl.tax_period_id,
  tp.period_code,
  tl.direction,
  tl.transaction_category,
  COUNT(*)                                                          AS expected_lines,
  COUNT(*) FILTER (WHERE tl.document_status = 'complete')           AS documents_attached,
  COUNT(*) FILTER (WHERE tl.document_status = 'missing')            AS documents_missing,
  COUNT(*) FILTER (WHERE tl.document_status = 'invalid')            AS documents_invalid,
  COUNT(*) FILTER (WHERE tl.document_status = 'review_required')    AS needs_review,
  SUM(tl.aed_vat_amount)                                            AS vat_aed,
  SUM(tl.aed_vat_amount) FILTER (WHERE tl.document_status = 'missing') AS vat_aed_without_evidence
FROM public.uae_tax_lines tl
LEFT JOIN public.uae_tax_entities e  ON e.id = tl.tax_entity_id
LEFT JOIN public.uae_tax_periods  tp ON tp.id = tl.tax_period_id
WHERE tl.deleted_at IS NULL
GROUP BY tl.tax_entity_id, e.legal_name, tl.tax_period_id, tp.period_code, tl.direction, tl.transaction_category;

GRANT SELECT ON public.uae_tax_period_completeness_v TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.uae_tax_line_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uae_tax_line_documents_rw ON public.uae_tax_line_documents;
CREATE POLICY uae_tax_line_documents_rw ON public.uae_tax_line_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.uae_tax_lines tl
      WHERE tl.id = uae_tax_line_documents.tax_line_id
        AND (public.is_super_admin() OR public.can_access_country(tl.country_id))
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.uae_tax_line_documents TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_tax_document_path        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_attach_tax_evidence      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_tax_backfill_documents   TO authenticated, service_role;

-- One-time backfill
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.uae_tax_lines WHERE deleted_at IS NULL LIMIT 1) THEN
    PERFORM public.uae_tax_backfill_documents();
  END IF;
END $$;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260903_uae_tax_documents', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
