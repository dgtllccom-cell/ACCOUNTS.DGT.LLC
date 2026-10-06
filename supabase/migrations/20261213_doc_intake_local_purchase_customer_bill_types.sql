-- Document Intelligence: two more document types routed to EXISTING modules — ADDITIVE.
--   local_purchase_bill      → local_purchases           (local supplier bill / cash memo)
--   clearing_charge_invoice  → clearing_customer_bills   (port / freight / clearing charges to bill a customer)
-- Configuration rows only (document_type_registry); no business record is created or changed.
-- The AI still only prepares a reviewed draft; the Local Purchase form / Customer Bill screen saves.
-- Rollback: UPDATE public.document_type_registry SET deleted_at = now() WHERE code IN (...).

BEGIN;

INSERT INTO public.document_type_registry
  (code, name, operational_domain, category, target_module, expected_fields,
   classifier_keywords, min_confidence, requires_qvc, is_active, rank_order)
SELECT v.code, v.name, v.operational_domain, v.category, v.target_module,
       v.expected_fields::jsonb, v.classifier_keywords::text[], v.min_confidence,
       v.requires_qvc, true, v.rank_order
FROM (VALUES
  (
    'local_purchase_bill',
    'Local Purchase Bill / Cash Memo',
    'business', 'purchase', 'local_purchases',
    '[{"key":"invoice_number","label":"Bill / Memo No.","required":true},
      {"key":"document_date","label":"Bill Date","required":true},
      {"key":"supplier_name","label":"Local Supplier","required":true},
      {"key":"currency","label":"Currency"},
      {"key":"grand_total","label":"Bill Total","required":true}]',
    ARRAY['cash memo','local purchase','purchase bill','supplier bill','bill no','memo no','qty','rate','amount'],
    0.35, true, 575
  ),
  (
    'clearing_charge_invoice',
    'Clearing / Port Charges Invoice (customer billing)',
    'shipping', 'clearing', 'clearing_customer_bills',
    '[{"key":"invoice_number","label":"Invoice No.","required":true},
      {"key":"document_date","label":"Invoice Date"},
      {"key":"customer_name","label":"Customer / Consignee"},
      {"key":"bl_number","label":"B/L No."},
      {"key":"container_numbers","label":"Containers"},
      {"key":"currency","label":"Currency"},
      {"key":"grand_total","label":"Total","required":true}]',
    ARRAY['clearing charges','port charges','terminal handling','thc','demurrage','detention','do charges','customs duty','agency fee','delivery order charges'],
    0.35, true, 576
  )
) AS v(code, name, operational_domain, category, target_module, expected_fields,
       classifier_keywords, min_confidence, requires_qvc, rank_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_type_registry r
  WHERE lower(r.code) = lower(v.code) AND r.country_id IS NULL AND r.deleted_at IS NULL
);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261213_doc_intake_local_purchase_customer_bill_types', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;
