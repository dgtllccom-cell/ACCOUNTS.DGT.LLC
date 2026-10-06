-- =============================================================================
-- UAE TAX — line-level ingestion for booking Purchase / Sales orders
-- Migration: 20260911_uae_tax_order_item_triggers.sql
--
-- Adds targeted params + AFTER-write triggers on purchase_order_items /
-- sales_order_items so a taxable goods line (is_taxable = TRUE) flows into
-- uae_tax_lines the moment the order is saved — exactly like
-- expenses_bill_lines.tax_on does.
-- =============================================================================

BEGIN;

-- ---- purchase orders: add p_order_id + retire path -------------------------
CREATE OR REPLACE FUNCTION public.sync_uae_tax_from_purchase_orders(
  p_from_date     DATE DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL,
  p_order_id      UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  WITH item_rows AS (
    SELECT
      po.id AS po_id, po.purchase_order_no AS bill_no, po.created_at::date AS bill_date,
      po.country_id, po.country_branch_id, po.city_branch_id, po.created_by, po.currency_code, po.exchange_rate,
      poi.id AS line_id, poi.goods_name,
      COALESCE(poi.taxable_amount, poi.total_local, poi.total_original, 0) AS taxable,
      COALESCE(poi.vat_rate, 5) AS vat_rate,
      COALESCE(poi.vat_amount, ROUND(COALESCE(poi.taxable_amount, poi.total_local, poi.total_original, 0) * COALESCE(poi.vat_rate,5) / 100.0, 2)) AS vat_amount,
      poi.tax_code_id,
      public.uae_resolve_tax_entity(po.country_branch_id, po.city_branch_id) AS entity_id
    FROM public.purchase_orders po
    JOIN public.countries co ON co.id = po.country_id AND upper(co.iso2) = 'AE'
    JOIN public.purchase_order_items poi ON poi.purchase_order_id = po.id
    WHERE po.deleted_at IS NULL AND poi.is_taxable = TRUE
      AND (p_from_date IS NULL OR po.created_at::date >= p_from_date)
      AND (p_order_id IS NULL OR po.id = p_order_id)
  )
  INSERT INTO public.uae_tax_lines (
    tax_entity_id, country_id, country_branch_id, city_branch_id, entered_by,
    source_module, source_table, source_id, source_line_id, source_reference_no, source_date,
    direction, transaction_category, tax_category,
    account_name, description,
    line_amount, vat_rate, taxable_amount, vat_amount, tax_code_id,
    recoverability, recoverable_amount,
    currency, exchange_rate, aed_taxable_amount, aed_vat_amount,
    tax_period_id, review_status, document_status
  )
  SELECT
    ir.entity_id, ir.country_id, ir.country_branch_id, ir.city_branch_id, ir.created_by,
    'purchase_order', 'purchase_order_items', ir.po_id, ir.line_id, ir.bill_no, ir.bill_date,
    'input', 'booking_purchase', 'standard',
    ir.goods_name, ir.goods_name,
    ir.taxable, ir.vat_rate, ir.taxable, ir.vat_amount, ir.tax_code_id,
    'recoverable', ir.vat_amount,
    ir.currency_code, ir.exchange_rate,
    CASE WHEN upper(ir.currency_code) = 'AED' THEN ir.taxable ELSE ir.taxable * ir.exchange_rate END,
    CASE WHEN upper(ir.currency_code) = 'AED' THEN ir.vat_amount ELSE ir.vat_amount * ir.exchange_rate END,
    public.uae_ensure_tax_period(ir.entity_id, ir.bill_date),
    CASE WHEN upper(ir.currency_code) = 'AED' THEN 'auto' ELSE 'needs_review' END,
    'missing'
  FROM item_rows ir
  WHERE ir.entity_id IS NOT NULL
  ON CONFLICT (source_module, source_id, COALESCE(source_line_id, source_id)) WHERE deleted_at IS NULL
  DO UPDATE SET
    taxable_amount = EXCLUDED.taxable_amount, vat_amount = EXCLUDED.vat_amount, vat_rate = EXCLUDED.vat_rate,
    tax_code_id = EXCLUDED.tax_code_id,
    aed_taxable_amount = EXCLUDED.aed_taxable_amount, aed_vat_amount = EXCLUDED.aed_vat_amount,
    tax_period_id = EXCLUDED.tax_period_id, updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.uae_tax_lines tl SET deleted_at = NOW(), updated_at = NOW()
  WHERE tl.source_module = 'purchase_order' AND tl.deleted_at IS NULL
    AND (p_order_id IS NULL OR tl.source_id = p_order_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.purchase_order_items poi
      JOIN public.purchase_orders po ON po.id = poi.purchase_order_id AND po.deleted_at IS NULL
      WHERE poi.id = tl.source_line_id AND poi.is_taxable = TRUE
    );

  RETURN v_count;
END;
$$;


-- ---- sales orders: add p_order_id + retire path ---------------------------
CREATE OR REPLACE FUNCTION public.sync_uae_tax_from_sales_orders(
  p_from_date     DATE DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL,
  p_order_id      UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  WITH item_rows AS (
    SELECT
      so.id AS so_id, so.sales_order_no AS bill_no, COALESCE(so.order_date, so.created_at::date) AS bill_date,
      so.country_id, so.country_branch_id, so.city_branch_id, so.created_by, so.customer_name,
      so.currency_code, so.exchange_rate,
      soi.id AS line_id, soi.goods_name, soi.tax_code_id,
      COALESCE(soi.taxable_amount, soi.total_local, soi.total_original, 0) AS taxable,
      COALESCE(soi.vat_rate, 5) AS vat_rate,
      COALESCE(soi.vat_amount, ROUND(COALESCE(soi.taxable_amount, soi.total_local, soi.total_original, 0) * COALESCE(soi.vat_rate,5)/100.0, 2)) AS vat_amount,
      public.uae_resolve_tax_entity(so.country_branch_id, so.city_branch_id) AS entity_id
    FROM public.sales_orders so
    JOIN public.countries co ON co.id = so.country_id AND upper(co.iso2) = 'AE'
    JOIN public.sales_order_items soi ON soi.sales_order_id = so.id AND soi.deleted_at IS NULL
    WHERE so.deleted_at IS NULL AND soi.is_taxable = TRUE
      AND (p_from_date IS NULL OR COALESCE(so.order_date, so.created_at::date) >= p_from_date)
      AND (p_order_id IS NULL OR so.id = p_order_id)
  )
  INSERT INTO public.uae_tax_lines (
    tax_entity_id, country_id, country_branch_id, city_branch_id, entered_by,
    source_module, source_table, source_id, source_line_id, source_reference_no, source_date,
    direction, transaction_category, tax_category,
    party_name, account_name, description,
    line_amount, vat_rate, taxable_amount, vat_amount, tax_code_id,
    recoverability, recoverable_amount,
    currency, exchange_rate, aed_taxable_amount, aed_vat_amount,
    tax_period_id, review_status, document_status
  )
  SELECT
    ir.entity_id, ir.country_id, ir.country_branch_id, ir.city_branch_id, ir.created_by,
    'sales_order', 'sales_order_items', ir.so_id, ir.line_id, ir.bill_no, ir.bill_date,
    'output', 'booking_sale', 'standard',
    ir.customer_name, ir.goods_name, ir.goods_name,
    ir.taxable, ir.vat_rate, ir.taxable, ir.vat_amount, ir.tax_code_id,
    'non_recoverable', 0,
    ir.currency_code, ir.exchange_rate,
    CASE WHEN upper(ir.currency_code) = 'AED' THEN ir.taxable ELSE ir.taxable * ir.exchange_rate END,
    CASE WHEN upper(ir.currency_code) = 'AED' THEN ir.vat_amount ELSE ir.vat_amount * ir.exchange_rate END,
    public.uae_ensure_tax_period(ir.entity_id, ir.bill_date),
    CASE WHEN upper(ir.currency_code) = 'AED' THEN 'auto' ELSE 'needs_review' END,
    'missing'
  FROM item_rows ir
  WHERE ir.entity_id IS NOT NULL
  ON CONFLICT (source_module, source_id, COALESCE(source_line_id, source_id)) WHERE deleted_at IS NULL
  DO UPDATE SET
    taxable_amount = EXCLUDED.taxable_amount, vat_amount = EXCLUDED.vat_amount, vat_rate = EXCLUDED.vat_rate,
    tax_code_id = EXCLUDED.tax_code_id,
    aed_taxable_amount = EXCLUDED.aed_taxable_amount, aed_vat_amount = EXCLUDED.aed_vat_amount,
    party_name = EXCLUDED.party_name, tax_period_id = EXCLUDED.tax_period_id, updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.uae_tax_lines tl SET deleted_at = NOW(), updated_at = NOW()
  WHERE tl.source_module = 'sales_order' AND tl.deleted_at IS NULL
    AND (p_order_id IS NULL OR tl.source_id = p_order_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.sales_order_items soi
      JOIN public.sales_orders so ON so.id = soi.sales_order_id AND so.deleted_at IS NULL
      WHERE soi.id = tl.source_line_id AND soi.is_taxable = TRUE AND soi.deleted_at IS NULL
    );

  RETURN v_count;
END;
$$;


-- ---- triggers ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_uae_tax_sync_po_items()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_uae_tax_from_purchase_orders(NULL, NULL, COALESCE(NEW.purchase_order_id, OLD.purchase_order_id));
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_uae_tax_po_items ON public.purchase_order_items;
CREATE TRIGGER trg_uae_tax_po_items
  AFTER INSERT OR UPDATE OF is_taxable, vat_rate, vat_amount, taxable_amount, total_local OR DELETE
  ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_tax_sync_po_items();

CREATE OR REPLACE FUNCTION public.trg_uae_tax_sync_so_items()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_uae_tax_from_sales_orders(NULL, NULL, COALESCE(NEW.sales_order_id, OLD.sales_order_id));
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_uae_tax_so_items ON public.sales_order_items;
CREATE TRIGGER trg_uae_tax_so_items
  AFTER INSERT OR UPDATE OF is_taxable, vat_rate, vat_amount, taxable_amount, total_local, deleted_at OR DELETE
  ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_tax_sync_so_items();

GRANT EXECUTE ON FUNCTION public.trg_uae_tax_sync_po_items TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_uae_tax_sync_so_items TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260911_uae_tax_order_item_triggers', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
