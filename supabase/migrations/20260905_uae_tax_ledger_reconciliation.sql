-- =============================================================================
-- UAE TAX — PHASE 5: VAT CONTROL LEDGERS & RECONCILIATION
-- Migration: 20260905_uae_tax_ledger_reconciliation.sql
--
-- "Tax-layer first" (per the approved plan): VAT is captured on uae_tax_lines and
-- reconciled each period against dedicated VAT control ledgers. The actual
-- period summary posting is done from the service layer via the existing
-- postRoznamchaWithErpSession path (never reinvented in SQL). This migration:
--   - uae_tax_bootstrap_ledgers(entity)  : create the 5 control ledgers
--   - uae_vat_postings                   : period VAT summary posting proposals
--   - uae_tax_reconciliation_v           : tax-line VAT vs ledger balance
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.uae_vat_postings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_entity_id     UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE CASCADE,
  tax_period_id     UUID NOT NULL REFERENCES public.uae_tax_periods(id) ON DELETE CASCADE,
  vat_return_id     UUID REFERENCES public.uae_vat_returns(id) ON DELETE SET NULL,

  status            TEXT NOT NULL DEFAULT 'proposed'
                      CHECK (status IN ('proposed', 'posted', 'reversed', 'skipped')),
  output_vat_aed    NUMERIC(18,2) NOT NULL DEFAULT 0,
  input_vat_aed     NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_vat_aed       NUMERIC(18,2) NOT NULL DEFAULT 0,

  roznamcha_entry_id UUID REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL,
  posted_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at         TIMESTAMPTZ,
  notes             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uae_vat_postings_period_idx
  ON public.uae_vat_postings (tax_period_id) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- Create the 5 VAT control ledgers for an entity (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_tax_bootstrap_ledgers(p_tax_entity_id UUID, p_actor UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_country UUID;
  v_made INTEGER := 0;
  r RECORD;
  v_ledger UUID;
BEGIN
  SELECT country_id INTO v_country FROM public.uae_tax_entities WHERE id = p_tax_entity_id;
  IF v_country IS NULL THEN RAISE EXCEPTION 'Unknown tax entity %', p_tax_entity_id; END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('input_recoverable',     'UAE-VAT-INPUT-REC',  'UAE Input VAT — Recoverable'),
      ('input_non_recoverable', 'UAE-VAT-INPUT-NREC', 'UAE Input VAT — Non-Recoverable (Expense)'),
      ('output_payable',        'UAE-VAT-OUTPUT',     'UAE Output VAT — Payable'),
      ('reverse_charge',        'UAE-VAT-RCM',        'UAE VAT — Reverse Charge'),
      ('refund_receivable',     'UAE-VAT-REFUND',     'UAE VAT — Refund Receivable')
    ) AS t(role, code, name)
  LOOP
    IF EXISTS (SELECT 1 FROM public.uae_tax_ledgers
               WHERE tax_entity_id = p_tax_entity_id AND role = r.role AND deleted_at IS NULL) THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_ledger FROM public.ledgers
    WHERE scope = 'country' AND country_id = v_country AND code = r.code AND deleted_at IS NULL;

    IF v_ledger IS NULL THEN
      INSERT INTO public.ledgers (scope, country_id, code, name, currency, created_by)
      VALUES ('country', v_country, r.code, r.name, 'AED', p_actor)
      RETURNING id INTO v_ledger;
    END IF;

    INSERT INTO public.uae_tax_ledgers (tax_entity_id, ledger_id, role, created_by)
    VALUES (p_tax_entity_id, v_ledger, r.role, p_actor)
    ON CONFLICT (tax_entity_id, role) WHERE deleted_at IS NULL DO NOTHING;

    v_made := v_made + 1;
  END LOOP;

  RETURN v_made;
END;
$$;


-- ---------------------------------------------------------------------------
-- Propose the period VAT summary posting (service layer executes it)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_propose_period_vat_posting(p_period_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entity UUID; v_row UUID; p RECORD;
BEGIN
  SELECT tax_entity_id INTO v_entity FROM public.uae_tax_periods WHERE id = p_period_id;
  IF v_entity IS NULL THEN RAISE EXCEPTION 'Unknown period %', p_period_id; END IF;

  SELECT * INTO p FROM public.uae_vat_return_preview(p_period_id);

  INSERT INTO public.uae_vat_postings (tax_entity_id, tax_period_id, output_vat_aed, input_vat_aed, net_vat_aed)
  VALUES (v_entity, p_period_id, p.box8_total_output_vat, p.box11_total_input_vat, p.box12_net_vat)
  ON CONFLICT (tax_period_id) WHERE deleted_at IS NULL
  DO UPDATE SET output_vat_aed = EXCLUDED.output_vat_aed,
                input_vat_aed  = EXCLUDED.input_vat_aed,
                net_vat_aed    = EXCLUDED.net_vat_aed,
                updated_at = NOW()
  RETURNING id INTO v_row;

  IF v_row IS NULL THEN
    SELECT id INTO v_row FROM public.uae_vat_postings WHERE tax_period_id = p_period_id AND deleted_at IS NULL;
  END IF;
  RETURN v_row;
END;
$$;


-- ---------------------------------------------------------------------------
-- Reconciliation view — tax-line VAT vs control-ledger balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.uae_tax_reconciliation_v AS
WITH line_totals AS (
  SELECT tax_entity_id,
         SUM(aed_vat_amount) FILTER (WHERE direction = 'output') AS output_vat,
         SUM(aed_vat_amount) FILTER (WHERE direction = 'input' AND recoverability IN ('recoverable','partial')) AS input_recoverable_vat,
         SUM(aed_vat_amount) FILTER (WHERE direction = 'input' AND recoverability = 'non_recoverable') AS input_non_recoverable_vat
  FROM public.uae_tax_lines WHERE deleted_at IS NULL
  GROUP BY tax_entity_id
),
ledger_totals AS (
  SELECT tl.tax_entity_id, tl.role, l.current_balance
  FROM public.uae_tax_ledgers tl
  JOIN public.ledgers l ON l.id = tl.ledger_id
  WHERE tl.deleted_at IS NULL
)
SELECT
  e.id                       AS tax_entity_id,
  e.legal_name               AS tax_entity_name,
  COALESCE(lt.output_vat, 0)               AS lines_output_vat_aed,
  COALESCE(lt.input_recoverable_vat, 0)    AS lines_input_recoverable_vat_aed,
  COALESCE(lt.input_non_recoverable_vat,0) AS lines_input_non_recoverable_vat_aed,
  COALESCE((SELECT current_balance FROM ledger_totals WHERE tax_entity_id = e.id AND role = 'output_payable'), 0)     AS ledger_output_payable_aed,
  COALESCE((SELECT current_balance FROM ledger_totals WHERE tax_entity_id = e.id AND role = 'input_recoverable'), 0)  AS ledger_input_recoverable_aed,
  COALESCE(lt.output_vat, 0)
    - COALESCE((SELECT current_balance FROM ledger_totals WHERE tax_entity_id = e.id AND role = 'output_payable'), 0)  AS output_variance_aed,
  COALESCE(lt.input_recoverable_vat, 0)
    - COALESCE((SELECT current_balance FROM ledger_totals WHERE tax_entity_id = e.id AND role = 'input_recoverable'), 0) AS input_variance_aed
FROM public.uae_tax_entities e
LEFT JOIN line_totals lt ON lt.tax_entity_id = e.id
WHERE e.deleted_at IS NULL;

GRANT SELECT ON public.uae_tax_reconciliation_v TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.uae_vat_postings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uae_vat_postings_rw ON public.uae_vat_postings;
CREATE POLICY uae_vat_postings_rw ON public.uae_vat_postings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.uae_tax_entities e WHERE e.id = uae_vat_postings.tax_entity_id
          AND (public.is_super_admin() OR public.can_access_country(e.country_id))));

GRANT SELECT, INSERT, UPDATE ON public.uae_vat_postings          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_tax_bootstrap_ledgers       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.uae_propose_period_vat_posting  TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260905_uae_tax_ledger_reconciliation', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
