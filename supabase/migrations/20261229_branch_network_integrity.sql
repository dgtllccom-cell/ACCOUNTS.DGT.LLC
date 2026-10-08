-- Branch & Network integrity
-- 1. Soft-deleting a branch deactivates the role assignments bound to it (no user/profile/financial deletes).
-- 2. One-time repair of orphan assignments, orphan parents and stale employee branch links.
-- 3. Permanent duplicate prevention at the database level (partial unique indexes on live rows).
-- Additive and non-destructive: rows are only soft-deactivated, never deleted.

-- ---------------------------------------------------------------------------
-- 1. Cascade: branch soft-delete -> assignments inactive
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_city_branch_soft_delete_cascade()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.user_role_assignments
       SET is_active = false, deleted_at = COALESCE(deleted_at, now()), updated_at = now()
     WHERE city_branch_id = NEW.id
       AND (is_active IS DISTINCT FROM false OR deleted_at IS NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_city_branch_soft_delete_cascade ON public.city_branches;
CREATE TRIGGER trg_city_branch_soft_delete_cascade
  AFTER UPDATE OF deleted_at ON public.city_branches
  FOR EACH ROW EXECUTE FUNCTION public.fn_city_branch_soft_delete_cascade();

CREATE OR REPLACE FUNCTION public.fn_country_branch_soft_delete_cascade()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.user_role_assignments
       SET is_active = false, deleted_at = COALESCE(deleted_at, now()), updated_at = now()
     WHERE country_branch_id = NEW.id
       AND city_branch_id IS NULL
       AND (is_active IS DISTINCT FROM false OR deleted_at IS NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_country_branch_soft_delete_cascade ON public.country_branches;
CREATE TRIGGER trg_country_branch_soft_delete_cascade
  AFTER UPDATE OF deleted_at ON public.country_branches
  FOR EACH ROW EXECUTE FUNCTION public.fn_country_branch_soft_delete_cascade();

-- ---------------------------------------------------------------------------
-- 2. One-time repair
-- ---------------------------------------------------------------------------
-- 2a. Assignments still active on a deleted city/country branch (e.g. "Chaman City Admin").
UPDATE public.user_role_assignments ura
   SET is_active = false, deleted_at = COALESCE(ura.deleted_at, now()), updated_at = now()
 WHERE (ura.is_active IS DISTINCT FROM false OR ura.deleted_at IS NULL)
   AND (
     EXISTS (SELECT 1 FROM public.city_branches cb WHERE cb.id = ura.city_branch_id AND cb.deleted_at IS NOT NULL)
     OR (ura.city_branch_id IS NULL AND EXISTS (
          SELECT 1 FROM public.country_branches mb WHERE mb.id = ura.country_branch_id AND mb.deleted_at IS NOT NULL))
   );

-- 2b. Live city branches whose parent main branch is deleted -> re-parent to a live main branch of the
--     same country (same operational domain preferred).
UPDATE public.city_branches cb
   SET country_branch_id = (
         SELECT mb.id FROM public.country_branches mb
          WHERE mb.country_id = cb.country_id AND mb.is_main = true AND mb.deleted_at IS NULL
          ORDER BY (mb.operational_domain IS NOT DISTINCT FROM cb.operational_domain) DESC, mb.created_at
          LIMIT 1),
       updated_at = now()
 WHERE cb.deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM public.country_branches d WHERE d.id = cb.country_branch_id AND d.deleted_at IS NOT NULL)
   AND EXISTS (SELECT 1 FROM public.country_branches mb WHERE mb.country_id = cb.country_id AND mb.is_main = true AND mb.deleted_at IS NULL);

-- 2c. Keep live city-branch assignments pointing at their branch's (possibly re-parented) main branch.
UPDATE public.user_role_assignments ura
   SET country_branch_id = cb.country_branch_id, updated_at = now()
  FROM public.city_branches cb
 WHERE ura.city_branch_id = cb.id
   AND cb.deleted_at IS NULL
   AND ura.is_active IS NOT DISTINCT FROM true AND ura.deleted_at IS NULL
   AND ura.country_branch_id IS DISTINCT FROM cb.country_branch_id
   AND cb.country_branch_id IS NOT NULL;

-- 2d. Employees still linked to a deleted branch lose the stale link (employee record is kept).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='city_branch_id') THEN
    UPDATE public.employees e
       SET city_branch_id = NULL
     WHERE e.city_branch_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.city_branches cb WHERE cb.id = e.city_branch_id AND cb.deleted_at IS NOT NULL);
  END IF;
END $$;

-- 2e. Generic "Country Main Branch" name becomes "<Country> Country Main Branch".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='countries' AND column_name='name') THEN
    UPDATE public.country_branches mb
       SET name = c.name || ' Country Main Branch', updated_at = now()
      FROM public.countries c
     WHERE c.id = mb.country_id AND mb.is_main = true AND mb.deleted_at IS NULL
       AND mb.name = 'Country Main Branch';
  END IF;
END $$;

-- 2f. Collapse pre-existing duplicate live assignments (keep the oldest; the rest are soft-deactivated).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, role,
                        COALESCE(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        COALESCE(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        COALESCE(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        COALESCE(operational_domain, '')
           ORDER BY created_at, id) AS rn
    FROM public.user_role_assignments
   WHERE is_active IS NOT DISTINCT FROM true AND deleted_at IS NULL
)
UPDATE public.user_role_assignments ura
   SET is_active = false, deleted_at = now(), updated_at = now()
  FROM ranked r WHERE r.id = ura.id AND r.rn > 1;

-- 2g. Collapse duplicate admins for one scope (one Country/Main/Branch Admin per scope + domain; oldest wins).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY role,
                        COALESCE(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        COALESCE(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        COALESCE(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        COALESCE(operational_domain, '')
           ORDER BY created_at, id) AS rn
    FROM public.user_role_assignments
   WHERE is_active IS NOT DISTINCT FROM true AND deleted_at IS NULL
     AND role IN ('country_admin', 'main_branch_admin', 'city_branch_admin', 'branch_admin')
)
UPDATE public.user_role_assignments ura
   SET is_active = false, deleted_at = now(), updated_at = now()
  FROM ranked r WHERE r.id = ura.id AND r.rn > 1;

-- ---------------------------------------------------------------------------
-- 3. Permanent duplicate prevention (live rows only; archived rows keep their history)
-- ---------------------------------------------------------------------------
-- One live branch per country + city + operational domain (is_business_branch is a legacy flag, not part of the key).
CREATE UNIQUE INDEX IF NOT EXISTS city_branches_country_city_domain_idx
  ON public.city_branches (country_id, lower(btrim(city_name)), COALESCE(operational_domain, 'business'))
  WHERE deleted_at IS NULL;

-- The same user cannot hold the same role in the same scope twice.
CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_live_scope_idx
  ON public.user_role_assignments (
    user_id, role,
    COALESCE(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(operational_domain, ''))
  WHERE is_active IS NOT DISTINCT FROM true AND deleted_at IS NULL;

-- Only one Country / Main-Branch / City-Branch Admin per scope + domain.
CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_one_admin_per_scope_idx
  ON public.user_role_assignments (
    role,
    COALESCE(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(operational_domain, ''))
  WHERE is_active IS NOT DISTINCT FROM true AND deleted_at IS NULL
    AND role IN ('country_admin', 'main_branch_admin', 'city_branch_admin', 'branch_admin');

COMMENT ON INDEX public.city_branches_country_city_domain_idx IS
  'Branch & Network integrity: one live branch per country+city+operational domain.';
