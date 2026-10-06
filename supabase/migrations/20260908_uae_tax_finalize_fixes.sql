-- =============================================================================
-- UAE TAX — PHASE 7 FIX + FINALIZATION
-- Migration: 20260908_uae_tax_finalize_fixes.sql
--
--   - trg_uae_tax_audit: resolve scope columns via to_jsonb(NEW) so the one
--     shared function works for tables that don't have a country_id
--     (uae_vat_returns).  ("record NEW has no field country_id")
--   - sync_uae_tax_all: also run the import enrichment pass.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_uae_tax_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type     TEXT := TG_ARGV[0];
  v_new      JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_old      JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_row      JSONB := COALESCE(v_new, v_old);
  v_id       UUID  := NULLIF(v_row->>'id', '')::uuid;
  v_txentity UUID  := NULLIF(v_row->>'tax_entity_id', '')::uuid;
  v_country  UUID  := NULLIF(v_row->>'country_id', '')::uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.uae_tax_write_audit(v_type, v_id, 'created', NULL, v_new, v_txentity, v_country, NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.uae_tax_write_audit(v_type, v_id, 'updated', v_old, v_new, v_txentity, v_country, NULL);
  END IF;
  RETURN NULL;
END; $$;


CREATE OR REPLACE FUNCTION public.sync_uae_tax_all(
  p_from_date     DATE DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL
)
RETURNS TABLE (source TEXT, rows_synced INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT 'expenses_bill'::text,  public.sync_uae_tax_from_expenses(p_from_date, p_tax_entity_id, NULL);
  RETURN QUERY SELECT 'local_purchase'::text, public.sync_uae_tax_from_local_purchase(p_from_date, p_tax_entity_id, NULL);
  RETURN QUERY SELECT 'purchase_order'::text, public.sync_uae_tax_from_purchase_orders(p_from_date, p_tax_entity_id);
  RETURN QUERY SELECT 'sales_order'::text,    public.sync_uae_tax_from_sales_orders(p_from_date, p_tax_entity_id);
  RETURN QUERY SELECT 'import_enrichment'::text, public.sync_uae_tax_from_import(p_from_date, p_tax_entity_id);
END;
$$;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260908_uae_tax_finalize_fixes', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
