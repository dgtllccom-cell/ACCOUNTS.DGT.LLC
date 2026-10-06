-- =============================================================================
-- UAE TAX, VAT & E-INVOICING — FOUNDATION (Phase 1)
-- Migration: 20260901_uae_tax_einvoicing_foundation.sql
--
-- PURPOSE:
--   Creates the UAE tax backbone. This layer NEVER copies accounting data —
--   every taxable line REFERENCES an existing ERP transaction (expenses bill,
--   local purchase, purchase/sales order, ...) exactly like the settlement
--   layer references roznamcha/purchase/sales. Amounts captured on uae_tax_lines
--   are the VAT breakdown of the referenced source line only; the full bill and
--   its accounting posting remain untouched in their own modules.
--
--   UAE only. All rows are scoped to a uae_tax_entities row (one TRN-holding
--   legal entity) which in turn owns a configurable set of country/city
--   branches. Reporting rolls up to the entity; branch detail is always kept.
--
-- TABLES:
--   1. uae_tax_entities         — TRN-holding legal tax entity
--   2. uae_tax_entity_branches  — which branches roll up to which entity
--   3. uae_tax_rules            — versioned FTA/MoF regulatory config (rates, categories, ...)
--   4. uae_designated_zones     — configurable Designated / Free Zone master
--   5. uae_tax_periods          — filing periods per entity (configurable frequency)
--   6. uae_tax_ledgers          — maps VAT control ledgers to an entity (used from Phase 5)
--   7. uae_tax_lines            — THE CORE: one row per taxable source line (empty until Phase 2)
--
-- VIEWS:
--   8. uae_tax_lines_v          — uae_tax_lines joined to scope/party/period names
--   9. uae_tax_entity_scope_v   — flattened entity -> country/branch scope resolution
--
-- FUNCTIONS:
--  10. uae_resolve_tax_entity(country_branch_id, city_branch_id) -> uuid
--  11. get_uae_tax_dashboard_kpis(tax_entity_id, period_id, from, to) -> control-center KPIs
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. uae_tax_entities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_tax_entities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  country_id          UUID NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  company_id          UUID REFERENCES public.companies(id) ON DELETE SET NULL,

  trn                 TEXT NOT NULL,                 -- 15-digit UAE Tax Registration Number
  legal_name          TEXT NOT NULL,
  registered_name     TEXT,                          -- trade / registered name if different
  registration_date   DATE,

  filing_frequency    TEXT NOT NULL DEFAULT 'quarterly'
                        CHECK (filing_frequency IN ('monthly', 'quarterly')),
  first_period_start   DATE,                         -- anchor for period generation
  base_currency       TEXT NOT NULL DEFAULT 'AED',

  -- Contact / print block (used on tax invoices; falls back to company/brand settings)
  address             TEXT,
  phone               TEXT,
  email               TEXT,

  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to        DATE,

  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uae_tax_entities_trn_idx
  ON public.uae_tax_entities (trn)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS uae_tax_entities_country_idx
  ON public.uae_tax_entities (country_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.uae_tax_entities IS
  'A single TRN-holding UAE legal tax entity. Branches roll up to it via
   uae_tax_entity_branches. UAE currently has one row; more can be added
   (group companies) without a schema change.';


-- ---------------------------------------------------------------------------
-- 2. uae_tax_entity_branches  — branch -> entity roll-up map
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_tax_entity_branches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_entity_id       UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE CASCADE,

  country_branch_id   UUID REFERENCES public.country_branches(id) ON DELETE CASCADE,
  city_branch_id      UUID REFERENCES public.city_branches(id) ON DELETE CASCADE,

  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT uae_tax_entity_branches_target_chk
    CHECK (country_branch_id IS NOT NULL OR city_branch_id IS NOT NULL)
);

-- A given branch maps to at most one entity
CREATE UNIQUE INDEX IF NOT EXISTS uae_tax_entity_branches_country_branch_idx
  ON public.uae_tax_entity_branches (country_branch_id)
  WHERE deleted_at IS NULL AND country_branch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uae_tax_entity_branches_city_branch_idx
  ON public.uae_tax_entity_branches (city_branch_id)
  WHERE deleted_at IS NULL AND city_branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS uae_tax_entity_branches_entity_idx
  ON public.uae_tax_entity_branches (tax_entity_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.uae_tax_entity_branches IS
  'Maps existing country_branches / city_branches to a UAE tax entity so that
   transactions from those branches are attributed to the correct TRN.';


-- ---------------------------------------------------------------------------
-- 3. uae_tax_rules  — versioned regulatory configuration
--    NOTHING regulatory is hard-coded in app code; it is read from here with
--    effective-date resolution.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_tax_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  rule_type           TEXT NOT NULL
                        CHECK (rule_type IN (
                          'rate', 'category', 'recoverability',
                          'designated_zone', 'place_of_supply',
                          'einvoice_validation', 'return_box_map', 'retention'
                        )),
  rule_key            TEXT NOT NULL,                 -- e.g. 'standard', 'zero_rated', 'box_1a'
  config              JSONB NOT NULL DEFAULT '{}'::JSONB,

  version             INTEGER NOT NULL DEFAULT 1,
  effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to        DATE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  source_reference    TEXT,                          -- FTA / MoF citation
  notes               TEXT,

  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS uae_tax_rules_lookup_idx
  ON public.uae_tax_rules (rule_type, rule_key, effective_from DESC)
  WHERE deleted_at IS NULL AND is_active = TRUE;

COMMENT ON TABLE public.uae_tax_rules IS
  'Versioned UAE tax rules (rates, categories, recoverability defaults, DZ flags,
   e-invoice validation, VAT-return box maps, retention). Resolved by
   rule_type + rule_key + effective date. Never hard-code these in app code.';


-- ---------------------------------------------------------------------------
-- 4. uae_designated_zones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_designated_zones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  zone_name           TEXT NOT NULL,
  emirate             TEXT,
  zone_type           TEXT NOT NULL DEFAULT 'free_zone'
                        CHECK (zone_type IN ('free_zone', 'designated_zone', 'mainland_special')),
  is_designated       BOOLEAN NOT NULL DEFAULT FALSE,  -- true = VAT Designated Zone (Cabinet Decision list)

  effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to        DATE,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'superseded')),

  source_reference    TEXT,
  notes               TEXT,

  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uae_designated_zones_name_idx
  ON public.uae_designated_zones (lower(zone_name))
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.uae_designated_zones IS
  'Configurable UAE Free Zone / Designated Zone master. A Free Zone is NOT
   automatically a VAT Designated Zone — is_designated must be set explicitly
   per the Cabinet Decision list, with effective dates.';


-- ---------------------------------------------------------------------------
-- 5. uae_tax_periods
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_tax_periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_entity_id       UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE CASCADE,

  period_code         TEXT NOT NULL,                 -- '2026-Q3' | '2026-08'
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,

  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closing', 'filed', 'amended')),
  filed_return_id     UUID,                          -- FK added in the VAT-return migration (Phase 4)
  filed_at            TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT uae_tax_periods_range_chk CHECK (period_end >= period_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS uae_tax_periods_entity_code_idx
  ON public.uae_tax_periods (tax_entity_id, period_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS uae_tax_periods_entity_range_idx
  ON public.uae_tax_periods (tax_entity_id, period_start DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.uae_tax_periods IS
  'Filing periods per entity. Frequency is configurable (monthly/quarterly on
   the entity) — never hard-coded to 3 months.';


-- ---------------------------------------------------------------------------
-- 6. uae_tax_ledgers  — VAT control ledger mapping (consumed from Phase 5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_tax_ledgers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_entity_id       UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE CASCADE,
  ledger_id           UUID NOT NULL REFERENCES public.ledgers(id) ON DELETE RESTRICT,

  role                TEXT NOT NULL
                        CHECK (role IN (
                          'input_recoverable', 'input_non_recoverable',
                          'output_payable', 'reverse_charge', 'refund_receivable'
                        )),

  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uae_tax_ledgers_entity_role_idx
  ON public.uae_tax_ledgers (tax_entity_id, role)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.uae_tax_ledgers IS
  'Maps a UAE tax entity to its dedicated VAT control ledgers. Used from Phase 5
   to post Input/Output VAT lines into the existing roznamcha entry.';


-- ---------------------------------------------------------------------------
-- 7. uae_tax_lines  — THE CORE
--    One row per taxable line of an existing ERP transaction. Populated by the
--    sync functions in Phase 2. No row here ever replaces or edits the source.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uae_tax_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tax_entity_id         UUID NOT NULL REFERENCES public.uae_tax_entities(id) ON DELETE RESTRICT,
  country_id            UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id     UUID REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id        UUID REFERENCES public.city_branches(id) ON DELETE SET NULL,
  entered_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Source reference — always points back to the ORIGINAL record + line
  source_module         TEXT NOT NULL
                          CHECK (source_module IN (
                            'expenses_bill', 'local_purchase', 'local_sale',
                            'purchase_order', 'sales_order',
                            'import', 'export', 're_export',
                            'credit_note', 'own_goods_transfer', 'stock_transfer', 'other'
                          )),
  source_table          TEXT NOT NULL,
  source_id             UUID NOT NULL,
  source_line_id        UUID,                        -- null when the source is single-line
  source_reference_no   TEXT,                        -- bill / invoice number
  source_date           DATE NOT NULL,

  -- Classification
  direction             TEXT NOT NULL CHECK (direction IN ('input', 'output')),
  transaction_category  TEXT NOT NULL DEFAULT 'other'
                          CHECK (transaction_category IN (
                            'daily_expense', 'local_purchase', 'local_sale',
                            'booking_purchase', 'booking_sale',
                            'import', 'export', 're_export',
                            'free_zone', 'designated_zone',
                            'own_goods_transfer', 'stock_transfer', 'other'
                          )),
  tax_category           TEXT NOT NULL DEFAULT 'standard'
                          CHECK (tax_category IN (
                            'standard', 'zero_rated', 'exempt',
                            'reverse_charge', 'out_of_scope', 'deemed_supply'
                          )),

  -- Party / description (denormalized for search — not an accounting copy)
  party_name            TEXT,
  party_trn             TEXT,
  account_name          TEXT,
  description           TEXT,

  -- VAT breakdown of THIS source line (transaction currency)
  line_amount           NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_code_id           UUID REFERENCES public.tax_codes(id) ON DELETE SET NULL,
  vat_rate              NUMERIC(9,4) NOT NULL DEFAULT 0,
  taxable_amount        NUMERIC(18,4) NOT NULL DEFAULT 0,
  vat_amount            NUMERIC(18,4) NOT NULL DEFAULT 0,

  recoverability        TEXT NOT NULL DEFAULT 'pending_review'
                          CHECK (recoverability IN (
                            'recoverable', 'partial', 'non_recoverable', 'pending_review'
                          )),
  recoverable_amount    NUMERIC(18,4) NOT NULL DEFAULT 0,

  -- Currency + AED equivalent (filing currency)
  currency              TEXT NOT NULL DEFAULT 'AED',
  exchange_rate         NUMERIC(18,8) NOT NULL DEFAULT 1,
  aed_taxable_amount    NUMERIC(18,4) NOT NULL DEFAULT 0,
  aed_vat_amount        NUMERIC(18,4) NOT NULL DEFAULT 0,

  -- Accounting trace (references only)
  roznamcha_entry_id    UUID REFERENCES public.roznamcha_entries(id) ON DELETE SET NULL,
  journal_reference     TEXT,
  ledger_reference      TEXT,

  -- Period + return
  tax_period_id         UUID REFERENCES public.uae_tax_periods(id) ON DELETE SET NULL,
  vat_return_box        TEXT,
  vat_return_id         UUID,                        -- FK added Phase 4

  -- Evidence
  document_status       TEXT NOT NULL DEFAULT 'missing'
                          CHECK (document_status IN (
                            'complete', 'missing', 'pending', 'invalid',
                            'review_required', 'ready'
                          )),
  evidence_document_id  UUID REFERENCES public.office_documents(id) ON DELETE SET NULL,

  -- Lifecycle
  review_status         TEXT NOT NULL DEFAULT 'auto'
                          CHECK (review_status IN ('auto', 'confirmed', 'needs_review', 'excluded')),
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- Hard guarantee: the same source line can never be VAT-reported twice
CREATE UNIQUE INDEX IF NOT EXISTS uae_tax_lines_source_unique_idx
  ON public.uae_tax_lines
     (source_module, source_id, COALESCE(source_line_id, source_id))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS uae_tax_lines_entity_period_idx
  ON public.uae_tax_lines (tax_entity_id, tax_period_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS uae_tax_lines_entity_date_idx
  ON public.uae_tax_lines (tax_entity_id, source_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS uae_tax_lines_direction_category_idx
  ON public.uae_tax_lines (direction, transaction_category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS uae_tax_lines_doc_status_idx
  ON public.uae_tax_lines (document_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS uae_tax_lines_country_branch_idx
  ON public.uae_tax_lines (country_id, city_branch_id, source_date DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.uae_tax_lines IS
  'One row per taxable line of an existing ERP transaction. Amounts are the VAT
   breakdown of the referenced source line only. source_module + source_id +
   source_line_id always point back to the original record, which is never
   modified. Unique on the source key -> no duplicate VAT reporting.';


-- ---------------------------------------------------------------------------
-- 8. VIEW: uae_tax_entity_scope_v  — flattened entity -> branch scope
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.uae_tax_entity_scope_v AS
SELECT
  e.id                       AS tax_entity_id,
  e.trn,
  e.legal_name,
  e.country_id,
  eb.country_branch_id,
  eb.city_branch_id,
  cb.name                    AS country_branch_name,
  cib.name                   AS city_branch_name
FROM public.uae_tax_entities e
LEFT JOIN public.uae_tax_entity_branches eb
  ON eb.tax_entity_id = e.id AND eb.deleted_at IS NULL
LEFT JOIN public.country_branches cb ON cb.id = eb.country_branch_id
LEFT JOIN public.city_branches   cib ON cib.id = eb.city_branch_id
WHERE e.deleted_at IS NULL;

GRANT SELECT ON public.uae_tax_entity_scope_v TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 9. VIEW: uae_tax_lines_v  — joined for the list/report grid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.uae_tax_lines_v AS
SELECT
  tl.*,
  e.trn                      AS tax_entity_trn,
  e.legal_name               AS tax_entity_name,
  co.name                    AS country_name,
  cb.name                    AS country_branch_name,
  cib.name                   AS city_branch_name,
  tp.period_code             AS tax_period_code,
  tc.tax_name                AS tax_code_name,
  pr.full_name               AS entered_by_name
FROM public.uae_tax_lines tl
LEFT JOIN public.uae_tax_entities e   ON e.id = tl.tax_entity_id
LEFT JOIN public.countries co         ON co.id = tl.country_id
LEFT JOIN public.country_branches cb  ON cb.id = tl.country_branch_id
LEFT JOIN public.city_branches cib    ON cib.id = tl.city_branch_id
LEFT JOIN public.uae_tax_periods tp   ON tp.id = tl.tax_period_id
LEFT JOIN public.tax_codes tc         ON tc.id = tl.tax_code_id
LEFT JOIN public.profiles pr          ON pr.id = tl.entered_by
WHERE tl.deleted_at IS NULL;

GRANT SELECT ON public.uae_tax_lines_v TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 10. FUNCTION: uae_resolve_tax_entity(country_branch_id, city_branch_id)
--     Resolves which UAE tax entity a branch belongs to. City branch wins;
--     falls back to its parent country branch; then to the single active
--     UAE entity if the map is not yet populated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uae_resolve_tax_entity(
  p_country_branch_id UUID DEFAULT NULL,
  p_city_branch_id    UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_entity UUID;
  v_parent_cb UUID;
BEGIN
  IF p_city_branch_id IS NOT NULL THEN
    SELECT tax_entity_id INTO v_entity
    FROM public.uae_tax_entity_branches
    WHERE city_branch_id = p_city_branch_id AND deleted_at IS NULL
    LIMIT 1;
    IF v_entity IS NOT NULL THEN RETURN v_entity; END IF;

    SELECT country_branch_id INTO v_parent_cb
    FROM public.city_branches WHERE id = p_city_branch_id;
  END IF;

  v_parent_cb := COALESCE(p_country_branch_id, v_parent_cb);

  IF v_parent_cb IS NOT NULL THEN
    SELECT tax_entity_id INTO v_entity
    FROM public.uae_tax_entity_branches
    WHERE country_branch_id = v_parent_cb AND deleted_at IS NULL
    LIMIT 1;
    IF v_entity IS NOT NULL THEN RETURN v_entity; END IF;
  END IF;

  -- Fallback: the single active UAE entity (branch map not yet configured)
  SELECT e.id INTO v_entity
  FROM public.uae_tax_entities e
  JOIN public.countries c ON c.id = e.country_id
  WHERE e.deleted_at IS NULL
    AND e.is_active = TRUE
    AND upper(c.iso2) = 'AE'
  ORDER BY e.created_at
  LIMIT 1;

  RETURN v_entity;
END;
$$;


-- ---------------------------------------------------------------------------
-- 11. FUNCTION: get_uae_tax_dashboard_kpis
--     Control-Center card numbers. Reads only uae_tax_lines (Phase 2+ fills it).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_uae_tax_dashboard_kpis(
  p_tax_entity_id UUID DEFAULT NULL,
  p_period_id     UUID DEFAULT NULL,
  p_from_date     DATE DEFAULT NULL,
  p_to_date       DATE DEFAULT NULL
)
RETURNS TABLE (
  output_taxable_aed        NUMERIC,
  output_vat_aed            NUMERIC,
  output_zero_rated_aed     NUMERIC,
  output_exempt_aed         NUMERIC,
  input_taxable_aed         NUMERIC,
  input_vat_aed             NUMERIC,
  input_recoverable_aed     NUMERIC,
  input_non_recoverable_aed NUMERIC,
  expense_vat_aed           NUMERIC,
  import_vat_aed            NUMERIC,
  export_aed                NUMERIC,
  re_export_aed             NUMERIC,
  net_vat_aed               NUMERIC,
  lines_total               BIGINT,
  lines_missing_document    BIGINT,
  lines_needs_review        BIGINT,
  lines_pending_recovery    BIGINT
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN direction = 'output' THEN aed_taxable_amount END), 0),
    COALESCE(SUM(CASE WHEN direction = 'output' THEN aed_vat_amount END), 0),
    COALESCE(SUM(CASE WHEN direction = 'output' AND tax_category = 'zero_rated' THEN aed_taxable_amount END), 0),
    COALESCE(SUM(CASE WHEN direction = 'output' AND tax_category = 'exempt' THEN aed_taxable_amount END), 0),
    COALESCE(SUM(CASE WHEN direction = 'input' THEN aed_taxable_amount END), 0),
    COALESCE(SUM(CASE WHEN direction = 'input' THEN aed_vat_amount END), 0),
    COALESCE(SUM(CASE WHEN direction = 'input' AND recoverability IN ('recoverable','partial') THEN recoverable_amount * exchange_rate END), 0),
    COALESCE(SUM(CASE WHEN direction = 'input' AND recoverability = 'non_recoverable' THEN aed_vat_amount END), 0),
    COALESCE(SUM(CASE WHEN transaction_category = 'daily_expense' THEN aed_vat_amount END), 0),
    COALESCE(SUM(CASE WHEN transaction_category = 'import' THEN aed_vat_amount END), 0),
    COALESCE(SUM(CASE WHEN transaction_category = 'export' THEN aed_taxable_amount END), 0),
    COALESCE(SUM(CASE WHEN transaction_category = 're_export' THEN aed_taxable_amount END), 0),
    COALESCE(SUM(CASE WHEN direction = 'output' THEN aed_vat_amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN direction = 'input' AND recoverability IN ('recoverable','partial') THEN aed_vat_amount ELSE 0 END), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE document_status = 'missing'),
    COUNT(*) FILTER (WHERE review_status = 'needs_review'),
    COUNT(*) FILTER (WHERE direction = 'input' AND recoverability = 'pending_review')
  FROM public.uae_tax_lines
  WHERE deleted_at IS NULL
    AND (p_tax_entity_id IS NULL OR tax_entity_id = p_tax_entity_id)
    AND (p_period_id     IS NULL OR tax_period_id = p_period_id)
    AND (p_from_date     IS NULL OR source_date >= p_from_date)
    AND (p_to_date       IS NULL OR source_date <= p_to_date);
$$;


-- ---------------------------------------------------------------------------
-- 12. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.uae_tax_entities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_tax_entity_branches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_tax_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_designated_zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_tax_periods          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_tax_ledgers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uae_tax_lines            ENABLE ROW LEVEL SECURITY;

-- Entities / config: super admin OR country access to the entity's country
DROP POLICY IF EXISTS uae_tax_entities_rw ON public.uae_tax_entities;
CREATE POLICY uae_tax_entities_rw ON public.uae_tax_entities
  FOR ALL USING (
    public.is_super_admin()
    OR (country_id IS NOT NULL AND public.can_access_country(country_id))
  );

DROP POLICY IF EXISTS uae_tax_entity_branches_rw ON public.uae_tax_entity_branches;
CREATE POLICY uae_tax_entity_branches_rw ON public.uae_tax_entity_branches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.uae_tax_entities e
      WHERE e.id = uae_tax_entity_branches.tax_entity_id
        AND (public.is_super_admin() OR public.can_access_country(e.country_id))
    )
  );

-- Regulatory config: readable by any authenticated user, writable by super admin
DROP POLICY IF EXISTS uae_tax_rules_read ON public.uae_tax_rules;
CREATE POLICY uae_tax_rules_read ON public.uae_tax_rules
  FOR SELECT USING (true);
DROP POLICY IF EXISTS uae_tax_rules_write ON public.uae_tax_rules;
CREATE POLICY uae_tax_rules_write ON public.uae_tax_rules
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS uae_designated_zones_read ON public.uae_designated_zones;
CREATE POLICY uae_designated_zones_read ON public.uae_designated_zones
  FOR SELECT USING (true);
DROP POLICY IF EXISTS uae_designated_zones_write ON public.uae_designated_zones;
CREATE POLICY uae_designated_zones_write ON public.uae_designated_zones
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Periods / ledgers / lines: scoped through the parent entity's country
DROP POLICY IF EXISTS uae_tax_periods_rw ON public.uae_tax_periods;
CREATE POLICY uae_tax_periods_rw ON public.uae_tax_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.uae_tax_entities e
      WHERE e.id = uae_tax_periods.tax_entity_id
        AND (public.is_super_admin() OR public.can_access_country(e.country_id))
    )
  );

DROP POLICY IF EXISTS uae_tax_ledgers_rw ON public.uae_tax_ledgers;
CREATE POLICY uae_tax_ledgers_rw ON public.uae_tax_ledgers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.uae_tax_entities e
      WHERE e.id = uae_tax_ledgers.tax_entity_id
        AND (public.is_super_admin() OR public.can_access_country(e.country_id))
    )
  );

DROP POLICY IF EXISTS uae_tax_lines_read ON public.uae_tax_lines;
CREATE POLICY uae_tax_lines_read ON public.uae_tax_lines
  FOR SELECT USING (
    public.is_super_admin()
    OR (country_id IS NOT NULL AND public.can_access_country(country_id))
  );
DROP POLICY IF EXISTS uae_tax_lines_write ON public.uae_tax_lines;
CREATE POLICY uae_tax_lines_write ON public.uae_tax_lines
  FOR ALL USING (
    public.is_super_admin()
    OR (country_id IS NOT NULL AND public.can_access_country(country_id))
  );


-- ---------------------------------------------------------------------------
-- 13. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.uae_tax_entities        TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.uae_tax_entity_branches TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.uae_tax_rules           TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.uae_designated_zones    TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.uae_tax_periods         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.uae_tax_ledgers         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.uae_tax_lines           TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.uae_resolve_tax_entity        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_uae_tax_dashboard_kpis    TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 14. Seed — baseline UAE regulatory config (versioned, effective 2018-01-01)
--     These are starting values; authorised users maintain them in UAE Tax Settings.
-- ---------------------------------------------------------------------------
INSERT INTO public.uae_tax_rules (rule_type, rule_key, config, effective_from, source_reference)
VALUES
  ('rate', 'standard',   '{"rate": 5, "label": "Standard-rated 5%"}'::jsonb, DATE '2018-01-01', 'FTA VAT — Federal Decree-Law No. 8 of 2017'),
  ('rate', 'zero_rated', '{"rate": 0, "label": "Zero-rated"}'::jsonb,        DATE '2018-01-01', 'FTA VAT — Article 45'),
  ('rate', 'exempt',     '{"rate": 0, "label": "Exempt"}'::jsonb,            DATE '2018-01-01', 'FTA VAT — Article 46'),
  ('recoverability', 'blocked_entertainment', '{"recoverability": "non_recoverable", "reason": "Entertainment expenses"}'::jsonb, DATE '2018-01-01', 'FTA VAT — Article 53'),
  ('recoverability', 'blocked_motor_vehicle', '{"recoverability": "non_recoverable", "reason": "Motor vehicles available for personal use"}'::jsonb, DATE '2018-01-01', 'FTA VAT — Article 53'),
  ('return_box_map', 'defaults', '{"standard_output":"1a","zero_output":"4","exempt_output":"5","reverse_charge":"3","standard_input":"9","import_vat":"6"}'::jsonb, DATE '2018-01-01', 'FTA VAT 201 return form')
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------------
-- 15. Migration tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.erp_schema_migrations (
  name       TEXT PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260901_uae_tax_einvoicing_foundation', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
