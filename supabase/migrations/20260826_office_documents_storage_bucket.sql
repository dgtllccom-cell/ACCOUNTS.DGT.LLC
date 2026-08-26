-- Ensure the central ERP documents bucket exists in Supabase Storage.
insert into storage.buckets (id, name, public)
values ('erp-documents', 'erp-documents', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

-- Documents are uploaded by authenticated ERP sessions through the server route.
-- The bucket stays private; URLs are returned as signed URLs.
drop policy if exists office_documents_bucket_select on storage.objects;
create policy office_documents_bucket_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'erp-documents');

drop policy if exists office_documents_bucket_insert on storage.objects;
create policy office_documents_bucket_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'erp-documents');

drop policy if exists office_documents_bucket_update on storage.objects;
create policy office_documents_bucket_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'erp-documents')
  with check (bucket_id = 'erp-documents');

drop policy if exists office_documents_bucket_delete on storage.objects;
create policy office_documents_bucket_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'erp-documents');
