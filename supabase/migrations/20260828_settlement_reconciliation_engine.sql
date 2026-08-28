-- =============================================================================
-- SETTLEMENT & RECONCILIATION ENGINE
-- Migration: 20260828_settlement_reconciliation_engine.sql
--
-- PURPOSE:
--   Creates the settlement layer that links existing ERP transactions
--   (roznamcha, purchase, sales, bank, cash, payments, expenses) without
--   duplicating any accounting data. All financial amounts are read at
--   query time from the original source tables.
--
-- TABLES:
--   1. settlement_transactions  — reference registry (FK to original records)
--   2. settlement_links         — CR→DR many-to-many matching with FX analysis
--   3. settlement_audit_log     — immutable audit trail
--
-- VIEWS:
--   4. settlement_summary_v     — per-branch daily/period aggregates
--   5. settlement_exceptions_v  — auto-detected anomalies & flags
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. settlement_transactions
--    One row per original ERP transaction pulled into the settlement center.
--    No accounting amounts are stored here — only references + settlement state.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope (mirrors existing ERP scoping pattern)
  country_id            UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id     UUID REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id        UUID REFERENCES public.city_branches(id) ON DELETE SET NULL,

  -- Source reference — points to the ORIGINAL ERP record
  source_module         TEXT NOT NULL,
    -- 'cash_entry' | 'bank_entry' | 'roznamcha' | 'purchase' | 'purchase_payment'
    -- | 'sales' | 'sales_payment' | 'expense' | 'bank_cheque' | 'money_exchange'
    -- | 'inter_country_transfer' | 'payment' | 'local_purchase' | 'journal'
  source_table          TEXT NOT NULL,   -- actual postgres table name
  source_id             UUID NOT NULL,   -- FK value to original record
  source_reference_no   TEXT,            -- human-readable serial/reference
  source_date           DATE NOT NULL,

  -- Direction & type
  direction             TEXT NOT NULL CHECK (direction IN ('cr', 'dr')),
  settlement_type       TEXT NOT NULL DEFAULT 'other',
    -- 'cash' | 'bank' | 'cheque' | 'purchase_payment' | 'sales_receipt'
    -- | 'expense_payment' | 'fx_adjustment' | 'transfer' | 'other'

  -- Financial — captured at sync time, NEVER overwritten
  local_currency        TEXT NOT NULL DEFAULT 'PKR',
  local_amount          NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (local_amount >= 0),
  original_usd_rate     NUMERIC(18,8) NOT NULL DEFAULT 1 CHECK (original_usd_rate > 0),
  original_usd_amount   NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (original_usd_amount >= 0),

  -- Settlement state
  settlement_status     TEXT NOT NULL DEFAULT 'unsettled'
    CHECK (settlement_status IN ('settled','partially_settled','unsettled','difference','needs_review')),
  settled_local_amount  NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (settled_local_amount >= 0),
  settled_usd_amount    NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (settled_usd_amount >= 0),
  remaining_local       NUMERIC(18,4) GENERATED ALWAYS AS
                          (local_amount - settled_local_amount) STORED,
  remaining_usd         NUMERIC(18,4) GENERATED ALWAYS AS
                          (original_usd_amount - settled_usd_amount) STORED,

  -- Party / account info (denormalized for fast search — not an accounting copy)
  party_name            TEXT,
  party_account_no      TEXT,
  narration             TEXT,

  -- Exception flags
  is_flagged            BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason           TEXT,
  reviewed_by           UUID REFERENCES public.profiles(id),
  reviewed_at           TIMESTAMPTZ,

  -- Audit
  synced_by             UUID REFERENCES public.profiles(id),
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- Prevent duplicate sync entries
CREATE UNIQUE INDEX IF NOT EXISTS settlement_transactions_source_unique_idx
  ON public.settlement_transactions (source_table, source_id)
  WHERE deleted_at IS NULL;

-- Fast lookup by scope + date
CREATE INDEX IF NOT EXISTS settlement_transactions_country_date_idx
  ON public.settlement_transactions (country_id, source_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS settlement_transactions_branch_date_idx
  ON public.settlement_transactions (city_branch_id, source_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS settlement_transactions_status_idx
  ON public.settlement_transactions (settlement_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS settlement_transactions_direction_idx
  ON public.settlement_transactions (direction, settlement_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS settlement_transactions_party_idx
  ON public.settlement_transactions (party_account_no)
  WHERE deleted_at IS NULL AND party_account_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS settlement_transactions_module_idx
  ON public.settlement_transactions (source_module, source_date DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.settlement_transactions IS
  'Reference registry linking original ERP transactions to the settlement layer.
   No accounting data is copied — amounts are captured at sync time for status tracking only.
   source_table + source_id always point back to the original ERP record.';


-- ---------------------------------------------------------------------------
-- 2. settlement_links
--    CR → DR many-to-many matching table with FX gain/loss analysis.
--    One CR can be linked to many DRs; remaining balance auto-computed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The CR settlement record being drawn down
  cr_settlement_id      UUID NOT NULL REFERENCES public.settlement_transactions(id)
                          ON DELETE RESTRICT,
  -- The DR settlement record that settles against the CR
  dr_settlement_id      UUID NOT NULL REFERENCES public.settlement_transactions(id)
                          ON DELETE RESTRICT,

  -- Matched amounts in both currencies
  linked_local_amount   NUMERIC(18,4) NOT NULL CHECK (linked_local_amount > 0),
  linked_usd_amount     NUMERIC(18,4) NOT NULL CHECK (linked_usd_amount > 0),

  -- FX analysis: permanently preserved rates at settlement time
  cr_usd_rate           NUMERIC(18,8) NOT NULL,   -- original CR transaction rate
  dr_usd_rate           NUMERIC(18,8) NOT NULL,   -- DR/settlement transaction rate
  fx_difference_local   NUMERIC(18,4) NOT NULL DEFAULT 0,  -- in local currency
  fx_difference_usd     NUMERIC(18,4) NOT NULL DEFAULT 0,  -- positive = gain, negative = loss
  fx_direction          TEXT NOT NULL DEFAULT 'neutral'
                          CHECK (fx_direction IN ('gain','loss','neutral')),

  -- Who/when/why
  settlement_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  settled_by            UUID REFERENCES public.profiles(id),
  remarks               TEXT,
  is_auto_matched       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE if auto-suggested by engine

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- A single CR-DR pair should only be linked once (no duplicate links)
CREATE UNIQUE INDEX IF NOT EXISTS settlement_links_pair_unique_idx
  ON public.settlement_links (cr_settlement_id, dr_settlement_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS settlement_links_cr_idx
  ON public.settlement_links (cr_settlement_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS settlement_links_dr_idx
  ON public.settlement_links (dr_settlement_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS settlement_links_date_idx
  ON public.settlement_links (settlement_date DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.settlement_links IS
  'CR→DR many-to-many settlement matching. Each row represents one portion of a CR
   being offset against a DR. FX rates are permanently captured at settlement time.
   fx_difference_usd: positive = ERP gain, negative = ERP loss.';


-- ---------------------------------------------------------------------------
-- 3. settlement_audit_log
--    Immutable record of every settlement action. NEVER updated or deleted.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id     UUID REFERENCES public.settlement_transactions(id) ON DELETE SET NULL,
  link_id           UUID REFERENCES public.settlement_links(id) ON DELETE SET NULL,
  actor_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  country_id        UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  city_branch_id    UUID REFERENCES public.city_branches(id) ON DELETE SET NULL,

  -- Action details
  action            TEXT NOT NULL,
    -- 'synced' | 'linked' | 'unlinked' | 'status_changed' | 'flagged'
    -- | 'reviewed' | 'closed' | 'reopened' | 'fx_recalculated'
  previous_status   TEXT,
  new_status        TEXT,

  -- Financial snapshot at action time
  amount_involved   NUMERIC(18,4),
  currency          TEXT,
  usd_rate          NUMERIC(18,8),
  usd_amount        NUMERIC(18,4),
  fx_difference     NUMERIC(18,4),

  reason            TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address        TEXT,

  -- Immutable timestamp only
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at, no deleted_at — this table is append-only
);

CREATE INDEX IF NOT EXISTS settlement_audit_log_settlement_idx
  ON public.settlement_audit_log (settlement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS settlement_audit_log_actor_idx
  ON public.settlement_audit_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS settlement_audit_log_country_idx
  ON public.settlement_audit_log (country_id, created_at DESC);

CREATE INDEX IF NOT EXISTS settlement_audit_log_action_idx
  ON public.settlement_audit_log (action, created_at DESC);

COMMENT ON TABLE public.settlement_audit_log IS
  'Immutable append-only audit trail for all settlement actions.
   No rows are ever updated or deleted from this table.';


-- ---------------------------------------------------------------------------
-- 4. VIEW: settlement_summary_v
--    Aggregated per-branch view for dashboard and daily closing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.settlement_summary_v AS
SELECT
  st.country_id,
  co.name                                         AS country_name,
  co.currency_code                                AS country_currency,
  st.country_branch_id,
  cb.name                                         AS branch_name,
  st.city_branch_id,
  cib.name                                        AS city_branch_name,
  st.source_date                                  AS txn_date,
  st.local_currency,
  COUNT(*)                                        AS total_entries,
  SUM(CASE WHEN st.direction = 'cr' THEN st.local_amount   ELSE 0 END) AS total_cr_local,
  SUM(CASE WHEN st.direction = 'dr' THEN st.local_amount   ELSE 0 END) AS total_dr_local,
  SUM(CASE WHEN st.direction = 'cr' THEN st.original_usd_amount ELSE 0 END) AS total_cr_usd,
  SUM(CASE WHEN st.direction = 'dr' THEN st.original_usd_amount ELSE 0 END) AS total_dr_usd,
  SUM(CASE WHEN st.direction = 'cr' THEN st.remaining_local ELSE 0 END) AS remaining_cr_local,
  SUM(CASE WHEN st.direction = 'dr' THEN st.remaining_local ELSE 0 END) AS remaining_dr_local,
  SUM(CASE WHEN st.direction = 'cr' THEN st.remaining_usd   ELSE 0 END) AS remaining_cr_usd,
  SUM(CASE WHEN st.direction = 'dr' THEN st.remaining_usd   ELSE 0 END) AS remaining_dr_usd,
  COUNT(CASE WHEN st.settlement_status = 'settled'            THEN 1 END) AS count_settled,
  COUNT(CASE WHEN st.settlement_status = 'partially_settled'  THEN 1 END) AS count_partial,
  COUNT(CASE WHEN st.settlement_status = 'unsettled'          THEN 1 END) AS count_unsettled,
  COUNT(CASE WHEN st.settlement_status = 'needs_review'       THEN 1 END) AS count_review,
  COUNT(CASE WHEN st.is_flagged = TRUE                        THEN 1 END) AS count_flagged,
  -- FX totals from links
  COALESCE(SUM(CASE WHEN sl.fx_direction = 'gain' THEN sl.fx_difference_usd ELSE 0 END), 0) AS total_fx_gain_usd,
  COALESCE(SUM(CASE WHEN sl.fx_direction = 'loss' THEN ABS(sl.fx_difference_usd) ELSE 0 END), 0) AS total_fx_loss_usd
FROM public.settlement_transactions st
LEFT JOIN public.countries co ON co.id = st.country_id
LEFT JOIN public.country_branches cb ON cb.id = st.country_branch_id
LEFT JOIN public.city_branches cib ON cib.id = st.city_branch_id
LEFT JOIN public.settlement_links sl
  ON (sl.cr_settlement_id = st.id OR sl.dr_settlement_id = st.id)
  AND sl.deleted_at IS NULL
WHERE st.deleted_at IS NULL
GROUP BY
  st.country_id, co.name, co.currency_code,
  st.country_branch_id, cb.name,
  st.city_branch_id, cib.name,
  st.source_date, st.local_currency;

GRANT SELECT ON public.settlement_summary_v TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 5. VIEW: settlement_exceptions_v
--    Auto-detected anomalies — flags for review without modifying data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.settlement_exceptions_v AS
SELECT
  st.id,
  st.country_id,
  st.country_branch_id,
  st.city_branch_id,
  st.source_module,
  st.source_table,
  st.source_id,
  st.source_reference_no,
  st.source_date,
  st.direction,
  st.local_currency,
  st.local_amount,
  st.remaining_local,
  st.remaining_usd,
  st.settlement_status,
  st.party_name,
  st.party_account_no,
  st.is_flagged,
  st.flag_reason,
  -- Exception category (in order of priority)
  CASE
    WHEN st.settlement_status = 'unsettled'
      AND st.direction = 'cr'
      AND st.source_date < CURRENT_DATE - INTERVAL '30 days'
      THEN 'old_outstanding_cr'
    WHEN st.settlement_status = 'unsettled'
      AND st.direction = 'dr'
      AND st.source_date < CURRENT_DATE - INTERVAL '30 days'
      THEN 'old_outstanding_dr'
    WHEN st.settlement_status = 'unsettled'
      AND st.local_amount = 0
      THEN 'zero_amount'
    WHEN st.settlement_status = 'partially_settled'
      AND ABS(st.remaining_local) < 0.01
      THEN 'effectively_settled_needs_close'
    WHEN st.settlement_status = 'difference'
      THEN 'amount_mismatch'
    WHEN st.is_flagged = TRUE
      THEN 'manually_flagged'
    WHEN st.settlement_status = 'needs_review'
      THEN 'review_requested'
    ELSE 'unknown'
  END AS exception_type,
  (CURRENT_DATE - st.source_date) AS days_outstanding,
  st.created_at,
  st.updated_at
FROM public.settlement_transactions st
WHERE st.deleted_at IS NULL
  AND (
    st.is_flagged = TRUE
    OR st.settlement_status IN ('unsettled', 'difference', 'needs_review')
    OR (st.settlement_status = 'partially_settled' AND ABS(st.remaining_local) < 0.01)
    OR (st.settlement_status = 'unsettled' AND st.source_date < CURRENT_DATE - INTERVAL '30 days')
  );

GRANT SELECT ON public.settlement_exceptions_v TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 6. FUNCTION: calculate_fx_direction
--    Computes FX gain/loss based on transaction direction and rate delta.
--
--    RULE:
--      CR entry (we received money):
--        CR rate > settlement rate → we get LESS USD now → LOSS
--        CR rate < settlement rate → we get MORE USD now → GAIN
--      DR entry (we paid money):
--        Original rate > current rate → we pay LESS USD → GAIN
--        Original rate < current rate → we pay MORE USD → LOSS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_fx_direction(
  p_direction       TEXT,          -- 'cr' or 'dr'
  p_original_rate   NUMERIC,       -- rate at time of original transaction
  p_settlement_rate NUMERIC,       -- rate at time of settlement
  p_local_amount    NUMERIC        -- amount in local currency
)
RETURNS TABLE (
  fx_difference_local NUMERIC,
  fx_difference_usd   NUMERIC,
  fx_direction        TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_original_usd  NUMERIC;
  v_settlement_usd NUMERIC;
  v_diff_usd      NUMERIC;
  v_dir           TEXT;
BEGIN
  IF p_original_rate <= 0 OR p_settlement_rate <= 0 THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 'neutral'::TEXT;
    RETURN;
  END IF;

  -- Convert local amount to USD at both rates
  -- Assumption: rate is expressed as LOCAL per 1 USD (e.g., PKR 278 = 1 USD)
  v_original_usd   := p_local_amount / p_original_rate;
  v_settlement_usd := p_local_amount / p_settlement_rate;
  v_diff_usd       := v_settlement_usd - v_original_usd;

  IF p_direction = 'cr' THEN
    -- CR: we received local currency. Higher settlement rate = more USD received = GAIN
    IF v_diff_usd > 0.001    THEN v_dir := 'gain';
    ELSIF v_diff_usd < -0.001 THEN v_dir := 'loss';
    ELSE                           v_dir := 'neutral';
    END IF;
  ELSE
    -- DR: we paid local currency. Higher settlement rate = paid more USD = LOSS
    IF v_diff_usd < -0.001   THEN v_dir := 'gain';
    ELSIF v_diff_usd > 0.001  THEN v_dir := 'loss';
    ELSE                           v_dir := 'neutral';
    END IF;
    v_diff_usd := -v_diff_usd;  -- flip sign so positive always means gain
  END IF;

  RETURN QUERY SELECT
    ROUND((v_diff_usd * p_settlement_rate)::NUMERIC, 4),  -- in local currency
    ROUND(v_diff_usd::NUMERIC, 4),                         -- in USD
    v_dir;
END;
$$;


-- ---------------------------------------------------------------------------
-- 7. FUNCTION: create_settlement_link
--    Creates a CR→DR link, updates settled amounts on both sides, logs audit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_settlement_link(
  p_cr_id           UUID,
  p_dr_id           UUID,
  p_link_amount     NUMERIC,   -- in local currency
  p_settled_by      UUID,
  p_remarks         TEXT DEFAULT NULL,
  p_is_auto         BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cr              settlement_transactions%ROWTYPE;
  v_dr              settlement_transactions%ROWTYPE;
  v_link_id         UUID;
  v_cr_usd_rate     NUMERIC;
  v_dr_usd_rate     NUMERIC;
  v_link_usd        NUMERIC;
  v_fx_diff_local   NUMERIC;
  v_fx_diff_usd     NUMERIC;
  v_fx_dir          TEXT;
  v_cr_new_settled  NUMERIC;
  v_dr_new_settled  NUMERIC;
  v_cr_new_status   TEXT;
  v_dr_new_status   TEXT;
BEGIN
  -- Lock both rows in consistent order (lower UUID first) to prevent deadlocks
  SELECT * INTO v_cr FROM settlement_transactions
    WHERE id = p_cr_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CR settlement transaction not found: %', p_cr_id;
  END IF;

  SELECT * INTO v_dr FROM settlement_transactions
    WHERE id = p_dr_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DR settlement transaction not found: %', p_dr_id;
  END IF;

  IF v_cr.direction != 'cr' THEN
    RAISE EXCEPTION 'Source transaction must be a CR entry';
  END IF;
  IF v_dr.direction != 'dr' THEN
    RAISE EXCEPTION 'Target transaction must be a DR entry';
  END IF;
  IF p_link_amount > v_cr.remaining_local THEN
    RAISE EXCEPTION 'Link amount (%) exceeds CR remaining balance (%)',
      p_link_amount, v_cr.remaining_local;
  END IF;
  IF p_link_amount > v_dr.remaining_local THEN
    RAISE EXCEPTION 'Link amount (%) exceeds DR remaining balance (%)',
      p_link_amount, v_dr.remaining_local;
  END IF;

  -- Compute FX
  v_cr_usd_rate := v_cr.original_usd_rate;
  v_dr_usd_rate := v_dr.original_usd_rate;
  v_link_usd    := ROUND(p_link_amount / v_cr_usd_rate, 4);

  SELECT fx_difference_local, fx_difference_usd, fx_direction
  INTO v_fx_diff_local, v_fx_diff_usd, v_fx_dir
  FROM public.calculate_fx_direction('cr', v_cr_usd_rate, v_dr_usd_rate, p_link_amount);

  -- Create link
  INSERT INTO settlement_links (
    cr_settlement_id, dr_settlement_id,
    linked_local_amount, linked_usd_amount,
    cr_usd_rate, dr_usd_rate,
    fx_difference_local, fx_difference_usd, fx_direction,
    settlement_date, settled_by, remarks, is_auto_matched
  ) VALUES (
    p_cr_id, p_dr_id,
    p_link_amount, v_link_usd,
    v_cr_usd_rate, v_dr_usd_rate,
    v_fx_diff_local, v_fx_diff_usd, v_fx_dir,
    CURRENT_DATE, p_settled_by, p_remarks, p_is_auto
  )
  RETURNING id INTO v_link_id;

  -- Update CR settled amount & status
  v_cr_new_settled := v_cr.settled_local_amount + p_link_amount;
  v_cr_new_status := CASE
    WHEN ABS(v_cr.local_amount - v_cr_new_settled) < 0.01 THEN 'settled'
    WHEN v_cr_new_settled > 0                              THEN 'partially_settled'
    ELSE 'unsettled'
  END;

  UPDATE settlement_transactions SET
    settled_local_amount = v_cr_new_settled,
    settled_usd_amount   = settled_usd_amount + v_link_usd,
    settlement_status    = v_cr_new_status,
    updated_at           = NOW()
  WHERE id = p_cr_id;

  -- Update DR settled amount & status
  v_dr_new_settled := v_dr.settled_local_amount + p_link_amount;
  v_dr_new_status := CASE
    WHEN ABS(v_dr.local_amount - v_dr_new_settled) < 0.01 THEN 'settled'
    WHEN v_dr_new_settled > 0                              THEN 'partially_settled'
    ELSE 'unsettled'
  END;

  UPDATE settlement_transactions SET
    settled_local_amount = v_dr_new_settled,
    settled_usd_amount   = settled_usd_amount + v_link_usd,
    settlement_status    = v_dr_new_status,
    updated_at           = NOW()
  WHERE id = p_dr_id;

  -- Audit log
  INSERT INTO settlement_audit_log (
    settlement_id, link_id, actor_id, country_id, city_branch_id,
    action, previous_status, new_status,
    amount_involved, currency, usd_rate, usd_amount, fx_difference,
    remarks
  ) VALUES (
    p_cr_id, v_link_id, p_settled_by, v_cr.country_id, v_cr.city_branch_id,
    'linked', v_cr.settlement_status, v_cr_new_status,
    p_link_amount, v_cr.local_currency, v_cr_usd_rate, v_link_usd, v_fx_diff_usd,
    p_remarks
  );

  RETURN v_link_id;
END;
$$;


-- ---------------------------------------------------------------------------
-- 8. FUNCTION: remove_settlement_link
--    Soft-deletes a link and reverses the settled amounts on both sides.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_settlement_link(
  p_link_id   UUID,
  p_actor_id  UUID,
  p_reason    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link settlement_links%ROWTYPE;
  v_cr   settlement_transactions%ROWTYPE;
  v_dr   settlement_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM settlement_links
    WHERE id = p_link_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement link not found or already removed: %', p_link_id;
  END IF;

  SELECT * INTO v_cr FROM settlement_transactions
    WHERE id = v_link.cr_settlement_id AND deleted_at IS NULL FOR UPDATE;
  SELECT * INTO v_dr FROM settlement_transactions
    WHERE id = v_link.dr_settlement_id AND deleted_at IS NULL FOR UPDATE;

  -- Soft-delete link
  UPDATE settlement_links SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_link_id;

  -- Reverse CR
  UPDATE settlement_transactions SET
    settled_local_amount = GREATEST(0, settled_local_amount - v_link.linked_local_amount),
    settled_usd_amount   = GREATEST(0, settled_usd_amount   - v_link.linked_usd_amount),
    settlement_status    = CASE
      WHEN (settled_local_amount - v_link.linked_local_amount) <= 0.01 THEN 'unsettled'
      ELSE 'partially_settled'
    END,
    updated_at = NOW()
  WHERE id = v_link.cr_settlement_id;

  -- Reverse DR
  UPDATE settlement_transactions SET
    settled_local_amount = GREATEST(0, settled_local_amount - v_link.linked_local_amount),
    settled_usd_amount   = GREATEST(0, settled_usd_amount   - v_link.linked_usd_amount),
    settlement_status    = CASE
      WHEN (settled_local_amount - v_link.linked_local_amount) <= 0.01 THEN 'unsettled'
      ELSE 'partially_settled'
    END,
    updated_at = NOW()
  WHERE id = v_link.dr_settlement_id;

  -- Audit
  INSERT INTO settlement_audit_log (
    link_id, actor_id, action, reason
  ) VALUES (
    p_link_id, p_actor_id, 'unlinked', p_reason
  );
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. FUNCTION: sync_settlement_from_roznamcha
--    Pulls recent roznamcha_entries into settlement_transactions.
--    Called by the API sync endpoint. Idempotent (UPSERT on source_id).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_settlement_from_roznamcha(
  p_from_date DATE DEFAULT NULL,
  p_country_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO public.settlement_transactions (
    country_id, country_branch_id, city_branch_id,
    source_module, source_table, source_id, source_reference_no, source_date,
    direction, settlement_type,
    local_currency, local_amount, original_usd_rate, original_usd_amount,
    party_name, narration
  )
  SELECT
    re.country_id,
    re.country_branch_id,
    re.city_branch_id,
    re.source_module,
    'roznamcha_entries',
    re.id,
    COALESCE(re.journal_no, re.voucher_no, re.entry_serial_number),
    re.entry_date,
    -- Determine direction from the net of roznamcha lines
    CASE
      WHEN COALESCE(re.total_credit, 0) >= COALESCE(re.total_debit, 0) THEN 'cr'
      ELSE 'dr'
    END,
    CASE
      WHEN re.source_module IN ('bank', 'bank_entry') THEN 'bank'
      WHEN re.source_module IN ('cash', 'cash_entry') THEN 'cash'
      WHEN re.source_module = 'purchase'              THEN 'purchase_payment'
      WHEN re.source_module = 'sales'                 THEN 'sales_receipt'
      WHEN re.source_module = 'expense'               THEN 'expense_payment'
      WHEN re.source_module = 'transfer'              THEN 'transfer'
      ELSE 'other'
    END,
    COALESCE(re.currency, 'PKR'),
    GREATEST(COALESCE(re.total_credit, 0), COALESCE(re.total_debit, 0)),
    COALESCE(re.usd_rate, 1),
    GREATEST(COALESCE(re.total_credit_usd, 0), COALESCE(re.total_debit_usd, 0)),
    re.party_name,
    re.description
  FROM public.roznamcha_entries re
  WHERE re.deleted_at IS NULL
    AND re.status = 'posted'
    AND (p_from_date IS NULL OR re.entry_date >= p_from_date)
    AND (p_country_id IS NULL OR re.country_id = p_country_id)
  ON CONFLICT (source_table, source_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 10. FUNCTION: sync_settlement_from_purchase_payments
--     Pulls purchase_order_payments into settlement_transactions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_settlement_from_purchases(
  p_from_date DATE DEFAULT NULL,
  p_country_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  -- Sync purchase orders (DR side — we owe money for goods)
  INSERT INTO public.settlement_transactions (
    country_id, country_branch_id, city_branch_id,
    source_module, source_table, source_id, source_reference_no, source_date,
    direction, settlement_type,
    local_currency, local_amount, original_usd_rate, original_usd_amount,
    party_name, narration
  )
  SELECT
    po.country_id,
    po.country_branch_id,
    po.city_branch_id,
    'purchase',
    'purchase_orders',
    po.id,
    COALESCE(po.purchase_booking_order_number, po.country_serial_number),
    COALESCE(po.booking_date, po.created_at::date),
    'dr',
    'purchase_payment',
    COALESCE(po.final_currency, po.purchase_currency, 'USD'),
    COALESCE(po.remaining_due_amount, po.total_purchase_amount, 0),
    COALESCE(po.exchange_rate, 1),
    COALESCE(po.remaining_due_amount, po.total_purchase_amount, 0) /
      NULLIF(COALESCE(po.exchange_rate, 1), 0),
    po.supplier_name,
    po.goods_description
  FROM public.purchase_orders po
  WHERE po.deleted_at IS NULL
    AND po.payment_status IN ('pending', 'partial', 'partially_paid')
    AND (p_from_date IS NULL OR COALESCE(po.booking_date, po.created_at::date) >= p_from_date)
    AND (p_country_id IS NULL OR po.country_id = p_country_id)
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET local_amount = EXCLUDED.local_amount,
        original_usd_amount = EXCLUDED.original_usd_amount,
        settlement_status = CASE
          WHEN EXCLUDED.local_amount <= 0.01 THEN 'settled'
          WHEN settlement_transactions.settled_local_amount > 0 THEN 'partially_settled'
          ELSE 'unsettled'
        END,
        updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 11. FUNCTION: sync_settlement_from_sales
--     Pulls sales_orders into settlement_transactions (CR side — customers owe us).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_settlement_from_sales(
  p_from_date DATE DEFAULT NULL,
  p_country_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  INSERT INTO public.settlement_transactions (
    country_id, country_branch_id, city_branch_id,
    source_module, source_table, source_id, source_reference_no, source_date,
    direction, settlement_type,
    local_currency, local_amount, original_usd_rate, original_usd_amount,
    party_name, narration
  )
  SELECT
    so.country_id,
    so.country_branch_id,
    so.city_branch_id,
    'sales',
    'sales_orders',
    so.id,
    so.sales_order_no,
    so.order_date,
    'cr',
    'sales_receipt',
    COALESCE(so.currency_code, 'USD'),
    COALESCE(so.remaining_amount, 0),
    COALESCE(so.exchange_rate, 1),
    COALESCE(so.remaining_amount, 0) / NULLIF(COALESCE(so.exchange_rate, 1), 0),
    so.customer_name,
    so.product_summary
  FROM public.sales_orders so
  WHERE so.deleted_at IS NULL
    AND so.payment_status IN ('pending', 'partial')
    AND (p_from_date IS NULL OR so.order_date >= p_from_date)
    AND (p_country_id IS NULL OR so.country_id = p_country_id)
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET local_amount = EXCLUDED.local_amount,
        original_usd_amount = EXCLUDED.original_usd_amount,
        settlement_status = CASE
          WHEN EXCLUDED.local_amount <= 0.01 THEN 'settled'
          WHEN settlement_transactions.settled_local_amount > 0 THEN 'partially_settled'
          ELSE 'unsettled'
        END,
        updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------------
-- 12. FUNCTION: get_settlement_dashboard_kpis
--     Returns KPI summary for a given scope (country, branch, date range).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_settlement_dashboard_kpis(
  p_country_id      UUID DEFAULT NULL,
  p_branch_id       UUID DEFAULT NULL,
  p_from_date       DATE DEFAULT NULL,
  p_to_date         DATE DEFAULT NULL
)
RETURNS TABLE (
  total_cr_local        NUMERIC,
  total_dr_local        NUMERIC,
  total_cr_usd          NUMERIC,
  total_dr_usd          NUMERIC,
  remaining_cr_local    NUMERIC,
  remaining_dr_local    NUMERIC,
  remaining_cr_usd      NUMERIC,
  remaining_dr_usd      NUMERIC,
  count_settled         BIGINT,
  count_partial         BIGINT,
  count_unsettled       BIGINT,
  count_flagged         BIGINT,
  total_fx_gain_usd     NUMERIC,
  total_fx_loss_usd     NUMERIC,
  net_fx_usd            NUMERIC
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT
    SUM(CASE WHEN direction = 'cr' THEN local_amount   ELSE 0 END),
    SUM(CASE WHEN direction = 'dr' THEN local_amount   ELSE 0 END),
    SUM(CASE WHEN direction = 'cr' THEN original_usd_amount ELSE 0 END),
    SUM(CASE WHEN direction = 'dr' THEN original_usd_amount ELSE 0 END),
    SUM(CASE WHEN direction = 'cr' THEN remaining_local ELSE 0 END),
    SUM(CASE WHEN direction = 'dr' THEN remaining_local ELSE 0 END),
    SUM(CASE WHEN direction = 'cr' THEN remaining_usd   ELSE 0 END),
    SUM(CASE WHEN direction = 'dr' THEN remaining_usd   ELSE 0 END),
    COUNT(CASE WHEN settlement_status = 'settled'           THEN 1 END),
    COUNT(CASE WHEN settlement_status = 'partially_settled' THEN 1 END),
    COUNT(CASE WHEN settlement_status = 'unsettled'         THEN 1 END),
    COUNT(CASE WHEN is_flagged = TRUE                       THEN 1 END),
    COALESCE((
      SELECT SUM(sl.fx_difference_usd)
      FROM settlement_links sl
      WHERE sl.deleted_at IS NULL AND sl.fx_direction = 'gain'
        AND (p_from_date IS NULL OR sl.settlement_date >= p_from_date)
        AND (p_to_date IS NULL OR sl.settlement_date <= p_to_date)
    ), 0),
    COALESCE((
      SELECT SUM(ABS(sl.fx_difference_usd))
      FROM settlement_links sl
      WHERE sl.deleted_at IS NULL AND sl.fx_direction = 'loss'
        AND (p_from_date IS NULL OR sl.settlement_date >= p_from_date)
        AND (p_to_date IS NULL OR sl.settlement_date <= p_to_date)
    ), 0),
    COALESCE((
      SELECT SUM(CASE WHEN sl.fx_direction = 'gain' THEN sl.fx_difference_usd
                      WHEN sl.fx_direction = 'loss' THEN -ABS(sl.fx_difference_usd)
                      ELSE 0 END)
      FROM settlement_links sl
      WHERE sl.deleted_at IS NULL
        AND (p_from_date IS NULL OR sl.settlement_date >= p_from_date)
        AND (p_to_date IS NULL OR sl.settlement_date <= p_to_date)
    ), 0)
  FROM public.settlement_transactions
  WHERE deleted_at IS NULL
    AND (p_country_id IS NULL OR country_id = p_country_id)
    AND (p_branch_id  IS NULL OR city_branch_id = p_branch_id)
    AND (p_from_date  IS NULL OR source_date >= p_from_date)
    AND (p_to_date    IS NULL OR source_date <= p_to_date);
$$;


-- ---------------------------------------------------------------------------
-- 13. RLS Policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.settlement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_audit_log    ENABLE ROW LEVEL SECURITY;

-- settlement_transactions: read by scope
DROP POLICY IF EXISTS settlement_transactions_read ON public.settlement_transactions;
CREATE POLICY settlement_transactions_read ON public.settlement_transactions
  FOR SELECT USING (
    public.is_super_admin()
    OR (country_id IS NOT NULL AND public.can_access_country(country_id))
  );

DROP POLICY IF EXISTS settlement_transactions_write ON public.settlement_transactions;
CREATE POLICY settlement_transactions_write ON public.settlement_transactions
  FOR ALL USING (
    public.is_super_admin()
    OR (country_id IS NOT NULL AND public.can_access_country(country_id))
  );

-- settlement_links: read by joining to CR/DR settlement rows
DROP POLICY IF EXISTS settlement_links_read ON public.settlement_links;
CREATE POLICY settlement_links_read ON public.settlement_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.settlement_transactions st
      WHERE st.id = settlement_links.cr_settlement_id
        AND (public.is_super_admin() OR public.can_access_country(st.country_id))
    )
  );

DROP POLICY IF EXISTS settlement_links_write ON public.settlement_links;
CREATE POLICY settlement_links_write ON public.settlement_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.settlement_transactions st
      WHERE st.id = settlement_links.cr_settlement_id
        AND (public.is_super_admin() OR public.can_access_country(st.country_id))
    )
  );

-- audit_log: read-only by scope
DROP POLICY IF EXISTS settlement_audit_log_read ON public.settlement_audit_log;
CREATE POLICY settlement_audit_log_read ON public.settlement_audit_log
  FOR SELECT USING (
    public.is_super_admin()
    OR (country_id IS NOT NULL AND public.can_access_country(country_id))
  );

-- Audit log is INSERT-only from secure functions — no direct UPDATE/DELETE
DROP POLICY IF EXISTS settlement_audit_log_insert ON public.settlement_audit_log;
CREATE POLICY settlement_audit_log_insert ON public.settlement_audit_log
  FOR INSERT WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 14. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.settlement_transactions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.settlement_links        TO authenticated, service_role;
GRANT SELECT, INSERT         ON public.settlement_audit_log    TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.calculate_fx_direction        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_settlement_link        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_settlement_link        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_settlement_from_roznamcha TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_settlement_from_purchases TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_settlement_from_sales     TO service_role;
GRANT EXECUTE ON FUNCTION public.get_settlement_dashboard_kpis  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 15. Migration tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.erp_schema_migrations (
  name       TEXT PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260828_settlement_reconciliation_engine', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;
