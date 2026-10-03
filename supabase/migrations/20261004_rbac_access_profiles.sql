-- RBAC: access profiles ("operational role"), shipping-line binding and effective dates on role assignments.
--
-- The role (app_role) keeps deciding the SCOPE LEVEL (global / country / main branch / city branch).
-- The new access_profile decides WHAT that scope may do:
--   NULL            standard role template (unchanged behaviour for every existing user)
--   'operations'    operational modules only (shipments, routes, loading, transit, customs, BL/containers, vehicles,
--                   warehouses, tasks) — never Finance / bank / payroll / ledgers
--   'shipping_line' shipping-line modules only (bookings, BL, containers, vessels, ports, tracking, documents),
--                   bound to a shipping line company when shipping_line_id is set
--
-- Examples: super_admin + operations = Global Operations Admin; country_admin + operations = Country Operations Admin;
--           city_branch_admin + operations = City Branch Operations Admin; country/main/city admin + shipping_line =
--           Shipping Line Admin; agent_user/staff + shipping_line = Branch Shipping Line User.
-- A user may hold several assignment rows (e.g. a Country Admin row plus a Finance row for one branch); the effective
-- access is the union of (permissions x scope) PER ROW, never the highest of everything.
--
-- Production: apply only after owner approval (DDL).

BEGIN;

ALTER TABLE public.user_role_assignments ADD COLUMN IF NOT EXISTS access_profile text;
ALTER TABLE public.user_role_assignments ADD COLUMN IF NOT EXISTS shipping_line_id uuid REFERENCES public.shipping_lines(id);
ALTER TABLE public.user_role_assignments ADD COLUMN IF NOT EXISTS effective_from date;
ALTER TABLE public.user_role_assignments ADD COLUMN IF NOT EXISTS effective_to date;
-- Warehouses this assignment is limited to (empty / NULL = every warehouse inside the assignment's scope).
ALTER TABLE public.user_role_assignments ADD COLUMN IF NOT EXISTS warehouse_ids uuid[];

ALTER TABLE public.user_role_assignments DROP CONSTRAINT IF EXISTS user_role_assignments_access_profile_chk;
ALTER TABLE public.user_role_assignments
  ADD CONSTRAINT user_role_assignments_access_profile_chk CHECK (access_profile IS NULL OR access_profile IN ('operations', 'shipping_line'));

ALTER TABLE public.user_role_assignments DROP CONSTRAINT IF EXISTS user_role_assignments_effective_dates_chk;
ALTER TABLE public.user_role_assignments
  ADD CONSTRAINT user_role_assignments_effective_dates_chk CHECK (effective_from IS NULL OR effective_to IS NULL OR effective_from <= effective_to);

-- a shipping line can only be bound to a shipping-line profile
ALTER TABLE public.user_role_assignments DROP CONSTRAINT IF EXISTS user_role_assignments_shipping_line_chk;
ALTER TABLE public.user_role_assignments
  ADD CONSTRAINT user_role_assignments_shipping_line_chk CHECK (shipping_line_id IS NULL OR access_profile = 'shipping_line');

CREATE INDEX IF NOT EXISTS user_role_assignments_profile_idx ON public.user_role_assignments (access_profile) WHERE access_profile IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS user_role_assignments_shipping_line_idx ON public.user_role_assignments (shipping_line_id) WHERE shipping_line_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.user_role_assignments.access_profile IS
  'NULL = standard role template; operations = operational modules only; shipping_line = shipping-line modules only. The role still decides the scope level.';

COMMIT;
