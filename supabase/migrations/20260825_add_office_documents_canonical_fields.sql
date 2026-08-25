alter table public.office_documents
  add column if not exists document_type character varying(120),
  add column if not exists source_module character varying(120),
  add column if not exists source_record_id uuid,
  add column if not exists source_record_no character varying(120),
  add column if not exists person_account_id uuid,
  add column if not exists person_account_code character varying(120),
  add column if not exists person_account_name character varying(255),
  add column if not exists document_path text,
  add column if not exists storage_key text,
  add column if not exists scanner_device_name character varying(255),
  add column if not exists scanner_bridge character varying(120);

create index if not exists idx_office_documents_person_account
  on public.office_documents using btree (person_account_id, person_account_code, source_record_no);

create index if not exists idx_office_documents_source_context
  on public.office_documents using btree (source_module, document_type, storage_key);
