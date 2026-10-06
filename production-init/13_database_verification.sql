-- =====================================================================
-- DATABASE VERIFICATION (read-only diagnostics)  — Digital Dock ERP
-- =====================================================================
-- Run each section and review the output. Nothing is modified.
-- Purpose: give you an objective picture of FK integrity, indexing, RLS,
-- and orphaned rows so the schema can be signed off. (I cannot query your
-- live database from here, so this is the tool to verify it yourself.)
-- =====================================================================

-- 1. Every foreign key and its ON DELETE / ON UPDATE behaviour.
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 2. Foreign-key columns that are MISSING a supporting index (perf/lock risk).
SELECT c.conrelid::regclass AS table_name,
       a.attname            AS fk_column
FROM pg_constraint c
JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f'
  AND c.connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY (i.indkey)
  )
ORDER BY 1, 2;

-- 3. Tables WITHOUT Row Level Security enabled (review each — some may be intentional).
SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public'
  AND c.relrowsecurity = false
ORDER BY c.relname;

-- 4. RLS policy count per table (0 policies on an RLS-enabled table blocks all access).
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       count(p.polname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity DESC, policy_count ASC, c.relname;

-- 5. Tables missing a primary key (should be none).
SELECT c.relname AS table_without_pk
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE c.relkind = 'r'
  AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p')
ORDER BY c.relname;

-- 6. Orphan-row spot check for the key business tables (should all return 0).
--    Adjust/extend to taste. Uses to_regclass so a missing table is skipped.
DO $chk$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['ledgers','country_id','countries','id'],
    ARRAY['ledger_entries','ledger_id','ledgers','id'],
    ARRAY['journal_lines','journal_entry_id','journal_entries','id'],
    ARRAY['country_company_profiles','country_id','countries','id'],
    ARRAY['country_branches','country_id','countries','id'],
    ARRAY['city_branches','country_branch_id','country_branches','id'],
    ARRAY['user_role_assignments','user_id','profiles','id']
  ];
  r text[]; n bigint;
BEGIN
  FOREACH r SLICE 1 IN ARRAY pairs LOOP
    IF to_regclass('public.'||r[1]) IS NOT NULL AND to_regclass('public.'||r[3]) IS NOT NULL THEN
      EXECUTE format(
        'SELECT count(*) FROM public.%I c WHERE c.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.%I = c.%I)',
        r[1], r[2], r[3], r[4], r[2]
      ) INTO n;
      RAISE NOTICE 'orphans in %.% -> %.% : %', r[1], r[2], r[3], r[4], n;
    END IF;
  END LOOP;
END
$chk$;

-- 7. Branding integrity: every active country should have exactly one company profile.
SELECT co.name AS country,
       count(p.id) FILTER (WHERE p.is_active AND p.deleted_at IS NULL) AS active_profiles
FROM public.countries co
LEFT JOIN public.country_company_profiles p ON p.country_id = co.id
GROUP BY co.name
ORDER BY active_profiles, co.name;   -- rows with 0 or >1 need attention
