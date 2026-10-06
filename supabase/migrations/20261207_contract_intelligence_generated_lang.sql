-- =============================================================================
-- Fix: contract_intelligence_analyses cache ignored the requested language
-- Migration: 20261207_contract_intelligence_generated_lang.sql
--
-- analyzeContract() short-circuits on an unchanged document's sha256 to avoid
-- a redundant OCR + AI pass. Found while verifying RTL/5-language support:
-- that short-circuit had no way to tell "same document, different requested
-- language" from "same document, same language" — so a Persian re-run of an
-- already-analyzed contract silently returned the first (English) run's
-- stored text. Adds generated_lang so the cache hit also requires a language
-- match; a language switch now correctly regenerates.
-- =============================================================================

BEGIN;

ALTER TABLE public.contract_intelligence_analyses
  ADD COLUMN IF NOT EXISTS generated_lang text NOT NULL DEFAULT 'en';

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20261207_contract_intelligence_generated_lang', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
