-- Enterprise ERP/FMS: User identity (user_code) + user permission set storage
-- Safe additive migration: does not remove/alter existing foundation tables beyond adding nullable columns.

-- 1) User Code (User ID) stored on profiles for fast lookup and User-ID login support
alter table profiles
  add column if not exists user_code text;

create unique index if not exists profiles_user_code_unique_idx
  on profiles (user_code)
  where deleted_at is null and user_code is not null;

-- 2) User permission sets (role default + optional overrides)
create table if not exists user_permission_sets (
  user_id uuid primary key references profiles(id) on delete cascade,
  permissions text[] not null default '{}'::text[],
  source text not null default 'role_default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table user_permission_sets enable row level security;

-- Users can read their own permission set; Super Admin can read all.
create policy user_permission_sets_read
  on user_permission_sets
  for select
  using (is_super_admin() or auth.uid() = user_id);

-- Only Super Admin can manage permission sets for now (enterprise safety default).
create policy user_permission_sets_write
  on user_permission_sets
  for all
  using (is_super_admin())
  with check (is_super_admin());

