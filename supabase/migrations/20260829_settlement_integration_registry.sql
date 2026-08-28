-- =============================================================================
-- SETTLEMENT & RECONCILIATION ENGINE - SOURCE INTEGRATION REGISTRY
-- Migration: 20260829_settlement_integration_registry.sql
--
-- PURPOSE:
--   Creates a generic, future-proof integration layer for any ERP module
--   to automatically participate in the Settlement system without duplicating data.
-- =============================================================================

BEGIN;

-- 1. The Generic Registration Function
-- Any existing or future module can call this to upsert its financial entries
-- into the settlement_transactions registry.
CREATE OR REPLACE FUNCTION public.register_settlement_source(
  p_country_id UUID,
  p_country_branch_id UUID,
  p_city_branch_id UUID,
  p_source_module TEXT,
  p_source_table TEXT,
  p_source_id UUID,
  p_source_reference_no TEXT,
  p_source_date DATE,
  p_direction TEXT,
  p_settlement_type TEXT,
  p_local_currency TEXT,
  p_local_amount NUMERIC,
  p_original_usd_rate NUMERIC,
  p_original_usd_amount NUMERIC,
  p_party_name TEXT,
  p_narration TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_local_amount = 0 THEN
    RETURN; -- Don't register zero-amount transactions
  END IF;

  INSERT INTO public.settlement_transactions (
    country_id, country_branch_id, city_branch_id,
    source_module, source_table, source_id, source_reference_no, source_date,
    direction, settlement_type,
    local_currency, local_amount, original_usd_rate, original_usd_amount,
    party_name, narration
  ) VALUES (
    p_country_id, p_country_branch_id, p_city_branch_id,
    p_source_module, p_source_table, p_source_id, p_source_reference_no, p_source_date,
    p_direction, p_settlement_type,
    p_local_currency, p_local_amount, p_original_usd_rate, p_original_usd_amount,
    p_party_name, p_narration
  )
  ON CONFLICT (source_table, source_id) DO UPDATE
    SET local_amount = EXCLUDED.local_amount,
        original_usd_amount = EXCLUDED.original_usd_amount,
        source_reference_no = EXCLUDED.source_reference_no,
        source_date = EXCLUDED.source_date,
        party_name = EXCLUDED.party_name,
        narration = EXCLUDED.narration,
        settlement_status = CASE
          WHEN EXCLUDED.local_amount <= 0.01 THEN 'settled'
          WHEN settlement_transactions.settled_local_amount > 0 THEN 'partially_settled'
          ELSE 'unsettled'
        END,
        updated_at = NOW();
END;
$$;

-- 2. Generic un-register function (for deleted/cancelled source records)
CREATE OR REPLACE FUNCTION public.unregister_settlement_source(
  p_source_table TEXT,
  p_source_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.settlement_transactions
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE source_table = p_source_table
    AND source_id = p_source_id
    AND deleted_at IS NULL;
END;
$$;

-- 3. Trigger Function for clearing_payment_bills
CREATE OR REPLACE FUNCTION public.trg_sync_clearing_payment_bills()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL) THEN
    PERFORM public.unregister_settlement_source('clearing_payment_bills', OLD.id);
    RETURN NEW;
  END IF;

  IF NEW.status = 'active' AND NEW.is_active = TRUE AND NEW.payment_status IN ('pending', 'partial') THEN
    PERFORM public.register_settlement_source(
      NEW.country_id,
      NEW.country_branch_id,
      NEW.city_branch_id,
      'clearing_agent',
      'clearing_payment_bills',
      NEW.id,
      NEW.bill_no,
      NEW.created_at::date,
      'dr', -- we pay the clearing agent
      'expense_payment',
      COALESCE(NEW.currency_code, 'USD'),
      NEW.total_amount,
      1, -- Assuming USD or standard rate logic for now
      NEW.total_amount,
      NEW.agent_name,
      NEW.remarks
    );
  ELSE
    IF NEW.status != 'active' OR NEW.is_active = FALSE THEN
       PERFORM public.unregister_settlement_source('clearing_payment_bills', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clearing_payment_bills_settlement ON public.clearing_payment_bills;
CREATE TRIGGER trg_clearing_payment_bills_settlement
AFTER INSERT OR UPDATE ON public.clearing_payment_bills
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_clearing_payment_bills();

-- 4. Initial Backfill / Sync for clearing_payment_bills
SELECT public.register_settlement_source(
  country_id,
  country_branch_id,
  city_branch_id,
  'clearing_agent',
  'clearing_payment_bills',
  id,
  bill_no,
  created_at::date,
  'dr',
  'expense_payment',
  COALESCE(currency_code, 'USD'),
  total_amount,
  1,
  total_amount,
  agent_name,
  remarks
)
FROM public.clearing_payment_bills
WHERE deleted_at IS NULL
  AND status = 'active'
  AND is_active = TRUE
  AND payment_status IN ('pending', 'partial');

NOTIFY pgrst, 'reload schema';

COMMIT;
