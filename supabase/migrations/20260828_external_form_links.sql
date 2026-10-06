-- =============================================================================
-- Migration: 20260828_external_form_links
-- Purpose  : Token-based secure external form sharing
--            Staff generate unique links → external users fill forms → data
--            flows into the existing ERP tables without creating duplicate forms
-- =============================================================================

-- ── 1. Main table ─────────────────────────────────────────────────────────────
create table if not exists external_form_links (
  id             uuid         primary key default gen_random_uuid(),
  token          text         unique not null default replace(gen_random_uuid()::text, '-', ''),
  form_type      text         not null check (form_type in ('customer','employee','company','agent')),
  status         text         not null default 'active'
                              check (status in ('active','used','expired','revoked')),
  -- who created it
  created_by     uuid,        -- references auth.users(id) — soft ref to avoid FK issues on self-hosted
  created_by_name text,
  country_id     uuid,
  country_branch_id uuid,
  city_branch_id uuid,
  -- timing
  created_at     timestamptz  not null default now(),
  expires_at     timestamptz,
  -- submission tracking
  submitted_at   timestamptz,
  submitted_record_id uuid,
  submission_data jsonb,
  -- optional metadata
  notes          text,
  updated_at     timestamptz  not null default now()
);

-- ── 2. Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_external_form_links_token        on external_form_links (token);
create index if not exists idx_external_form_links_created_by   on external_form_links (created_by);
create index if not exists idx_external_form_links_status       on external_form_links (status);
create index if not exists idx_external_form_links_form_type    on external_form_links (form_type);
create index if not exists idx_external_form_links_created_at   on external_form_links (created_at desc);

-- ── 3. Auto-expire trigger ─────────────────────────────────────────────────────
-- Marks links as 'expired' in-place when queried after their expires_at time.
-- This is done at query time in the API, not via a background job, to keep
-- things simple and serverless-friendly.

-- ── 4. Verification ───────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_name = 'external_form_links'
  ) then
    raise notice 'external_form_links table created successfully';
  else
    raise exception 'external_form_links table not found after migration';
  end if;
end $$;
