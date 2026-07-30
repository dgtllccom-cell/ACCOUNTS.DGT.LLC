-- =====================================================================
--  LOCATION MANAGEMENT — multilingual backfill for EXISTING rows
--  Run AFTER deploying the write-side integration (locations-repository).
-- ---------------------------------------------------------------------
--  New/updated records now auto-fill name_en/ur/ar/fa/ps via the engine.
--  For rows that existed BEFORE the integration, this ensures name_en is
--  populated so erp_resolve_language_text() always returns a value (it
--  falls back to name_en). FULL 5-language backfill for old rows runs via
--  the JS engine (translateMasterRecordsBatch) — see note at bottom.
-- =====================================================================
BEGIN;

UPDATE public.countries        SET name_en = COALESCE(NULLIF(TRIM(name_en),''), name) WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='');
UPDATE public.states_provinces SET name_en = COALESCE(NULLIF(TRIM(name_en),''), name) WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='');
UPDATE public.districts        SET name_en = COALESCE(NULLIF(TRIM(name_en),''), name) WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='');
UPDATE public.cities           SET name_en = COALESCE(NULLIF(TRIM(name_en),''), name) WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='');
UPDATE public.areas_locations  SET name_en = COALESCE(NULLIF(TRIM(name_en),''), name) WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='');

-- VERIFY: no active location row is missing an English name
SELECT 'countries' t, count(*) missing FROM public.countries        WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='')
UNION ALL SELECT 'states', count(*) FROM public.states_provinces WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='')
UNION ALL SELECT 'districts', count(*) FROM public.districts      WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='')
UNION ALL SELECT 'cities', count(*) FROM public.cities            WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='')
UNION ALL SELECT 'areas', count(*) FROM public.areas_locations    WHERE deleted_at IS NULL AND (name_en IS NULL OR TRIM(name_en)='');  -- all 0

-- COMMIT;
ROLLBACK;  -- <-- change to COMMIT

-- =====================================================================
-- FULL 5-language backfill for existing rows (run once, via the JS engine):
--   For each table, load {id, name} of rows where name_ur/ar/fa/ps are empty
--   and call:
--     await translateMasterRecordsBatch("cities",
--       rows.map(r => ({ recordId: r.id, fieldValues: { name: r.name } })), "en");
--   (translateMasterRecordsBatch is in lib/services/translation-trigger-service.ts)
--   Best exposed as a one-off admin route, e.g. POST /api/erp/admin/backfill-translations?table=cities
-- =====================================================================
