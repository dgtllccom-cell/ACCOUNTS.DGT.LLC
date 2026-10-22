-- REVIEW ONLY — NOT APPLIED. Requires owner approval before any Production run.
-- Purpose: remove placeholder column defaults from transit_entries so a transit entry can never be saved with
-- invented agent / country / branch values. The application already requires these fields (POST returns 400 when blank).
-- Existing rows are NOT modified. Verified on DEV first (see verification notes below).

BEGIN;

ALTER TABLE public.transit_entries ALTER COLUMN super_agent DROP DEFAULT;
ALTER TABLE public.transit_entries ALTER COLUMN country DROP DEFAULT;
ALTER TABLE public.transit_entries ALTER COLUMN branch DROP DEFAULT;

COMMIT;

-- Rollback (if ever needed):
--   ALTER TABLE public.transit_entries ALTER COLUMN super_agent SET DEFAULT 'SA-0001';
--   ALTER TABLE public.transit_entries ALTER COLUMN country SET DEFAULT 'PK - Pakistan';
--   ALTER TABLE public.transit_entries ALTER COLUMN branch SET DEFAULT 'CHM - Chaman';

-- Pre-check (read-only): rows that currently use the placeholder values
--   SELECT count(*) FROM public.transit_entries WHERE super_agent = 'SA-0001' OR country = 'PK - Pakistan' OR branch = 'CHM - Chaman';
-- Production currently has 0 transit entries, so the change affects no live business records.
