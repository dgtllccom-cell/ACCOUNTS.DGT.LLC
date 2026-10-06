-- =============================================================================
-- UAE TAX — PHASE 6: IMPORT / EXPORT / FREE ZONE + E-INVOICING (PINT-AE)
-- Migration: 20260906_uae_import_export_einvoicing.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Import / export / zone reference columns on uae_tax_lines
-- ---------------------------------------------------------------------------
ALTER TABLE public.uae_tax_lines
  ADD COLUMN IF NOT EXISTS customs_declaration_no TEXT,
  ADD COLUMN IF NOT EXISTS bl_number              TEXT,
  ADD COLUMN IF NOT EXISTS shipping_bl_record_id  UUID REFERENCES public.shipping_bl_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loading_record_id      UUID REFERENCES public.purchase_loading_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS designated_zone_id     UUID REFERENCES public.uae_designated_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zone_movement          TEXT,
  ADD COLUMN IF NOT EXISTS export_evidence_status TEXT DEFAULT 'pending'
    CHECK (export_evidence_status IN ('pending', 'partial', 'complete', 'not_required'));


-- ---------------------------------------------------------------------------
-- 2. Designated-Zone VAT treatment matrix (configurable via uae_tax_rules,
--    with a sensible default table).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_zone_treatment(p_from TEXT, p_to TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE v_cfg JSONB; v_key TEXT := lower(coalesce(p_from,'?')) || '->' || lower(coalesce(p_to,'?'));
BEGIN
  SELECT config INTO v_cfg FROM public.uae_tax_rules
  WHERE rule_type = 'designated_zone' AND rule_key = 'treatment_matrix' AND is_active = TRUE AND deleted_at IS NULL
  ORDER BY effective_from DESC LIMIT 1;

  IF v_cfg IS NOT NULL AND v_cfg ? v_key THEN
    RETURN v_cfg->>v_key;
  END IF;

  RETURN CASE v_key
    WHEN 'foreign->designated_zone'      THEN 'out_of_scope'
    WHEN 'designated_zone->foreign'      THEN 'out_of_scope'
    WHEN 'designated_zone->designated_zone' THEN 'out_of_scope'
    WHEN 'mainland->designated_zone'     THEN 'standard'
    WHEN 'designated_zone->mainland'     THEN 'standard_import'
    WHEN 'free_zone->free_zone'          THEN 'standard'
    WHEN 'free_zone->mainland'           THEN 'standard'
    WHEN 'mainland->foreign'             THEN 'zero_rated'
    WHEN 'designated_zone->export'       THEN 'zero_rated'
    ELSE 'standard'
  END;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. sync_uae_tax_from_import — link shipping/customs to a purchase's tax line
--    Import VAT reference only (the goods import is already an input line via
--    the purchase; this enriches it and flips category to 'import').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_uae_tax_from_import(
  p_from_date DATE DEFAULT NULL, p_tax_entity_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  UPDATE public.uae_tax_lines tl
  SET transaction_category = 'import',
      bl_number             = bl.bl_number,
      shipping_bl_record_id = bl.id,
      customs_declaration_no = COALESCE(tl.customs_declaration_no, bl.bl_number),
      updated_at = NOW()
  FROM public.shipping_bl_records bl
  WHERE tl.deleted_at IS NULL
    AND tl.source_module = 'purchase_order'
    AND bl.purchase_order_id = tl.source_id
    AND (p_from_date IS NULL OR tl.source_date >= p_from_date)
    AND (p_tax_entity_id IS NULL OR tl.tax_entity_id = p_tax_entity_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 4. e-Invoicing tables (PINT-AE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_e_invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_entity_id      UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE CASCADE,
  country_id         UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  city_branch_id     UUID REFERENCES public.city_branches(id) ON DELETE SET NULL,

  source_module      TEXT NOT NULL,          -- 'sales_order' | 'credit_note' | 'local_sale' | 'self_billed'
  source_id          UUID NOT NULL,
  source_reference_no TEXT,

  document_type      TEXT NOT NULL DEFAULT 'tax_invoice'
                       CHECK (document_type IN ('tax_invoice', 'tax_credit_note', 'commercial_invoice', 'self_billed')),
  invoice_number     TEXT,
  issue_date         DATE,
  currency           TEXT NOT NULL DEFAULT 'AED',
  total_excl_vat     NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_vat          NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_incl_vat     NUMERIC(18,2) NOT NULL DEFAULT 0,

  buyer_name         TEXT,
  buyer_trn          TEXT,

  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN (
                         'draft', 'validated', 'ready', 'submitted', 'processing',
                         'delivered', 'completed', 'rejected', 'error', 'retry_required'
                       )),
  validation_errors  JSONB NOT NULL DEFAULT '[]'::jsonb,
  pint_ae_payload    JSONB,

  asp_provider       TEXT,
  asp_reference      TEXT,
  asp_response       JSONB,
  last_error         TEXT,
  retry_count        INTEGER NOT NULL DEFAULT 0,

  related_e_invoice_id UUID REFERENCES public.uae_e_invoices(id) ON DELETE SET NULL,  -- credit note -> original

  submitted_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at       TIMESTAMPTZ,
  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uae_e_invoices_source_idx
  ON public.uae_e_invoices (source_module, source_id, document_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS uae_e_invoices_status_idx ON public.uae_e_invoices (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS uae_e_invoices_entity_idx ON public.uae_e_invoices (tax_entity_id, issue_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.uae_e_invoice_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  e_invoice_id   UUID NOT NULL REFERENCES public.uae_e_invoices(id) ON DELETE CASCADE,
  event          TEXT NOT NULL,
  previous_status TEXT,
  new_status     TEXT,
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS uae_e_invoice_events_inv_idx ON public.uae_e_invoice_events (e_invoice_id, created_at DESC);

-- Server-only ASP credentials (never selected into a client payload)
CREATE TABLE IF NOT EXISTS public.uae_asp_credentials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_entity_id  UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  config         JSONB NOT NULL DEFAULT '{}'::jsonb,      -- endpoint, mode
  secret_ref     TEXT,                                     -- pointer to a secret store, NOT the secret
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uae_asp_credentials_entity_provider_idx
  ON public.uae_asp_credentials (tax_entity_id, provider) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 5. e-Invoice status log trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_uae_e_invoice_status_log()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.uae_e_invoice_events (e_invoice_id, event, new_status, actor_id)
    VALUES (NEW.id, 'created', NEW.status, NEW.created_by);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.uae_e_invoice_events (e_invoice_id, event, previous_status, new_status, actor_id, detail)
    VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, NEW.submitted_by,
            jsonb_build_object('asp_reference', NEW.asp_reference, 'retry_count', NEW.retry_count));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_uae_e_invoice_status_log ON public.uae_e_invoices;
CREATE TRIGGER trg_uae_e_invoice_status_log
  AFTER INSERT OR UPDATE OF status ON public.uae_e_invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_e_invoice_status_log();


-- ---------------------------------------------------------------------------
-- 6. Build e-invoice drafts from taxable sales that don't have one yet
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_build_einvoice_drafts(p_tax_entity_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  INSERT INTO public.uae_e_invoices (
    tax_entity_id, country_id, city_branch_id,
    source_module, source_id, source_reference_no,
    document_type, invoice_number, issue_date, currency,
    total_excl_vat, total_vat, total_incl_vat, buyer_name, status
  )
  SELECT
    tl.tax_entity_id, tl.country_id, tl.city_branch_id,
    'sales_order', tl.source_id, tl.source_reference_no,
    'tax_invoice', tl.source_reference_no, tl.source_date, 'AED',
    SUM(tl.aed_taxable_amount), SUM(tl.aed_vat_amount),
    SUM(tl.aed_taxable_amount + tl.aed_vat_amount),
    MAX(tl.party_name), 'draft'
  FROM public.uae_tax_lines tl
  WHERE tl.deleted_at IS NULL
    AND tl.direction = 'output'
    AND tl.source_module = 'sales_order'
    AND (p_tax_entity_id IS NULL OR tl.tax_entity_id = p_tax_entity_id)
  GROUP BY tl.tax_entity_id, tl.country_id, tl.city_branch_id, tl.source_id, tl.source_reference_no, tl.source_date
  ON CONFLICT (source_module, source_id, document_type) WHERE deleted_at IS NULL
  DO UPDATE SET total_excl_vat = EXCLUDED.total_excl_vat,
                total_vat      = EXCLUDED.total_vat,
                total_incl_vat = EXCLUDED.total_incl_vat,
                updated_at = NOW()
  WHERE public.uae_e_invoices.status IN ('draft', 'validated', 'error', 'retry_required');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 7. RLS + grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.uae_e_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_e_invoice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_asp_credentials  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uae_e_invoices_rw ON public.uae_e_invoices;
CREATE POLICY uae_e_invoices_rw ON public.uae_e_invoices FOR ALL USING (
  public.is_super_admin() OR (country_id IS NOT NULL AND public.can_access_country(country_id)));

DROP POLICY IF EXISTS uae_e_invoice_events_read ON public.uae_e_invoice_events;
CREATE POLICY uae_e_invoice_events_read ON public.uae_e_invoice_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.uae_e_invoices i WHERE i.id = uae_e_invoice_events.e_invoice_id
          AND (public.is_super_admin() OR public.can_access_country(i.country_id))));
DROP POLICY IF EXISTS uae_e_invoice_events_insert ON public.uae_e_invoice_events;
CREATE POLICY uae_e_invoice_events_insert ON public.uae_e_invoice_events FOR INSERT WITH CHECK (true);

-- ASP credentials: super admin only, and never exposed to the browser
DROP POLICY IF EXISTS uae_asp_credentials_rw ON public.uae_asp_credentials;
CREATE POLICY uae_asp_credentials_rw ON public.uae_asp_credentials FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE ON public.uae_e_invoices       TO authenticated, service_role;
GRANT SELECT, INSERT         ON public.uae_e_invoice_events  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.uae_asp_credentials   TO service_role;
GRANT EXECUTE ON FUNCTION public.uae_zone_treatment          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_uae_tax_from_import     TO service_role;
GRANT EXECUTE ON FUNCTION public.uae_build_einvoice_drafts    TO authenticated, service_role;

-- Seed the zone treatment matrix rule
INSERT INTO public.uae_tax_rules (rule_type, rule_key, config, effective_from, source_reference)
VALUES ('designated_zone', 'treatment_matrix',
  '{"foreign->designated_zone":"out_of_scope","designated_zone->foreign":"out_of_scope","designated_zone->designated_zone":"out_of_scope","mainland->designated_zone":"standard","designated_zone->mainland":"standard_import","free_zone->free_zone":"standard","free_zone->mainland":"standard","mainland->foreign":"zero_rated","designated_zone->export":"zero_rated"}'::jsonb,
  DATE '2018-01-01', 'FTA VAT — Cabinet Decision No. 59 of 2017 (Designated Zones), Executive Regulation Art. 51')
ON CONFLICT DO NOTHING;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260906_uae_import_export_einvoicing', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
