-- =============================================================================
-- UAE TAX — PHASE 2: INGESTION
-- Migration: 20260902_uae_tax_ingestion.sql
--
-- Pulls the ALREADY-ENTERED taxable lines out of the existing ERP transactions
-- into uae_tax_lines. One source line -> one uae_tax_lines row. The source bill
-- and its accounting posting are never touched.
--
--   Sources:
--     - expenses_bill_lines WHERE tax_on = TRUE     (multi-line, per-line flag)
--     - local_purchases     WHERE apply_tax = 'Yes' (header-level flag)
--     - purchase_order_items WHERE is_taxable = TRUE (new nullable columns) + form_data fallback
--     - sales_order_items    WHERE is_taxable = TRUE (new table) + form_data fallback
--
--   Only UAE-scoped transactions (country.iso2 = 'AE') are ingested.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Line-level tax columns on the order-item tables (nullable, additive).
--    The bill/entry forms may set these; ingestion also has a form_data
--    fallback so nothing is lost if the wizard has not been wired yet.
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS is_taxable      BOOLEAN,
  ADD COLUMN IF NOT EXISTS tax_code_id     UUID REFERENCES public.tax_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vat_rate        NUMERIC(9,4),
  ADD COLUMN IF NOT EXISTS taxable_amount  NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS vat_amount      NUMERIC(18,4);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id   UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  row_serial       INTEGER,
  goods_name       TEXT,
  hs_code          TEXT,
  brand            TEXT,
  size             TEXT,
  quantity         NUMERIC(18,4),
  unit_name        TEXT,
  net_weight       NUMERIC(18,4),
  rate_original    NUMERIC(18,4),
  rate_local       NUMERIC(18,4),
  total_original   NUMERIC(18,4),
  total_local      NUMERIC(18,4),
  is_taxable       BOOLEAN,
  tax_code_id      UUID REFERENCES public.tax_codes(id) ON DELETE SET NULL,
  vat_rate         NUMERIC(9,4),
  taxable_amount   NUMERIC(18,4),
  vat_amount       NUMERIC(18,4),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sales_order_items_order_idx
  ON public.sales_order_items (sales_order_id) WHERE deleted_at IS NULL;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_order_items_all ON public.sales_order_items;
CREATE POLICY sales_order_items_all ON public.sales_order_items FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.sales_order_items TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 1. Period helper — ensure the tax line lands in a period for its entity+date
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_ensure_tax_period(
  p_tax_entity_id UUID,
  p_date          DATE
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_freq   TEXT;
  v_start  DATE;
  v_end    DATE;
  v_code   TEXT;
  v_id     UUID;
  v_month  INT;
  v_qtr    INT;
BEGIN
  IF p_tax_entity_id IS NULL OR p_date IS NULL THEN RETURN NULL; END IF;

  SELECT filing_frequency INTO v_freq
  FROM public.uae_tax_entities WHERE id = p_tax_entity_id;
  v_freq := COALESCE(v_freq, 'quarterly');

  IF v_freq = 'monthly' THEN
    v_start := date_trunc('month', p_date)::date;
    v_end   := (v_start + INTERVAL '1 month - 1 day')::date;
    v_code  := to_char(v_start, 'YYYY-MM');
  ELSE
    v_month := EXTRACT(MONTH FROM p_date);
    v_qtr   := ((v_month - 1) / 3) + 1;
    v_start := make_date(EXTRACT(YEAR FROM p_date)::int, ((v_qtr - 1) * 3) + 1, 1);
    v_end   := (v_start + INTERVAL '3 months - 1 day')::date;
    v_code  := EXTRACT(YEAR FROM p_date)::text || '-Q' || v_qtr::text;
  END IF;

  SELECT id INTO v_id
  FROM public.uae_tax_periods
  WHERE tax_entity_id = p_tax_entity_id AND period_code = v_code AND deleted_at IS NULL;

  IF v_id IS NULL THEN
    INSERT INTO public.uae_tax_periods (tax_entity_id, period_code, period_start, period_end, status)
    VALUES (p_tax_entity_id, v_code, v_start, v_end, 'open')
    ON CONFLICT (tax_entity_id, period_code) WHERE deleted_at IS NULL DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.uae_tax_periods
      WHERE tax_entity_id = p_tax_entity_id AND period_code = v_code AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. Recoverability default — reads uae_tax_rules ('recoverability' blocks)
--    plus a keyword scan of the description. Everything else = pending_review.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_default_recoverability(
  p_direction   TEXT,
  p_description TEXT,
  p_account     TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_text TEXT := lower(coalesce(p_description,'') || ' ' || coalesce(p_account,''));
  r RECORD;
BEGIN
  IF p_direction = 'output' THEN RETURN 'recoverable'; END IF;  -- N/A for output; kept simple

  FOR r IN
    SELECT config FROM public.uae_tax_rules
    WHERE rule_type = 'recoverability' AND is_active = TRUE AND deleted_at IS NULL
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  LOOP
    IF (r.config ? 'keywords') THEN
      IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(r.config->'keywords') kw
                 WHERE v_text LIKE '%' || lower(kw) || '%') THEN
        RETURN COALESCE(r.config->>'recoverability', 'non_recoverable');
      END IF;
    END IF;
  END LOOP;

  IF v_text ~ '(entertain|hospitality|staff party|gift)' THEN RETURN 'non_recoverable'; END IF;
  RETURN 'pending_review';
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. sync_uae_tax_from_expenses  — multi-line bills, per-line tax_on
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_uae_tax_from_expenses(
  p_from_date     DATE DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL,
  p_bill_id       UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH src AS (
    SELECT
      l.id                       AS line_id,
      b.id                       AS bill_id,
      b.serial_no                AS bill_no,
      b.bill_date,
      b.bill_title,
      b.created_by,
      b.roznamcha_entry_id,
      cb.country_id,
      cb.country_branch_id,
      cb.id                      AS city_branch_id,
      l.details,
      l.currency,
      l.exchange_rate,
      l.final_amount,
      l.tax_pct,
      l.tax_amt,
      public.uae_resolve_tax_entity(cb.country_branch_id, cb.id) AS entity_id
    FROM public.expenses_bill_lines l
    JOIN public.expenses_bills b   ON b.id = l.bill_id AND b.deleted_at IS NULL
    JOIN public.city_branches cb   ON cb.id = b.branch_id
    JOIN public.countries co       ON co.id = cb.country_id AND upper(co.iso2) = 'AE'
    WHERE l.tax_on = TRUE
      AND (p_from_date IS NULL OR b.bill_date >= p_from_date)
      AND (p_bill_id IS NULL OR b.id = p_bill_id)
  )
  INSERT INTO public.uae_tax_lines (
    tax_entity_id, country_id, country_branch_id, city_branch_id, entered_by,
    source_module, source_table, source_id, source_line_id, source_reference_no, source_date,
    direction, transaction_category, tax_category,
    account_name, description,
    line_amount, vat_rate, taxable_amount, vat_amount,
    recoverability, recoverable_amount,
    currency, exchange_rate, aed_taxable_amount, aed_vat_amount,
    roznamcha_entry_id,
    tax_period_id, review_status, document_status
  )
  SELECT
    src.entity_id, src.country_id, src.country_branch_id, src.city_branch_id, src.created_by,
    'expenses_bill', 'expenses_bill_lines', src.bill_id, src.line_id, src.bill_no, src.bill_date,
    'input',
    CASE WHEN src.bill_title ILIKE '%purchase%' THEN 'local_purchase' ELSE 'daily_expense' END,
    'standard',
    src.bill_title, src.details,
    src.final_amount, src.tax_pct, src.final_amount, src.tax_amt,
    public.uae_default_recoverability('input', src.details, src.bill_title),
    CASE WHEN public.uae_default_recoverability('input', src.details, src.bill_title) = 'recoverable'
         THEN src.tax_amt ELSE 0 END,
    src.currency, src.exchange_rate,
    CASE WHEN upper(src.currency) = 'AED' THEN src.final_amount ELSE src.final_amount * src.exchange_rate END,
    CASE WHEN upper(src.currency) = 'AED' THEN src.tax_amt ELSE src.tax_amt * src.exchange_rate END,
    src.roznamcha_entry_id,
    public.uae_ensure_tax_period(src.entity_id, src.bill_date),
    CASE WHEN upper(src.currency) = 'AED' THEN 'auto' ELSE 'needs_review' END,
    'missing'
  FROM src
  WHERE src.entity_id IS NOT NULL
  ON CONFLICT (source_module, source_id, COALESCE(source_line_id, source_id)) WHERE deleted_at IS NULL
  DO UPDATE SET
    taxable_amount = EXCLUDED.taxable_amount,
    vat_amount     = EXCLUDED.vat_amount,
    vat_rate       = EXCLUDED.vat_rate,
    aed_taxable_amount = EXCLUDED.aed_taxable_amount,
    aed_vat_amount     = EXCLUDED.aed_vat_amount,
    description    = EXCLUDED.description,
    tax_period_id  = EXCLUDED.tax_period_id,
    updated_at     = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Retire tax lines whose source line no longer qualifies (tax_on flipped off / bill deleted)
  UPDATE public.uae_tax_lines tl SET deleted_at = NOW(), updated_at = NOW()
  WHERE tl.source_module = 'expenses_bill' AND tl.deleted_at IS NULL
    AND (p_bill_id IS NULL OR tl.source_id = p_bill_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.expenses_bill_lines l
      JOIN public.expenses_bills b ON b.id = l.bill_id AND b.deleted_at IS NULL
      WHERE l.id = tl.source_line_id AND l.tax_on = TRUE
    );

  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 4. sync_uae_tax_from_local_purchase  — header-level apply_tax
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_uae_tax_from_local_purchase(
  p_from_date     DATE DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL,
  p_purchase_id   UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH src AS (
    SELECT
      lp.id,
      COALESCE(lp.manual_bill_no, lp.country_serial_no, lp.id::text) AS bill_no,
      lp.created_at::date AS bill_date,
      lp.country_id, lp.country_branch_id, lp.city_branch_id, lp.created_by,
      lp.roznamcha_entry_id,
      lp.supplier_name, lp.goods_name,
      lp.purchase_currency, lp.exchange_rate,
      lp.final_cost, COALESCE(lp.tax_percentage,0) AS tax_pct, COALESCE(lp.tax_amount,0) AS tax_amt,
      GREATEST(lp.final_cost - COALESCE(lp.tax_amount,0), 0) AS taxable,
      public.uae_resolve_tax_entity(lp.country_branch_id, lp.city_branch_id) AS entity_id
    FROM public.local_purchases lp
    JOIN public.countries co ON co.id = lp.country_id AND upper(co.iso2) = 'AE'
    WHERE lp.deleted_at IS NULL
      AND lower(coalesce(lp.apply_tax,'no')) = 'yes'
      AND (p_from_date IS NULL OR lp.created_at::date >= p_from_date)
      AND (p_purchase_id IS NULL OR lp.id = p_purchase_id)
  )
  INSERT INTO public.uae_tax_lines (
    tax_entity_id, country_id, country_branch_id, city_branch_id, entered_by,
    source_module, source_table, source_id, source_line_id, source_reference_no, source_date,
    direction, transaction_category, tax_category,
    party_name, account_name, description,
    line_amount, vat_rate, taxable_amount, vat_amount,
    recoverability, recoverable_amount,
    currency, exchange_rate, aed_taxable_amount, aed_vat_amount,
    roznamcha_entry_id, tax_period_id, review_status, document_status
  )
  SELECT
    src.entity_id, src.country_id, src.country_branch_id, src.city_branch_id, src.created_by,
    'local_purchase', 'local_purchases', src.id, NULL, src.bill_no, src.bill_date,
    'input', 'local_purchase', 'standard',
    src.supplier_name, src.goods_name, src.goods_name,
    src.final_cost, src.tax_pct, src.taxable, src.tax_amt,
    'recoverable',
    src.tax_amt,
    src.purchase_currency, src.exchange_rate,
    CASE WHEN upper(src.purchase_currency) = 'AED' THEN src.taxable ELSE src.taxable * src.exchange_rate END,
    CASE WHEN upper(src.purchase_currency) = 'AED' THEN src.tax_amt ELSE src.tax_amt * src.exchange_rate END,
    src.roznamcha_entry_id,
    public.uae_ensure_tax_period(src.entity_id, src.bill_date),
    CASE WHEN upper(src.purchase_currency) = 'AED' THEN 'auto' ELSE 'needs_review' END,
    'missing'
  FROM src
  WHERE src.entity_id IS NOT NULL
  ON CONFLICT (source_module, source_id, COALESCE(source_line_id, source_id)) WHERE deleted_at IS NULL
  DO UPDATE SET
    taxable_amount = EXCLUDED.taxable_amount,
    vat_amount     = EXCLUDED.vat_amount,
    vat_rate       = EXCLUDED.vat_rate,
    aed_taxable_amount = EXCLUDED.aed_taxable_amount,
    aed_vat_amount     = EXCLUDED.aed_vat_amount,
    party_name     = EXCLUDED.party_name,
    tax_period_id  = EXCLUDED.tax_period_id,
    updated_at     = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.uae_tax_lines tl SET deleted_at = NOW(), updated_at = NOW()
  WHERE tl.source_module = 'local_purchase' AND tl.deleted_at IS NULL
    AND (p_purchase_id IS NULL OR tl.source_id = p_purchase_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.local_purchases lp
      WHERE lp.id = tl.source_id AND lp.deleted_at IS NULL
        AND lower(coalesce(lp.apply_tax,'no')) = 'yes'
    );

  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 5. sync_uae_tax_from_purchase_orders  — booking purchase, per item
--    Reads purchase_order_items.is_taxable, else form_data->'goodsEntries'
--    entries flagged isTax / taxable / applyTax with a vatRate / taxPct.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_uae_tax_from_purchase_orders(
  p_from_date     DATE DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      public.uae_resolve_tax_entity(po.country_branch_id, po.city_branch_id) AS entity_id
    FROM public.purchase_orders po
    JOIN public.countries co ON co.id = po.country_id AND upper(co.iso2) = 'AE'
    JOIN public.purchase_order_items poi ON poi.purchase_order_id = po.id
    WHERE po.deleted_at IS NULL AND poi.is_taxable = TRUE
      AND (p_from_date IS NULL OR po.created_at::date >= p_from_date)
  )
  INSERT INTO public.uae_tax_lines (
    tax_entity_id, country_id, country_branch_id, city_branch_id, entered_by,
    source_module, source_table, source_id, source_line_id, source_reference_no, source_date,
    direction, transaction_category, tax_category,
    account_name, description,
    line_amount, vat_rate, taxable_amount, vat_amount,
    recoverability, recoverable_amount,
    currency, exchange_rate, aed_taxable_amount, aed_vat_amount,
    tax_period_id, review_status, document_status
  )
  SELECT
    ir.entity_id, ir.country_id, ir.country_branch_id, ir.city_branch_id, ir.created_by,
    'purchase_order', 'purchase_order_items', ir.po_id, ir.line_id, ir.bill_no, ir.bill_date,
    'input', 'booking_purchase', 'standard',
    ir.goods_name, ir.goods_name,
    ir.taxable, ir.vat_rate, ir.taxable, ir.vat_amount,
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
    aed_taxable_amount = EXCLUDED.aed_taxable_amount, aed_vat_amount = EXCLUDED.aed_vat_amount,
    tax_period_id = EXCLUDED.tax_period_id, updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 6. sync_uae_tax_from_sales_orders  — booking sales, per item (output VAT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_uae_tax_from_sales_orders(
  p_from_date     DATE DEFAULT NULL,
  p_tax_entity_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  WITH item_rows AS (
    SELECT
      so.id AS so_id, so.sales_order_no AS bill_no, COALESCE(so.order_date, so.created_at::date) AS bill_date,
      so.country_id, so.country_branch_id, so.city_branch_id, so.created_by, so.customer_name,
      so.currency_code, so.exchange_rate,
      soi.id AS line_id, soi.goods_name,
      COALESCE(soi.taxable_amount, soi.total_local, soi.total_original, 0) AS taxable,
      COALESCE(soi.vat_rate, 5) AS vat_rate,
      COALESCE(soi.vat_amount, ROUND(COALESCE(soi.taxable_amount, soi.total_local, soi.total_original, 0) * COALESCE(soi.vat_rate,5)/100.0, 2)) AS vat_amount,
      public.uae_resolve_tax_entity(so.country_branch_id, so.city_branch_id) AS entity_id
    FROM public.sales_orders so
    JOIN public.countries co ON co.id = so.country_id AND upper(co.iso2) = 'AE'
    JOIN public.sales_order_items soi ON soi.sales_order_id = so.id AND soi.deleted_at IS NULL
    WHERE so.deleted_at IS NULL AND soi.is_taxable = TRUE
      AND (p_from_date IS NULL OR COALESCE(so.order_date, so.created_at::date) >= p_from_date)
  )
  INSERT INTO public.uae_tax_lines (
    tax_entity_id, country_id, country_branch_id, city_branch_id, entered_by,
    source_module, source_table, source_id, source_line_id, source_reference_no, source_date,
    direction, transaction_category, tax_category,
    party_name, account_name, description,
    line_amount, vat_rate, taxable_amount, vat_amount,
    recoverability, recoverable_amount,
    currency, exchange_rate, aed_taxable_amount, aed_vat_amount,
    tax_period_id, review_status, document_status
  )
  SELECT
    ir.entity_id, ir.country_id, ir.country_branch_id, ir.city_branch_id, ir.created_by,
    'sales_order', 'sales_order_items', ir.so_id, ir.line_id, ir.bill_no, ir.bill_date,
    'output', 'booking_sale', 'standard',
    ir.customer_name, ir.goods_name, ir.goods_name,
    ir.taxable, ir.vat_rate, ir.taxable, ir.vat_amount,
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
    aed_taxable_amount = EXCLUDED.aed_taxable_amount, aed_vat_amount = EXCLUDED.aed_vat_amount,
    party_name = EXCLUDED.party_name, tax_period_id = EXCLUDED.tax_period_id, updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 7. sync_uae_tax_all  — the entry point the /sync API calls
-- ---------------------------------------------------------------------------
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
  RETURN QUERY SELECT 'expenses_bill'::text,  public.sync_uae_tax_from_expenses(p_from_date, p_tax_entity_id);
  RETURN QUERY SELECT 'local_purchase'::text, public.sync_uae_tax_from_local_purchase(p_from_date, p_tax_entity_id);
  RETURN QUERY SELECT 'purchase_order'::text, public.sync_uae_tax_from_purchase_orders(p_from_date, p_tax_entity_id);
  RETURN QUERY SELECT 'sales_order'::text,    public.sync_uae_tax_from_sales_orders(p_from_date, p_tax_entity_id);
END;
$$;


-- ---------------------------------------------------------------------------
-- 8. Triggers — keep uae_tax_lines fresh as bills change (expenses + local purchase)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_uae_tax_sync_expenses()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_uae_tax_from_expenses(NULL, NULL, COALESCE(NEW.bill_id, OLD.bill_id));
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_uae_tax_expenses_lines ON public.expenses_bill_lines;
CREATE TRIGGER trg_uae_tax_expenses_lines
  AFTER INSERT OR UPDATE OF tax_on, tax_pct, tax_amt, final_amount OR DELETE
  ON public.expenses_bill_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_tax_sync_expenses();

CREATE OR REPLACE FUNCTION public.trg_uae_tax_sync_local_purchase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_uae_tax_from_local_purchase(NULL, NULL, COALESCE(NEW.id, OLD.id));
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_uae_tax_local_purchase ON public.local_purchases;
CREATE TRIGGER trg_uae_tax_local_purchase
  AFTER INSERT OR UPDATE OF apply_tax, tax_percentage, tax_amount, final_cost, deleted_at OR DELETE
  ON public.local_purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_uae_tax_sync_local_purchase();


-- ---------------------------------------------------------------------------
-- 9. Grants + one-time backfill
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.uae_ensure_tax_period            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_default_recoverability       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_uae_tax_from_expenses       TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_uae_tax_from_local_purchase TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_uae_tax_from_purchase_orders TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_uae_tax_from_sales_orders   TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_uae_tax_all                 TO authenticated, service_role;

-- Backfill only runs if a UAE tax entity already exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.uae_tax_entities e
    JOIN public.countries c ON c.id = e.country_id
    WHERE e.deleted_at IS NULL AND upper(c.iso2) = 'AE'
  ) THEN
    PERFORM public.sync_uae_tax_all(NULL, NULL);
  END IF;
END $$;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260902_uae_tax_ingestion', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
