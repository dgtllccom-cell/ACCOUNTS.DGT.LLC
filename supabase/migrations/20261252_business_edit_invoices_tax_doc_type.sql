-- Migration: 20261252_business_edit_invoices_tax_doc_type.sql
-- Purpose: allow the Sales Tax Invoice document type to be saved as a business edit invoice.
-- The app already offers the tax_invoice template; the database CHECK constraint only accepted four
-- document types, so every save of a tax invoice was rejected (VALIDATION, doc_type).
-- Additive only: widening a CHECK constraint cannot invalidate an existing row, and no data is changed.
BEGIN;

ALTER TABLE public.business_edit_invoices
  DROP CONSTRAINT IF EXISTS business_edit_invoices_doc_type_check;

ALTER TABLE public.business_edit_invoices
  ADD CONSTRAINT business_edit_invoices_doc_type_check
  CHECK (doc_type = ANY (ARRAY['commercial_invoice'::text, 'proforma_invoice'::text, 'export_invoice'::text, 'packing_list'::text, 'tax_invoice'::text]));

COMMIT;
