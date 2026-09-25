-- Approved Shipping Line permission bundle -> existing agent_user (Shipping-domain) custom permission sets.
-- Custom sets REPLACE role defaults, so users provisioned before the bundle existed would otherwise never
-- receive it. Additive union only (never removes or narrows a token); idempotent; touches only
-- public.user_permission_sets rows of active agent_user assignments in the shipping/both domain.
-- Source of truth: SHIPPING_APPROVED_BUNDLE in lib/permissions/enterprise-roles.ts.
-- ledger_full:read is deliberately NOT part of the bundle.
WITH bundle(token) AS (
  VALUES
   ('accounts:read'),('accounts:create'),('roznamcha:read'),('roznamcha:create'),('transactions:read'),
   ('transactions:create'),('roznamcha:post_cross_branch'),('record_transfers:read'),('record_transfers:create'),
   ('shipping_records:read'),('shipping_records:create'),('shipping_records:update'),('shipping_reports:read'),
   ('reports:read'),('shipping:read'),('inter_branch_transfers:read'),('inter_branch_transfers:create'),
   ('inter_branch_transfers:approve'),('clearing_bill_customer_charges:read'),('clearing_bill_customer_charges:create'),
   ('customer_receipts:read'),('customer_receipts:create')
),
targets AS (
  SELECT DISTINCT ura.user_id
  FROM public.user_role_assignments ura
  WHERE ura.role = 'agent_user' AND ura.is_active AND ura.deleted_at IS NULL
    AND ura.operational_domain IN ('shipping','both')
)
UPDATE public.user_permission_sets ups
SET permissions = (
      SELECT ARRAY(SELECT DISTINCT t FROM unnest(ups.permissions || ARRAY(SELECT token FROM bundle)) AS t ORDER BY t)
    ),
    updated_at = now()
FROM targets
WHERE ups.user_id = targets.user_id
  AND coalesce(ups.source, '') <> 'role_default';
