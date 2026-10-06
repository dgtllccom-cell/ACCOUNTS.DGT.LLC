-- Migration: 20261010_doc_intake_contract_route.sql
-- This ERP has no standalone Contract entity — the Contract Control Center is a
-- read-only projection of purchase_orders / sales_orders / employees. Route the
-- 'service_agreement' document type at the Purchase workflow by default; the
-- intake purpose selector lets the user switch it to Sales. Additive/idempotent.

BEGIN;

UPDATE public.document_type_registry
SET target_module = 'purchase_orders', updated_at = now()
WHERE lower(code) = 'service_agreement' AND deleted_at IS NULL
  AND target_module IS DISTINCT FROM 'purchase_orders';

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261010_doc_intake_contract_route', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
