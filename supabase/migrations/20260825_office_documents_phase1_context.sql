alter table public.office_documents
  add column if not exists company_id uuid,
  add column if not exists company_code character varying(120),
  add column if not exists company_name character varying(255),
  add column if not exists account_id uuid,
  add column if not exists account_code character varying(120),
  add column if not exists account_name character varying(255),
  add column if not exists person_account_type character varying(80);

create index if not exists idx_office_documents_company
  on public.office_documents using btree (company_id, company_code, company_name);

create index if not exists idx_office_documents_account
  on public.office_documents using btree (account_id, account_code, account_name);

create index if not exists idx_office_documents_person_type
  on public.office_documents using btree (person_account_type);
