-- Adds a self-service "must change password on next login" flag to profiles.
-- Additive only - no existing column, formula, or RBAC data touched.
-- Used by app/dashboard/layout.tsx (redirect gate) and the
-- /auth/set-new-password self-service flow (features/auth/actions.ts).
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
