-- =============================================================================
-- UAE TAX — VIEW HARDENING
-- Migration: 20260909_uae_tax_view_hardening.sql
--
-- uae_tax_lines_v and uae_tax_trace_v use `tl.*`. `CREATE OR REPLACE VIEW`
-- cannot reorder columns, so once later migrations add trailing columns to
-- uae_tax_lines a re-run of the earlier CREATE OR REPLACE fails
-- ("cannot change name of view column"). Rebuilding them with DROP ... CASCADE
-- makes every re-run safe and pins the canonical definition here.
-- =============================================================================

BEGIN;

DROP VIEW IF EXISTS public.uae_tax_lines_v CASCADE;
CREATE VIEW public.uae_tax_lines_v AS
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

DROP VIEW IF EXISTS public.uae_tax_trace_v CASCADE;
CREATE VIEW public.uae_tax_trace_v AS
SELECT
  tl.id                        AS tax_line_id,
  tl.tax_entity_id,
  e.trn                        AS tax_entity_trn,
  e.legal_name                 AS tax_entity_name,
  tl.country_id, co.name       AS country_name,
  tl.country_branch_id, cb.name AS main_branch_name,
  tl.city_branch_id, cib.name  AS branch_name,
  pr.full_name                 AS entered_by_name,
  tl.source_module, tl.source_table, tl.source_id, tl.source_line_id, tl.source_reference_no, tl.source_date,
  tl.direction, tl.transaction_category, tl.tax_category,
  tl.party_name, tl.party_trn, tl.description,
  tl.taxable_amount, tl.vat_rate, tl.vat_amount,
  tl.aed_taxable_amount, tl.aed_vat_amount,
  tl.recoverability, tl.recoverable_amount,
  tl.roznamcha_entry_id, re.journal_no AS roznamcha_journal_no, re.entry_date AS roznamcha_date,
  re.source_transaction_type,
  tl.tax_period_id, tp.period_code, tp.status AS period_status,
  tl.vat_return_id, vr.status AS vat_return_status, tl.vat_return_box,
  tl.document_status, tl.evidence_document_id,
  od.file_name AS evidence_file_name, od.document_path AS evidence_folder,
  (SELECT COUNT(*) FROM public.uae_tax_line_documents d WHERE d.tax_line_id = tl.id AND d.deleted_at IS NULL) AS document_count,
  tl.customs_declaration_no, tl.bl_number,
  ei.invoice_number AS e_invoice_number, ei.status AS e_invoice_status, ei.asp_reference,
  rec.status AS recovery_status, rec.amount_aed AS recovery_amount_aed
FROM public.uae_tax_lines tl
LEFT JOIN public.uae_tax_entities e   ON e.id = tl.tax_entity_id
LEFT JOIN public.countries co         ON co.id = tl.country_id
LEFT JOIN public.country_branches cb  ON cb.id = tl.country_branch_id
LEFT JOIN public.city_branches cib    ON cib.id = tl.city_branch_id
LEFT JOIN public.profiles pr          ON pr.id = tl.entered_by
LEFT JOIN public.roznamcha_entries re ON re.id = tl.roznamcha_entry_id
LEFT JOIN public.uae_tax_periods tp   ON tp.id = tl.tax_period_id
LEFT JOIN public.uae_vat_returns vr   ON vr.id = tl.vat_return_id
LEFT JOIN public.office_documents od  ON od.id = tl.evidence_document_id
LEFT JOIN LATERAL (
  SELECT * FROM public.uae_e_invoices x
  WHERE x.source_module = 'sales_order' AND x.source_id = tl.source_id AND x.deleted_at IS NULL
  ORDER BY x.created_at DESC LIMIT 1
) ei ON tl.direction = 'output'
LEFT JOIN LATERAL (
  SELECT * FROM public.uae_vat_recovery x
  WHERE x.tax_line_id = tl.id AND x.deleted_at IS NULL
  ORDER BY x.created_at DESC LIMIT 1
) rec ON tl.direction = 'input'
WHERE tl.deleted_at IS NULL;
GRANT SELECT ON public.uae_tax_trace_v TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260909_uae_tax_view_hardening', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
