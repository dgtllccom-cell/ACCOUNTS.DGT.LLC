-- =====================================================================
-- USER ACCESS REPORT  (Digital Dock ERP)
-- =====================================================================
-- Read-only. Lists every user, their role, status, and the country /
-- branch they are scoped to. Passwords are NEVER selected (Supabase
-- stores only a salted hash in auth.users.encrypted_password, which this
-- query does not touch). Safe to run any time.
--
-- Columns: Country | User | Email | Role | Status | Assigned Country |
--          Assigned Branch | Assigned On
-- =====================================================================

SELECT
  COALESCE(co.name, '(Global / All countries)')            AS country,
  p.full_name                                              AS user_name,
  au.email                                                 AS email,
  ura.role                                                 AS role,
  CASE WHEN ura.is_active THEN 'Active' ELSE 'Inactive' END AS status,
  COALESCE(co.name, '(Global)')                            AS assigned_country,
  COALESCE(cb.name, cbr.name, '(Country-wide)')            AS assigned_branch,
  ura.created_at                                           AS assigned_on
FROM public.user_role_assignments ura
JOIN public.profiles          p   ON p.id   = ura.user_id
LEFT JOIN auth.users          au  ON au.id  = p.id
LEFT JOIN public.countries    co  ON co.id  = ura.country_id
LEFT JOIN public.country_branches cbr ON cbr.id = ura.country_branch_id
LEFT JOIN public.city_branches    cb  ON cb.id  = ura.city_branch_id
ORDER BY
  (ura.role = 'super_admin') DESC,   -- super admin first
  co.name NULLS FIRST,
  ura.role,
  p.full_name;

-- Quick summary: how many users per role (should be 1 super_admin + 4 country_admin after cleanup)
--   SELECT ura.role, count(DISTINCT ura.user_id) AS users
--     FROM public.user_role_assignments ura
--    WHERE ura.is_active
--    GROUP BY ura.role
--    ORDER BY ura.role;
