-- =============================================================================
-- UAE TAX — PHASE 4: VAT RETURN PREPARATION & RECOVERY
-- Migration: 20260904_uae_vat_return.sql
--
--   - uae_vat_returns        : one FTA VAT 201 return per entity + period
--   - uae_vat_return_lines   : links each uae_tax_line to a return box
--   - uae_vat_recovery       : recoverable / claimed / refund / carry-forward
--   - uae_vat_return_preview(period)  : live VAT 201 box computation
--   - uae_generate_vat_return(period) : materialise the return
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.uae_vat_returns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_entity_id       UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE CASCADE,
  tax_period_id       UUID NOT NULL REFERENCES public.uae_tax_periods(id) ON DELETE CASCADE,

  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'ready', 'filed', 'amended')),

  -- FTA VAT 201 boxes (AED). box1 = standard-rated supplies, box6 = goods imported
  -- (reverse charge), box9 = standard-rated expenses, box10 = imports subject to RC.
  box1_standard_supplies_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  box1_standard_supplies_vat      NUMERIC(18,2) NOT NULL DEFAULT 0,
  box2_refunds_to_tourists_vat    NUMERIC(18,2) NOT NULL DEFAULT 0,
  box3_reverse_charge_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  box3_reverse_charge_vat         NUMERIC(18,2) NOT NULL DEFAULT 0,
  box4_zero_rated_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  box5_exempt_amount              NUMERIC(18,2) NOT NULL DEFAULT 0,
  box6_goods_imported_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  box6_goods_imported_vat         NUMERIC(18,2) NOT NULL DEFAULT 0,
  box7_adjustments_imports_vat    NUMERIC(18,2) NOT NULL DEFAULT 0,
  box8_total_output_vat           NUMERIC(18,2) NOT NULL DEFAULT 0,
  box9_standard_expenses_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  box9_standard_expenses_vat      NUMERIC(18,2) NOT NULL DEFAULT 0,
  box10_imports_recoverable_vat   NUMERIC(18,2) NOT NULL DEFAULT 0,
  box11_total_input_vat           NUMERIC(18,2) NOT NULL DEFAULT 0,
  box12_net_vat_payable           NUMERIC(18,2) NOT NULL DEFAULT 0,

  fta_reference       TEXT,
  prepared_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  filed_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  filed_at            TIMESTAMPTZ,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uae_vat_returns_period_idx
  ON public.uae_vat_returns (tax_period_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.uae_vat_return_lines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vat_return_id  UUID NOT NULL REFERENCES public.uae_vat_returns(id) ON DELETE CASCADE,
  tax_line_id    UUID NOT NULL REFERENCES public.uae_tax_lines(id) ON DELETE CASCADE,
  box_code       TEXT NOT NULL,
  taxable_aed    NUMERIC(18,2) NOT NULL DEFAULT 0,
  vat_aed        NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS uae_vat_return_lines_return_idx ON public.uae_vat_return_lines (vat_return_id);
CREATE UNIQUE INDEX IF NOT EXISTS uae_vat_return_lines_pair_idx ON public.uae_vat_return_lines (vat_return_id, tax_line_id);

CREATE TABLE IF NOT EXISTS public.uae_vat_recovery (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_entity_id        UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE CASCADE,
  tax_period_id        UUID REFERENCES public.uae_tax_periods(id) ON DELETE SET NULL,
  tax_line_id          UUID REFERENCES public.uae_tax_lines(id) ON DELETE SET NULL,
  vat_return_id        UUID REFERENCES public.uae_vat_returns(id) ON DELETE SET NULL,

  status               TEXT NOT NULL DEFAULT 'recoverable'
                         CHECK (status IN (
                           'recoverable', 'pending', 'claimed', 'carry_forward',
                           'refund_requested', 'refund_received', 'rejected', 'adjusted'
                         )),
  amount_aed           NUMERIC(18,2) NOT NULL DEFAULT 0,
  evidence_document_id UUID REFERENCES public.office_documents(id) ON DELETE SET NULL,
  fta_reference        TEXT,
  requested_at         TIMESTAMPTZ,
  received_at          TIMESTAMPTZ,
  notes                TEXT,

  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS uae_vat_recovery_entity_idx ON public.uae_vat_recovery (tax_entity_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS uae_vat_recovery_period_idx ON public.uae_vat_recovery (tax_period_id) WHERE deleted_at IS NULL;

-- Back-reference FKs added now that the target tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'uae_tax_periods_filed_return_fk') THEN
    ALTER TABLE public.uae_tax_periods
      ADD CONSTRAINT uae_tax_periods_filed_return_fk
      FOREIGN KEY (filed_return_id) REFERENCES public.uae_vat_returns(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'uae_tax_lines_vat_return_fk') THEN
    ALTER TABLE public.uae_tax_lines
      ADD CONSTRAINT uae_tax_lines_vat_return_fk
      FOREIGN KEY (vat_return_id) REFERENCES public.uae_vat_returns(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- Box mapping — the single place that decides which VAT 201 box a line hits
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_vat_box_for_line(
  p_direction TEXT, p_tax_category TEXT, p_transaction_category TEXT
)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_direction = 'output' AND p_tax_category = 'standard'      THEN '1'
    WHEN p_direction = 'output' AND p_tax_category = 'zero_rated'    THEN '4'
    WHEN p_direction = 'output' AND p_tax_category = 'exempt'        THEN '5'
    WHEN p_direction = 'output' AND p_tax_category = 'reverse_charge' THEN '3'
    WHEN p_direction = 'input'  AND p_transaction_category = 'import' THEN '10'
    WHEN p_direction = 'input'  AND p_tax_category = 'reverse_charge' THEN '3'
    WHEN p_direction = 'input'                                        THEN '9'
    ELSE '1'
  END;
$$;


-- ---------------------------------------------------------------------------
-- uae_vat_return_preview(period) — live box computation from uae_tax_lines
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_vat_return_preview(p_period_id UUID)
RETURNS TABLE (
  box1_amount NUMERIC, box1_vat NUMERIC,
  box3_amount NUMERIC, box3_vat NUMERIC,
  box4_amount NUMERIC, box5_amount NUMERIC,
  box6_amount NUMERIC, box6_vat NUMERIC,
  box8_total_output_vat NUMERIC,
  box9_amount NUMERIC, box9_vat NUMERIC,
  box10_imports_vat NUMERIC,
  box11_total_input_vat NUMERIC,
  box12_net_vat NUMERIC,
  lines_total BIGINT, lines_missing_document BIGINT, lines_needs_review BIGINT
)
LANGUAGE SQL STABLE SET search_path = public
AS $$
  WITH b AS (
    SELECT
      public.uae_vat_box_for_line(direction, tax_category, transaction_category) AS box,
      direction, tax_category, transaction_category, recoverability,
      aed_taxable_amount AS amt, aed_vat_amount AS vat, document_status, review_status
    FROM public.uae_tax_lines
    WHERE deleted_at IS NULL AND tax_period_id = p_period_id
  )
  SELECT
    COALESCE(SUM(amt) FILTER (WHERE box='1'),0),
    COALESCE(SUM(vat) FILTER (WHERE box='1'),0),
    COALESCE(SUM(amt) FILTER (WHERE box='3'),0),
    COALESCE(SUM(vat) FILTER (WHERE box='3'),0),
    COALESCE(SUM(amt) FILTER (WHERE box='4'),0),
    COALESCE(SUM(amt) FILTER (WHERE box='5'),0),
    COALESCE(SUM(amt) FILTER (WHERE box='10' AND direction='input'),0),
    COALESCE(SUM(vat) FILTER (WHERE box='10' AND direction='input'),0),
    COALESCE(SUM(vat) FILTER (WHERE direction='output'),0)
      + COALESCE(SUM(vat) FILTER (WHERE box='3'),0),
    COALESCE(SUM(amt) FILTER (WHERE box='9'),0),
    COALESCE(SUM(vat) FILTER (WHERE box='9' AND recoverability IN ('recoverable','partial')),0),
    COALESCE(SUM(vat) FILTER (WHERE box='10' AND direction='input' AND recoverability IN ('recoverable','partial')),0),
    COALESCE(SUM(vat) FILTER (WHERE direction='input' AND recoverability IN ('recoverable','partial')),0)
      + COALESCE(SUM(vat) FILTER (WHERE box='3'),0),
    (COALESCE(SUM(vat) FILTER (WHERE direction='output'),0) + COALESCE(SUM(vat) FILTER (WHERE box='3'),0))
      - (COALESCE(SUM(vat) FILTER (WHERE direction='input' AND recoverability IN ('recoverable','partial')),0)
         + COALESCE(SUM(vat) FILTER (WHERE box='3'),0)),
    COUNT(*),
    COUNT(*) FILTER (WHERE document_status = 'missing'),
    COUNT(*) FILTER (WHERE review_status = 'needs_review')
  FROM b;
$$;


-- ---------------------------------------------------------------------------
-- uae_generate_vat_return(period, actor) — materialise the return
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_generate_vat_return(p_period_id UUID, p_actor UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entity UUID;
  v_return UUID;
  p RECORD;
BEGIN
  SELECT tax_entity_id INTO v_entity FROM public.uae_tax_periods WHERE id = p_period_id;
  IF v_entity IS NULL THEN RAISE EXCEPTION 'Unknown tax period %', p_period_id; END IF;

  SELECT * INTO p FROM public.uae_vat_return_preview(p_period_id);

  INSERT INTO public.uae_vat_returns (
    tax_entity_id, tax_period_id, status,
    box1_standard_supplies_amount, box1_standard_supplies_vat,
    box3_reverse_charge_amount, box3_reverse_charge_vat,
    box4_zero_rated_amount, box5_exempt_amount,
    box6_goods_imported_amount, box6_goods_imported_vat,
    box8_total_output_vat,
    box9_standard_expenses_amount, box9_standard_expenses_vat,
    box10_imports_recoverable_vat, box11_total_input_vat, box12_net_vat_payable,
    prepared_by
  )
  VALUES (
    v_entity, p_period_id, 'draft',
    p.box1_amount, p.box1_vat, p.box3_amount, p.box3_vat,
    p.box4_amount, p.box5_amount, p.box6_amount, p.box6_vat, p.box8_total_output_vat,
    p.box9_amount, p.box9_vat, p.box10_imports_vat, p.box11_total_input_vat, p.box12_net_vat,
    p_actor
  )
  ON CONFLICT (tax_period_id) WHERE deleted_at IS NULL
  DO UPDATE SET
    box1_standard_supplies_amount = EXCLUDED.box1_standard_supplies_amount,
    box1_standard_supplies_vat    = EXCLUDED.box1_standard_supplies_vat,
    box3_reverse_charge_amount     = EXCLUDED.box3_reverse_charge_amount,
    box3_reverse_charge_vat        = EXCLUDED.box3_reverse_charge_vat,
    box4_zero_rated_amount         = EXCLUDED.box4_zero_rated_amount,
    box5_exempt_amount             = EXCLUDED.box5_exempt_amount,
    box6_goods_imported_amount     = EXCLUDED.box6_goods_imported_amount,
    box6_goods_imported_vat        = EXCLUDED.box6_goods_imported_vat,
    box8_total_output_vat          = EXCLUDED.box8_total_output_vat,
    box9_standard_expenses_amount  = EXCLUDED.box9_standard_expenses_amount,
    box9_standard_expenses_vat     = EXCLUDED.box9_standard_expenses_vat,
    box10_imports_recoverable_vat  = EXCLUDED.box10_imports_recoverable_vat,
    box11_total_input_vat          = EXCLUDED.box11_total_input_vat,
    box12_net_vat_payable          = EXCLUDED.box12_net_vat_payable,
    updated_at = NOW()
  RETURNING id INTO v_return;

  IF v_return IS NULL THEN
    SELECT id INTO v_return FROM public.uae_vat_returns WHERE tax_period_id = p_period_id AND deleted_at IS NULL;
  END IF;

  DELETE FROM public.uae_vat_return_lines WHERE vat_return_id = v_return;
  INSERT INTO public.uae_vat_return_lines (vat_return_id, tax_line_id, box_code, taxable_aed, vat_aed)
  SELECT v_return, tl.id,
         public.uae_vat_box_for_line(tl.direction, tl.tax_category, tl.transaction_category),
         tl.aed_taxable_amount, tl.aed_vat_amount
  FROM public.uae_tax_lines tl
  WHERE tl.deleted_at IS NULL AND tl.tax_period_id = p_period_id;

  UPDATE public.uae_tax_lines tl
  SET vat_return_id = v_return,
      vat_return_box = public.uae_vat_box_for_line(tl.direction, tl.tax_category, tl.transaction_category),
      updated_at = NOW()
  WHERE tl.deleted_at IS NULL AND tl.tax_period_id = p_period_id;

  UPDATE public.uae_tax_periods SET status = 'closing', filed_return_id = v_return, updated_at = NOW()
  WHERE id = p_period_id AND status = 'open';

  RETURN v_return;
END;
$$;


-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.uae_vat_returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_vat_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_vat_recovery     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uae_vat_returns_rw ON public.uae_vat_returns;
CREATE POLICY uae_vat_returns_rw ON public.uae_vat_returns FOR ALL USING (
  EXISTS (SELECT 1 FROM public.uae_tax_entities e WHERE e.id = uae_vat_returns.tax_entity_id
          AND (public.is_super_admin() OR public.can_access_country(e.country_id))));

DROP POLICY IF EXISTS uae_vat_return_lines_rw ON public.uae_vat_return_lines;
CREATE POLICY uae_vat_return_lines_rw ON public.uae_vat_return_lines FOR ALL USING (
  EXISTS (SELECT 1 FROM public.uae_vat_returns r WHERE r.id = uae_vat_return_lines.vat_return_id));

DROP POLICY IF EXISTS uae_vat_recovery_rw ON public.uae_vat_recovery;
CREATE POLICY uae_vat_recovery_rw ON public.uae_vat_recovery FOR ALL USING (
  EXISTS (SELECT 1 FROM public.uae_tax_entities e WHERE e.id = uae_vat_recovery.tax_entity_id
          AND (public.is_super_admin() OR public.can_access_country(e.country_id))));

GRANT SELECT, INSERT, UPDATE ON public.uae_vat_returns      TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uae_vat_return_lines TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.uae_vat_recovery     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_vat_box_for_line       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_vat_return_preview     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_generate_vat_return    TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260904_uae_vat_return', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
