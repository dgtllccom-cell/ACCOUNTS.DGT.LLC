-- Enterprise ERP/FMS: Branch form metadata persistence
-- Persist company/owner/contact/document details from branch entry forms.
-- Safe to re-run: uses IF NOT EXISTS.

alter table branches
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists country_id uuid references countries(id),
  add column if not exists state_province_id uuid references states_provinces(id),
  add column if not exists city_id uuid references cities(id),
  add column if not exists currency text,
  add column if not exists owner_name text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists documents jsonb not null default '[]'::jsonb;

create index if not exists branches_super_admin_idx
  on branches (is_super_admin)
  where deleted_at is null and is_super_admin = true;

alter table country_branches
  add column if not exists company_id uuid references companies(id),
  add column if not exists owner_name text,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists documents jsonb not null default '[]'::jsonb;

alter table city_branches
  add column if not exists company_id uuid references companies(id),
  add column if not exists owner_name text,
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists documents jsonb not null default '[]'::jsonb;

