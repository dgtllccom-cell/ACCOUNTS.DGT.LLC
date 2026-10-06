-- =============================================================================
-- UAE TAX — drop duplicate 2-arg sync-function overloads
-- Migration: 20260912_uae_tax_sync_fn_dedupe.sql
--
-- 20260902 created  sync_uae_tax_from_purchase_orders(date, uuid)
--                   sync_uae_tax_from_sales_orders(date, uuid)
-- 20260911 added an order-targeted 3rd param via CREATE OR REPLACE. A different
-- argument signature does NOT replace — it creates a SECOND overload. Because
-- the 3-arg version declares `p_order_id UUID DEFAULT NULL`, a 2-arg call now
-- matches BOTH overloads and PostgreSQL raises:
--   "function public.sync_uae_tax_from_purchase_orders(date, uuid) is not unique"
-- which breaks sync_uae_tax_all() and POST /api/erp/uae-tax/sync.
--
-- Fix: drop the legacy 2-arg overloads. The 3-arg versions (with the default)
-- remain and serve every existing 2-arg call site unchanged.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.sync_uae_tax_from_purchase_orders(date, uuid);
DROP FUNCTION IF EXISTS public.sync_uae_tax_from_sales_orders(date, uuid);

-- Recreate sync_uae_tax_all so its internal PERFORM calls bind unambiguously to
-- the surviving 3-arg overloads (explicit 3rd arg = NULL).
CREATE OR REPLACE FUNCTION public.sync_uae_tax_all(
  p_from_date     DATE DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL
)
RETURNS TABLE (source TEXT, rows_synced INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- source labels kept identical to 20260908 so the service-layer filter that
  -- de-duplicates 'import_enrichment' keeps matching.
  RETURN QUERY SELECT 'expenses_bill'::text,
    public.sync_uae_tax_from_expenses(p_from_date, p_tax_entity_id, NULL);
  RETURN QUERY SELECT 'local_purchase'::text,
    public.sync_uae_tax_from_local_purchase(p_from_date, p_tax_entity_id, NULL);
  RETURN QUERY SELECT 'purchase_order'::text,
    public.sync_uae_tax_from_purchase_orders(p_from_date, p_tax_entity_id, NULL);
  RETURN QUERY SELECT 'sales_order'::text,
    public.sync_uae_tax_from_sales_orders(p_from_date, p_tax_entity_id, NULL);
  RETURN QUERY SELECT 'import_enrichment'::text,
    public.sync_uae_tax_from_import(p_from_date, p_tax_entity_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_uae_tax_all(date, uuid) TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260912_uae_tax_sync_fn_dedupe', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
