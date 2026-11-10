-- Public invoice links (QR codes on printed invoices).
-- One row per link: a random token plus a saved snapshot of the exact invoice that was printed.
-- Read and written only by the server (service role). RLS is enabled with NO policies,
-- so browser clients (anon/authenticated keys) cannot read or write this table.
-- Revoke a link by setting revoked_at. Nothing existing is changed.

create table if not exists public.public_document_links (
  token          text primary key,
  document_type  text not null default '',
  doc_no         text not null default '',
  template_id    text not null default 'classic',
  color_id       text,
  flags          jsonb not null default '{}'::jsonb,
  snapshot       jsonb not null,
  created_by     text,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

comment on table public.public_document_links is
  'Public, no-login links to printed invoices (QR codes). Token = 192-bit random. Server-only access.';

create index if not exists public_document_links_created_at_idx
  on public.public_document_links (created_at desc);

alter table public.public_document_links enable row level security;

revoke all on public.public_document_links from anon, authenticated;
