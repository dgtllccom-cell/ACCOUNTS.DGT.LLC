-- =============================================================================
-- AI Document Intake — Phase 8 (Cash / Bank Roznamcha intake)
-- Migration: 20260929_document_intake_roznamcha.sql
--
-- Route finance documents (cash receipt, bank transfer advice, cheque, payment
-- confirmation, sales/advance receipt) to a reviewed Roznamcha DRAFT + a
-- pre-post preview. The AI NEVER posts to roznamcha_entries / roznamcha_lines /
-- journal / ledgers — the human posts through the existing Cash / Bank
-- Roznamcha screen, which keeps the balanced-Dr/Cr and duplicate-posting
-- guards.
--
-- Non-destructive: updates document_type_registry.target_module for finance
-- types + widens the classifier keywords for payment-method detection. No table
-- changes, no data deletion.
-- =============================================================================

BEGIN;

UPDATE public.document_type_registry
SET target_module = 'roznamcha_entries', updated_at = now()
WHERE code IN ('cash_receipt', 'bank_transfer_advice', 'cheque_image', 'payment_confirmation', 'sales_receipt', 'advance_receipt')
  AND target_module IS NULL
  AND deleted_at IS NULL;

-- sharpen payment-method keyword hints (used by the extractor to guess Cash /
-- Bank Transfer / Cheque and the cheque status)
UPDATE public.document_type_registry SET classifier_keywords =
  ARRAY['cash receipt','cash voucher','received cash','paid cash','cash memo','received with thanks in cash']
  WHERE code = 'cash_receipt' AND deleted_at IS NULL;
UPDATE public.document_type_registry SET classifier_keywords =
  ARRAY['bank transfer','transfer advice','telegraphic transfer','tt copy','swift copy','wire transfer','value date','remittance advice','iban']
  WHERE code = 'bank_transfer_advice' AND deleted_at IS NULL;
UPDATE public.document_type_registry SET classifier_keywords =
  ARRAY['cheque','check no','pay to the order of','a/c payee','cheque date','post dated','pdc','drawee bank']
  WHERE code = 'cheque_image' AND deleted_at IS NULL;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260929_document_intake_roznamcha', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
