create table if not exists public.erp_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete no action on update no action,
  country_id uuid references public.countries(id) on delete no action on update no action,
  city_branch_id uuid references public.city_branches(id) on delete no action on update no action,
  name text not null,
  entity_type text not null,
  entity_id uuid not null,
  mime_type text not null,
  size_bytes integer not null,
  uploaded_by uuid not null references public.profiles(id) on delete no action on update no action,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists erp_documents_entity_idx
  on public.erp_documents using btree (entity_type, entity_id);

create table if not exists public.erp_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.erp_documents(id) on delete cascade on update no action,
  version_number integer not null,
  bucket text not null,
  path text not null,
  mime_type text not null,
  size_bytes integer not null,
  uploaded_by uuid not null references public.profiles(id) on delete no action on update no action,
  created_at timestamptz not null default now()
);

create unique index if not exists erp_document_versions_idx
  on public.erp_document_versions using btree (document_id, version_number);
