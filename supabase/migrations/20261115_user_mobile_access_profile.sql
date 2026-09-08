-- ── Mobile access profile on user role assignments ─────────────────────────
--
-- Adds a per-assignment "mobile access profile" so an authorized administrator
-- can, inside the existing Create/Edit User screens, give a user one of two
-- SIMPLIFIED mobile working interfaces on top of their EXISTING user id, login,
-- authentication, scope and permissions:
--
--   standard            → full ERP (unchanged; the default for everyone today)
--   mobile_cash_ledger  → "Brother User": daily cash entry + cash book /
--                          roznamcha / ledger / journal viewing only
--   mobile_field        → "Field User" (Munshi / loading / vehicle check):
--                          only assigned operational forms + assigned jobs
--                          (interface delivered in a later phase)
--
-- This is NOT a new user system, NOT a new role, NOT a new backend. The admin
-- hierarchy (super_admin / country_admin / branch admin / user) and every scope
-- rule are untouched. Server-side enforcement lives in lib/permissions.
--
-- Idempotent and non-destructive.

alter table public.user_role_assignments
  add column if not exists mobile_profile text not null default 'standard';

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'user_role_assignments' and constraint_name = 'user_role_assignments_mobile_profile_chk'
  ) then
    alter table public.user_role_assignments
      add constraint user_role_assignments_mobile_profile_chk
      check (mobile_profile in ('standard', 'mobile_cash_ledger', 'mobile_field'));
  end if;
end $$;

comment on column public.user_role_assignments.mobile_profile is
  'Simplified mobile working interface for this assignment: standard | mobile_cash_ledger (Brother User) | mobile_field (Munshi/field). Reuses the same user id, login, scope and permissions.';

-- Fast lookup of the (rare) mobile users.
create index if not exists user_role_assignments_mobile_profile_idx
  on public.user_role_assignments (mobile_profile)
  where mobile_profile <> 'standard' and is_active = true and deleted_at is null;
