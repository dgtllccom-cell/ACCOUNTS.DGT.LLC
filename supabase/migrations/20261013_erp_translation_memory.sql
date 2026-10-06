-- Migration: 20261013_erp_translation_memory.sql
-- Central 5-language (EN/UR/AR/FA/PS) ERP Translation Memory.
--
-- A phrase-level, reusable store that sits IN FRONT of external MT: once a
-- phrase / business term is translated (and optionally approved) it is served
-- locally forever, consistently, everywhere (DGT Connect, forms, reports,
-- Print/PDF, transactional data).  The original text is never stored as a
-- translation of itself and is never mutated.
--
-- Additive & idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_translation_memory (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- language the source phrase is written in
  source_lang  text NOT NULL CHECK (source_lang IN ('en','ur','ar','fa','ps')),
  -- normalised key for matching: trimmed, whitespace-collapsed, casefolded,
  -- diacritics/tatweel stripped. The human text is kept in source_text.
  source_norm  text NOT NULL,
  source_text  text NOT NULL,
  -- the five renderings (the source language's own column mirrors source_text)
  en           text,
  ur           text,
  ar           text,
  fa           text,
  ps           text,
  -- accounting | shipping | clearing | banking | tax | hr | crm | general
  domain       text NOT NULL DEFAULT 'general',
  -- approved  = human-verified, highest priority
  -- glossary  = curated ERP terminology seed
  -- machine   = produced by the local engine or external MT, reusable but not verified
  -- draft     = pending review
  status       text NOT NULL DEFAULT 'machine'
                 CHECK (status IN ('approved','glossary','machine','draft')),
  engine       text NOT NULL DEFAULT 'local',
  hits         integer NOT NULL DEFAULT 0,
  created_by   uuid,
  approved_by  uuid,
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_lang, source_norm)
);

CREATE INDEX IF NOT EXISTS idx_etm_lookup   ON public.erp_translation_memory (source_lang, source_norm);
CREATE INDEX IF NOT EXISTS idx_etm_status   ON public.erp_translation_memory (status);
CREATE INDEX IF NOT EXISTS idx_etm_domain   ON public.erp_translation_memory (domain);

CREATE OR REPLACE FUNCTION public.etm_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_etm_touch ON public.erp_translation_memory;
CREATE TRIGGER trg_etm_touch BEFORE UPDATE ON public.erp_translation_memory
  FOR EACH ROW EXECUTE FUNCTION public.etm_touch();

-- audit trail for approvals / corrections
CREATE TABLE IF NOT EXISTS public.erp_translation_memory_audit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   uuid REFERENCES public.erp_translation_memory(id) ON DELETE CASCADE,
  actor_id   uuid,
  action     text NOT NULL,
  before     jsonb,
  after      jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261013_erp_translation_memory', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
