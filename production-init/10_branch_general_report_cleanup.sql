-- =====================================================================
--  BRANCH GENERAL REPORT — data cleanup (4 countries)
--  Keep: Pakistan, United Arab Emirates, Afghanistan, India
--  Keep: one Main Branch (country level) per country + Super Admin + one
--        Country Admin per country. Remove everything else.
-- ---------------------------------------------------------------------
--  ⚠️  Run on BOTH Local and VPS (same steps) — AFTER a full backup.
--  ⚠️  Claude cannot run this on your DBs. Structure/permissions/APIs are
--      NOT touched — this only soft-deletes DATA rows. Review each PREVIEW,
--      then change ROLLBACK -> COMMIT.
--
--  BACKUP FIRST (both environments):
--    pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d_%H%M).dump
-- =====================================================================


-- STEP 1 — COUNTRIES: keep only the four (soft-delete the rest) --------
BEGIN;
SELECT id, name, iso2 FROM public.countries
WHERE deleted_at IS NULL
  AND iso2 NOT IN ('AE','PK','AF','IN')
  AND name  NOT IN ('United Arab Emirates','Pakistan','Afghanistan','India');   -- PREVIEW to remove

UPDATE public.countries SET deleted_at = now(), is_active = false, updated_at = now()
WHERE deleted_at IS NULL
  AND iso2 NOT IN ('AE','PK','AF','IN')
  AND name  NOT IN ('United Arab Emirates','Pakistan','Afghanistan','India');
ROLLBACK;   -- verify preview, then change to COMMIT


-- STEP 2 — BRANCHES: keep one Main Branch per kept country -------------
--   * remove ALL city branches
--   * remove country branches that are NOT is_main
--   * remove any branch belonging to a non-kept country
BEGIN;
-- PREVIEW country_branches that will be removed:
SELECT cb.id, c.name AS country, cb.name, cb.code, cb.is_main
FROM public.country_branches cb
LEFT JOIN public.countries c ON c.id = cb.country_id
WHERE cb.deleted_at IS NULL
  AND ( cb.is_main IS NOT TRUE
        OR c.iso2 NOT IN ('AE','PK','AF','IN')
        OR c.deleted_at IS NOT NULL );

UPDATE public.country_branches cb SET deleted_at = now(), status = 'inactive', updated_at = now()
WHERE cb.deleted_at IS NULL
  AND ( cb.is_main IS NOT TRUE
        OR cb.country_id NOT IN (SELECT id FROM public.countries
                                 WHERE iso2 IN ('AE','PK','AF','IN') AND deleted_at IS NULL) );

-- Remove ALL city branches (report keeps country-level main branches only):
UPDATE public.city_branches SET deleted_at = now(), status = 'inactive', updated_at = now()
WHERE deleted_at IS NULL;

-- Legacy branches table, if used:
UPDATE public.branches SET deleted_at = now(), updated_at = now() WHERE deleted_at IS NULL;
ROLLBACK;   -- verify, then COMMIT


-- STEP 3 — USERS: keep Super Admin + one Country Admin per kept country -
--   Rule-based (no manual list needed). Verify the PREVIEW carefully.
BEGIN;
WITH keep AS (
  -- oldest super_admin
  SELECT ura.user_id
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  WHERE r.name = 'super_admin'
  ORDER BY ura.created_at ASC
  LIMIT 1
  UNION
  -- oldest country_admin per KEPT country
  SELECT DISTINCT ON (ura.country_id) ura.user_id
  FROM public.user_role_assignments ura
  JOIN public.roles r ON r.id = ura.role_id
  JOIN public.countries c ON c.id = ura.country_id
  WHERE r.name = 'country_admin'
    AND c.iso2 IN ('AE','PK','AF','IN') AND c.deleted_at IS NULL
  ORDER BY ura.country_id, ura.created_at ASC
)
SELECT u.id, u.email, p.full_name
FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.id NOT IN (SELECT user_id FROM keep)
ORDER BY u.email;   -- PREVIEW users that will be removed
-- >>> Confirm your roles.name values ('super_admin','country_admin') match your DB.
-- >>> After verifying the preview, delete role rows then the auth users:
--   DELETE FROM public.user_role_assignments WHERE user_id NOT IN (SELECT user_id FROM keep);
--   DELETE FROM public.memberships          WHERE user_id NOT IN (SELECT user_id FROM keep);
--   DELETE FROM auth.users u                WHERE u.id     NOT IN (SELECT user_id FROM keep);
ROLLBACK;   -- keep as ROLLBACK until preview is confirmed, then run the DELETEs in a COMMIT block


-- STEP 4 — VERIFY the Branch General Report source data ----------------
SELECT count(*) AS active_countries FROM public.countries WHERE deleted_at IS NULL;             -- expect 4
SELECT c.name, count(cb.*) AS main_branches
FROM public.countries c
LEFT JOIN public.country_branches cb ON cb.country_id = c.id AND cb.deleted_at IS NULL AND cb.is_main
WHERE c.deleted_at IS NULL GROUP BY c.name ORDER BY c.name;                                     -- 1 each
SELECT count(*) AS active_city_branches FROM public.city_branches WHERE deleted_at IS NULL;      -- expect 0
SELECT count(*) AS remaining_users FROM auth.users;                                             -- expect 5 (1 super + 4 country admins)

-- The Branch General Report (/dashboard/branch-management/general-report) reads
-- these tables live, so it refreshes automatically once the above is committed.
