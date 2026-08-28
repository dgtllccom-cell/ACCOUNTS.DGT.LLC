-- =============================================================================
-- Central Contract Control Center (HRM / Office Management)
-- Migration: 20260914_contract_control_center.sql
--
-- A CENTRALLY LINKED contract register — it never copies Purchase / Sales /
-- Employee records. Every row is a live projection of the source table
-- (purchase_orders / sales_orders / employees) joined to a single small new
-- table `contract_followups` that holds ONLY the cross-module follow-up state
-- (last follow-up, next action) which has no home in the source modules.
--
-- Non-destructive: creates 2 tables + 1 view + 2 functions. Touches no existing
-- table, column, row, policy or migration.
-- =============================================================================

BEGIN;

-- ── 1. contract_followups — the only genuinely new data ──────────────────────
CREATE TABLE IF NOT EXISTS public.contract_followups (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module      text NOT NULL CHECK (source_module IN ('purchase_order','sales_order','hr_employee')),
  source_table       text NOT NULL,
  source_id          uuid NOT NULL,
  contract_reference text,
  -- denormalised scope so the register can be filtered without re-joining
  country_id         uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  country_branch_id  uuid REFERENCES public.country_branches(id) ON DELETE SET NULL,
  city_branch_id     uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  watch_status       text NOT NULL DEFAULT 'watching' CHECK (watch_status IN ('watching','muted','closed')),
  last_followup_at   timestamptz,
  last_followup_note text,
  next_action_date   date,
  next_action_note   text,
  created_by         uuid,
  updated_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_followups_source_uidx
  ON public.contract_followups (source_module, source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contract_followups_scope_idx
  ON public.contract_followups (country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contract_followups_next_action_idx
  ON public.contract_followups (next_action_date) WHERE deleted_at IS NULL AND next_action_date IS NOT NULL;

COMMENT ON TABLE public.contract_followups IS
  'Cross-module contract follow-up state for the Central Contract Control Center. One row per source contract; never holds a copy of the contract itself.';

-- ── 2. contract_register_audit — immutable audit of actions from the Center ──
CREATE TABLE IF NOT EXISTS public.contract_register_audit (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module  text NOT NULL,
  source_id      uuid NOT NULL,
  contract_reference text,
  action         text NOT NULL,           -- 'viewed' | 'followup_added' | 'next_action_set' | 'reminder_created' | 'watch_changed'
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id       uuid,
  actor_name     text,
  country_id     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_register_audit_source_idx
  ON public.contract_register_audit (source_module, source_id, created_at DESC);

COMMENT ON TABLE public.contract_register_audit IS
  'Append-only audit of every action taken inside the Contract Control Center. Never updated or deleted.';

-- ── 3. erp_contract_register_v — the linked register ────────────────────────
DROP VIEW IF EXISTS public.erp_contract_register_v CASCADE;
CREATE VIEW public.erp_contract_register_v AS
WITH doc_counts AS (
  SELECT source_module, source_record_id, COUNT(*)::int AS attachment_count
  FROM public.office_documents
  WHERE deleted_at IS NULL AND source_record_id IS NOT NULL
  GROUP BY source_module, source_record_id
)
-- ---- Purchase contracts (New Purchase Booking + Purchase Order) -------------
SELECT
  'purchase_order'::text                       AS source_module,
  'purchase_orders'::text                       AS source_table,
  po.id                                          AS source_id,
  CASE WHEN NULLIF(btrim(po.purchase_contract_no), '') IS NOT NULL
       THEN 'purchase_booking' ELSE 'purchase_order' END AS contract_type,
  po.super_admin_serial_number                   AS global_serial,
  po.country_transaction_serial_number           AS country_serial,
  po.branch_transaction_serial_number            AS branch_serial,
  po.purchase_contract_no                         AS contract_no,
  (po.form_data->'form'->>'manualContractNo')     AS manual_contract_no,
  po.purchase_order_no                            AS booking_order_no,
  po.country_id, po.country_branch_id, po.city_branch_id,
  co.name                                         AS country_name,
  cb.name                                         AS main_branch_name,
  cib.name                                        AS city_branch_name,
  po.created_by,
  cmp.name                                        AS party_name,
  'supplier'::text                                AS party_role,
  po.supplier_company_id                          AS party_id,
  po.created_at::date                             AS contract_date,
  COALESCE((po.form_data->'form'->>'contractStartDate')::date, po.created_at::date) AS start_date,
  (po.form_data->'form'->>'contractExpiryDate')::date  AS expiry_date,
  (po.form_data->'form'->>'expectedDeliveryDate')::date AS expected_delivery_date,
  po.form_data->'goodsEntries'                     AS goods,
  po.total_goods_original                          AS quantity_hint,
  NULL::numeric                                    AS gross_weight,
  NULL::numeric                                    AS net_weight,
  COALESCE(po.purchase_currency, po.currency_code) AS original_currency,
  po.order_total                                   AS original_amount,
  po.exchange_rate,
  'USD'::text                                      AS local_currency,
  po.total_goods_usd                               AS final_amount,
  po.advance_paid                                  AS advance_amount,
  po.remaining_paid                                AS paid_amount,
  po.remaining_due                                 AS remaining_balance,
  po.status                                        AS source_status,
  po.payment_status,
  po.ledger_posting_status,
  po.status                                        AS loading_status,
  COALESCE(dc.attachment_count, 0)                 AS attachment_count,
  cf.last_followup_at, cf.last_followup_note, cf.next_action_date, cf.next_action_note,
  COALESCE(cf.watch_status, 'watching')            AS watch_status,
  po.global_reference_id,
  po.created_at, po.updated_at
FROM public.purchase_orders po
JOIN public.countries co        ON co.id = po.country_id
LEFT JOIN public.country_branches cb ON cb.id = po.country_branch_id
LEFT JOIN public.city_branches cib   ON cib.id = po.city_branch_id
LEFT JOIN public.companies cmp       ON cmp.id = po.supplier_company_id
LEFT JOIN doc_counts dc              ON dc.source_module = 'purchase_order' AND dc.source_record_id = po.id
LEFT JOIN public.contract_followups cf ON cf.source_module = 'purchase_order' AND cf.source_id = po.id AND cf.deleted_at IS NULL
WHERE po.deleted_at IS NULL

UNION ALL
-- ---- Sales contracts (New Sales Booking + Sales Order) ---------------------
SELECT
  'sales_order'::text, 'sales_orders'::text, so.id,
  CASE WHEN NULLIF(btrim(so.sales_contract_no), '') IS NOT NULL
       THEN 'sales_booking' ELSE 'sales_order' END,
  so.super_admin_serial_number, so.country_transaction_serial_number, so.branch_transaction_serial_number,
  so.sales_contract_no,
  so.manual_reference_number,
  so.sales_order_no,
  so.country_id, so.country_branch_id, so.city_branch_id,
  co.name, cb.name, cib.name,
  so.created_by,
  so.customer_name, 'customer'::text, so.customer_account_id,
  COALESCE(so.order_date, so.created_at::date),
  COALESCE(so.order_date, so.created_at::date),
  (so.form_data->'form'->>'contractExpiryDate')::date,
  (so.form_data->'form'->>'expectedDeliveryDate')::date,
  so.form_data->'goodsEntries',
  so.quantity,
  NULL::numeric, so.total_weight,
  COALESCE(so.original_currency_code, so.currency_code),
  so.order_total,
  so.exchange_rate,
  'USD'::text,
  so.base_currency_amount,
  NULL::numeric,
  so.paid_amount,
  so.remaining_amount,
  so.sales_status,
  so.payment_status,
  so.ledger_posting_status,
  so.delivery_status,
  COALESCE(dc.attachment_count, 0),
  cf.last_followup_at, cf.last_followup_note, cf.next_action_date, cf.next_action_note,
  COALESCE(cf.watch_status, 'watching'),
  so.global_reference_id,
  so.created_at, so.updated_at
FROM public.sales_orders so
JOIN public.countries co        ON co.id = so.country_id
LEFT JOIN public.country_branches cb ON cb.id = so.country_branch_id
LEFT JOIN public.city_branches cib   ON cib.id = so.city_branch_id
LEFT JOIN doc_counts dc              ON dc.source_module = 'sales_order' AND dc.source_record_id = so.id
LEFT JOIN public.contract_followups cf ON cf.source_module = 'sales_order' AND cf.source_id = so.id AND cf.deleted_at IS NULL
WHERE so.deleted_at IS NULL

UNION ALL
-- ---- Employee employment contracts --------------------------------------
SELECT
  'hr_employee'::text, 'employees'::text, e.id,
  'employment'::text,
  e.super_admin_serial, e.country_serial, e.branch_serial,
  e.employee_code,
  NULL::text,
  e.employee_code,
  e.country_id, e.country_branch_id, e.city_branch_id,
  co.name, cb.name, cib.name,
  e.created_by,
  COALESCE(NULLIF(btrim(cust.customer_name), ''), NULLIF(btrim(concat_ws(' ', cust.first_name, cust.last_name)), ''), e.employee_code),
  'employee'::text, e.person_master_id,
  e.joining_date,
  COALESCE(e.contract_start_date, e.joining_date),
  e.contract_end_date,
  NULL::date,
  NULL::jsonb,
  NULL::numeric,
  NULL::numeric, NULL::numeric,
  e.salary_currency,
  e.monthly_salary,
  1::numeric,
  'USD'::text,
  NULL::numeric,
  NULL::numeric,
  NULL::numeric,
  NULL::numeric,
  e.status,
  NULL::text,
  NULL::text,
  e.job_status,
  COALESCE(dc.attachment_count, 0),
  cf.last_followup_at, cf.last_followup_note, cf.next_action_date, cf.next_action_note,
  COALESCE(cf.watch_status, 'watching'),
  NULL::text,
  e.created_at, e.updated_at
FROM public.employees e
JOIN public.countries co        ON co.id = e.country_id
LEFT JOIN public.country_branches cb ON cb.id = e.country_branch_id
LEFT JOIN public.city_branches cib   ON cib.id = e.city_branch_id
LEFT JOIN public.customers cust      ON cust.id = e.person_master_id
LEFT JOIN doc_counts dc              ON dc.source_module = 'hr_employee' AND dc.source_record_id = e.id
LEFT JOIN public.contract_followups cf ON cf.source_module = 'hr_employee' AND cf.source_id = e.id AND cf.deleted_at IS NULL
WHERE e.deleted_at IS NULL;

COMMENT ON VIEW public.erp_contract_register_v IS
  'Central Contract Control Center register — live projection of purchase_orders / sales_orders / employees. Never a copy.';

-- ── 4. unified contract status ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_register_status(
  p_source_module text, p_source_status text, p_payment_status text,
  p_ledger_status text, p_expiry date
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(coalesce(p_source_status,'')) IN ('cancelled','canceled','void') THEN 'Cancelled'
    WHEN p_expiry IS NOT NULL AND p_expiry < current_date
         AND lower(coalesce(p_payment_status,'')) NOT IN ('paid','completed') THEN 'Expired'
    WHEN lower(coalesce(p_source_status,'')) IN ('completed','closed','delivered')
         AND lower(coalesce(p_payment_status,'')) IN ('paid','completed') THEN 'Completed'
    WHEN lower(coalesce(p_payment_status,'')) IN ('partial','partially_paid')
         OR lower(coalesce(p_source_status,'')) IN ('partial','partially_completed','in_progress') THEN 'Partially Completed'
    WHEN lower(coalesce(p_ledger_status,'')) IN ('posted','transferred') THEN 'Active'
    WHEN lower(coalesce(p_source_status,'')) IN ('approved','confirmed') THEN 'Approved'
    WHEN lower(coalesce(p_source_status,'')) IN ('pending_approval','submitted') THEN 'Pending Approval'
    WHEN lower(coalesce(p_source_status,'')) IN ('pending_verification','pending') THEN 'Pending Verification'
    ELSE 'Draft'
  END;
$$;

-- ── 5. Smart-CRM reminder sync for contracts ──────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_contract_reminders(p_days_ahead int DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  -- Contract expiry + delivery-due + pending-approval + missing-attachment +
  -- remaining-balance reminders land in crm_action_items (the existing Smart CRM
  -- follow-up table). CRM owns the reminder; the contract stays in its module.
  INSERT INTO public.crm_action_items (
    source_type, source_id, reference_no, party_name, due_date, item_type, module,
    amount, paid_amount, remaining_amount, currency,
    country_id, country_name, country_branch_id, city_branch_id, branch_name,
    responsible_user_id, urgency_class, status, next_follow_up, notes
  )
  SELECT
    'contract_' || r.source_module,
    r.source_id,
    COALESCE(r.contract_no, r.booking_order_no, r.global_serial),
    r.party_name,
    COALESCE(r.expiry_date, r.expected_delivery_date, r.next_action_date, current_date),
    CASE
      WHEN r.expiry_date IS NOT NULL AND r.expiry_date <= current_date + p_days_ahead THEN 'contract_expiry'
      WHEN r.expected_delivery_date IS NOT NULL AND r.expected_delivery_date <= current_date + p_days_ahead THEN 'delivery_due'
      WHEN r.attachment_count = 0 THEN 'missing_attachment'
      WHEN COALESCE(r.remaining_balance,0) > 0 THEN 'pending_payment'
      ELSE 'contract_followup'
    END,
    'contract_control',
    r.original_amount, r.paid_amount, r.remaining_balance, r.original_currency,
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
      WHERE x.source_id = r.source_id AND x.module = 'contract_control'
        AND x.is_completed = false
        AND x.created_at > current_date - 7
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.contract_register_status(text,text,text,text,date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_contract_reminders(int) TO authenticated, service_role;
GRANT SELECT ON public.erp_contract_register_v TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260914_contract_control_center', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
