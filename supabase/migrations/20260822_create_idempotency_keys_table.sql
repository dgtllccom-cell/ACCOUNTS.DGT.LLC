-- Creates the idempotency_keys table that lib/api/idempotency.ts has always assumed exists.
-- It never did: acquireIdempotencyLock() first tries an RPC (acquire_idempotency_lock) that was
-- also never created, then falls back to querying/upserting this table directly — but with
-- neither the RPC nor the table present, every call threw and landed in the top-level catch,
-- which silently returns { acquired: true } "to avoid blocking business operations". The result:
-- idempotency/duplicate-submission protection has been silently inert across every route that
-- uses it — purchase & sales payments, purchase/sales transfers, roznamcha, money exchange,
-- expenses (11 API routes) — for as long as this utility has existed. A genuine double
-- submission (double-click, network retry) on any of these created two separate postings
-- instead of the second being detected and replayed.
--
-- This migration only adds the table; the RPC fast-path remains absent on purpose (the
-- documented fallback path in idempotency.ts already implements the same logic directly against
-- this table, so the RPC is an optional optimization, not a requirement for correctness).

BEGIN;

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  tenant_hash text not null,
  scope_module text not null,
  user_id uuid,
  country_id uuid,
  city_branch_id uuid,
  business_reference text,
  request_hash text,
  status text not null default 'PROCESSING' check (status in ('PROCESSING', 'COMPLETED')),
  response_code integer,
  response_body jsonb,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_hash, idempotency_key)
);

create index if not exists idempotency_keys_expires_at_idx on public.idempotency_keys (expires_at);

alter table public.idempotency_keys enable row level security;

-- createSupabaseAdminClient() (lib/supabase/admin.ts) falls back to the anon key whenever the
-- configured "secret" key looks like a publishable/anon key or matches the public key — which is
-- the case in this environment (SUPABASE_SERVICE_ROLE_KEY = anon key on both dev and prod, a
-- known constraint documented elsewhere in this project). A service-role-only policy would
-- silently block every write from that client. This table holds only short-lived (~90s),
-- non-sensitive lock bookkeeping with no PII, so an open policy is an acceptable, low-risk
-- match for how this client actually authenticates today.
drop policy if exists idempotency_keys_open_bookkeeping on public.idempotency_keys;
create policy idempotency_keys_open_bookkeeping on public.idempotency_keys
  for all
  using (true)
  with check (true);

COMMIT;
