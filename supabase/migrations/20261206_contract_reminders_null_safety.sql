-- =============================================================================
-- Fix: sync_contract_reminders() / sync_contract_intelligence_reminders()
-- Migration: 20261206_contract_reminders_null_safety.sql
--
-- Second pre-existing bug found while verifying against real DEV data: many
-- real contracts have a null party_name (e.g. purchase bookings with no
-- linked supplier company yet), but crm_action_items.party_name/reference_no/
-- currency/amount/paid_amount/remaining_amount are all NOT NULL — so the
-- INSERT raised "null value in column party_name violates not-null
-- constraint" for any such row, in BOTH the already-shipped
-- sync_contract_reminders() and the new sibling function.
--
-- Fix: COALESCE the handful of columns that can legitimately be null on the
-- source contract to a safe display default, matching the "—" / "Unspecified"
-- fallback convention already used in the Contract Control Center UI. No
-- change to which contracts qualify or what item_type is chosen.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_contract_reminders(p_days_ahead int DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.crm_action_items (
    source_type, source_id, reference_no, party_name, due_date, item_type, module,
    amount, paid_amount, remaining_amount, currency,
    country_id, country_name, country_branch_id, city_branch_id, branch_name,
    responsible_user_id, urgency_class, status, next_follow_up, notes
  )
  SELECT
    'contract_' || r.source_module,
    r.source_id,
    COALESCE(NULLIF(r.contract_no, ''), NULLIF(r.booking_order_no, ''), NULLIF(r.global_serial, ''), 'N/A'),
    COALESCE(NULLIF(r.party_name, ''), 'Unspecified'),
    COALESCE(r.expiry_date, r.expected_delivery_date, r.next_action_date, current_date),
    CASE
      WHEN r.expiry_date IS NOT NULL AND r.expiry_date <= current_date + p_days_ahead THEN 'contract_expiry'
      WHEN r.expected_delivery_date IS NOT NULL AND r.expected_delivery_date <= current_date + p_days_ahead THEN 'delivery_due'
      WHEN r.attachment_count = 0 THEN 'missing_attachment'
      WHEN COALESCE(r.remaining_balance,0) > 0 THEN 'pending_payment'
      ELSE 'contract_followup'
    END,
    'contract_control',
    COALESCE(r.original_amount, 0), COALESCE(r.paid_amount, 0), COALESCE(r.remaining_balance, 0), COALESCE(NULLIF(r.original_currency, ''), 'USD'),
    r.country_id, r.country_name, r.country_branch_id, r.city_branch_id, r.main_branch_name,
    r.created_by, 'medium', 'open',
    COALESCE(r.next_action_date, r.expiry_date, r.expected_delivery_date),
    'Auto-generated from Contract Control Center'
  FROM public.erp_contract_register_v r
  WHERE r.watch_status <> 'muted'
    AND (
      (r.expiry_date IS NOT NULL AND r.expiry_date <= current_date + p_days_ahead)
      OR (r.expected_delivery_date IS NOT NULL AND r.expected_delivery_date <= current_date + p_days_ahead)
      OR (r.attachment_count = 0 AND r.contract_type <> 'employment')
      OR (COALESCE(r.remaining_balance,0) > 0)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_action_items x
      WHERE x.source_id = r.source_id::text AND x.module = 'contract_control'
        AND x.is_completed = false
        AND x.created_at > current_date - 7
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_contract_intelligence_reminders(p_days_ahead int DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.crm_action_items (
    source_type, source_id, reference_no, party_name, due_date, item_type, module,
    amount, paid_amount, remaining_amount, currency,
    country_id, country_name, country_branch_id, city_branch_id, branch_name,
    responsible_user_id, urgency_class, status, next_follow_up, notes
  )
  SELECT
    'contract_intelligence_' || r.source_module,
    r.source_id,
    COALESCE(NULLIF(r.contract_no, ''), NULLIF(r.booking_order_no, ''), NULLIF(r.global_serial, ''), 'N/A'),
    COALESCE(NULLIF(r.party_name, ''), 'Unspecified'),
    COALESCE(r.expiry_date, current_date),
    CASE
      WHEN a.overall_risk_level = 'high' THEN 'contract_risk_high'
      WHEN jsonb_array_length(COALESCE(a.missing_clauses, '[]'::jsonb)) > 0 THEN 'contract_missing_clause'
      WHEN (a.renewal->>'riskLevel') IN ('high','medium') AND r.expiry_date IS NOT NULL AND r.expiry_date <= current_date + p_days_ahead THEN 'contract_renewal_risk'
      WHEN jsonb_array_length(COALESCE(a.payment_warnings, '[]'::jsonb)) > 0 THEN 'contract_payment_warning'
      ELSE 'contract_risk_medium'
    END,
    'contract_intelligence',
    COALESCE(r.original_amount, 0), COALESCE(r.paid_amount, 0), COALESCE(r.remaining_balance, 0), COALESCE(NULLIF(r.original_currency, ''), 'USD'),
    r.country_id, r.country_name, r.country_branch_id, r.city_branch_id, r.main_branch_name,
    r.created_by, CASE WHEN a.overall_risk_level = 'high' THEN 'high' ELSE 'medium' END, 'open',
    COALESCE(r.expiry_date, current_date + p_days_ahead),
    'Auto-generated from Contract Intelligence'
  FROM public.contract_intelligence_analyses a
  JOIN public.erp_contract_register_v r
    ON r.source_module = a.source_module AND r.source_id = a.source_id
  WHERE a.deleted_at IS NULL
    AND r.watch_status <> 'muted'
    AND a.analysis_status = 'completed'
    AND (
      a.overall_risk_level = 'high'
      OR jsonb_array_length(COALESCE(a.missing_clauses, '[]'::jsonb)) > 0
      OR jsonb_array_length(COALESCE(a.payment_warnings, '[]'::jsonb)) > 0
      OR ((a.renewal->>'riskLevel') IN ('high','medium') AND r.expiry_date IS NOT NULL AND r.expiry_date <= current_date + p_days_ahead)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_action_items x
      WHERE x.source_id = r.source_id::text AND x.module = 'contract_intelligence'
        AND x.is_completed = false
        AND x.created_at > current_date - 7
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20261206_contract_reminders_null_safety', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
