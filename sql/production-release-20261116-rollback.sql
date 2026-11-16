-- ============================================================================
-- ROLLBACK for sql/production-release-20261116.sql
-- Use only if the release must be reverted AFTER the SQL was committed.
-- Restores the account_categories and translation rows from the snapshot tables
-- created by the release (bkp_20261116_*). Keeps daily_usd_rates.carried_forward_from
-- (additive; NULL on every row that was not carried forward).
-- Run as one transaction:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f <this file>
-- ============================================================================

BEGIN;

-- 1. Restore the category rows exactly as they were (names, codes, active flags, S = Staff & Payroll).
UPDATE public.account_categories ac
SET name = b.name,
    description = b.description,
    account_type = b.account_type,
    is_active = b.is_active,
    updated_at = b.updated_at,
    deleted_at = b.deleted_at
FROM public.bkp_20261116_account_categories b
WHERE ac.id = b.id;

-- 2. Soft-remove the P, B and C rows this release inserted (they did not exist before).
UPDATE public.account_categories
SET deleted_at = now(), is_active = false, updated_at = now()
WHERE operational_domain = 'business'
  AND code IN ('P','B','C')
  AND deleted_at IS NULL
  AND id NOT IN (SELECT id FROM public.bkp_20261116_account_categories);

-- 3. Restore the category translation rows exactly as they were.
--    No hard delete: rows this release added are soft-deleted, the rest are put back.
UPDATE public.record_translations rt
SET original_text = b.original_text,
    original_language_code = b.original_language_code,
    english_text = b.english_text,
    urdu_text = b.urdu_text,
    arabic_text = b.arabic_text,
    persian_text = b.persian_text,
    pashto_text = b.pashto_text,
    translation_status = b.translation_status,
    source = b.source,
    translated_by_engine = b.translated_by_engine,
    translated_at = b.translated_at,
    updated_at = b.updated_at,
    deleted_at = b.deleted_at
FROM public.bkp_20261116_record_translations_ac b
WHERE rt.id = b.id;

UPDATE public.record_translations
SET deleted_at = now(), updated_at = now()
WHERE record_table = 'account_categories'
  AND deleted_at IS NULL
  AND id NOT IN (SELECT id FROM public.bkp_20261116_record_translations_ac);

-- 4. Restore the original policies (open read and open all).
DROP POLICY IF EXISTS account_categories_write_super_admin ON public.account_categories;
DROP POLICY IF EXISTS account_categories_read_authenticated ON public.account_categories;

CREATE POLICY account_categories_read_policy ON public.account_categories
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY account_categories_all_policy ON public.account_categories
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Check before commit: S is back to "Staff & Payroll Expenses", 25 active business rows.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.account_categories
   WHERE deleted_at IS NULL AND operational_domain = 'business' AND is_active;
  IF n <> 25 THEN
    RAISE EXCEPTION 'rollback verify failed: expected 25 active business rows, found %', n;
  END IF;
  SELECT count(*) INTO n FROM public.account_categories
   WHERE code = 'S' AND name = 'Staff & Payroll Expenses' AND deleted_at IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'rollback verify failed: S is not restored';
  END IF;
END $$;

COMMIT;

-- After a successful rollback and owner sign-off, the snapshot tables can be dropped:
--   DROP TABLE public.bkp_20261116_account_categories;
--   DROP TABLE public.bkp_20261116_record_translations_ac;
-- Keep them until the release has been stable for at least one business day.
