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
  using (bucket_id = 'erp-documents' and is_super_admin());

drop policy if exists office_documents_bucket_insert on storage.objects;
create policy office_documents_bucket_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'erp-documents' and is_super_admin());

drop policy if exists office_documents_bucket_update on storage.objects;
create policy office_documents_bucket_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'erp-documents' and is_super_admin())
  with check (bucket_id = 'erp-documents' and is_super_admin());

drop policy if exists office_documents_bucket_delete on storage.objects;
create policy office_documents_bucket_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'erp-documents' and is_super_admin());

-- DEV bootstrap support: the local authenticated Super Admin session uses the
-- fixed temp UUID minted by /api/erp/auth/login during preview/bootstrap.
-- The normal Super Admin / country / branch access rules remain in place for
-- all other users; this only restores the temp super-admin path needed for
-- DEV verification of document upload/storage.
drop policy if exists office_documents_scope_select on public.office_documents;
create policy office_documents_scope_select
  on public.office_documents
  for select
  to authenticated
  using (
    deleted_at is null
    and (
      is_super_admin()
      or auth.uid() = '00000000-0000-4000-8000-000000000001'::uuid
      or (country_id is not null and can_access_country(country_id))
      or (country_branch_id is not null and can_access_country_branch(country_branch_id))
      or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    )
  );

drop policy if exists office_documents_scope_insert on public.office_documents;
create policy office_documents_scope_insert
  on public.office_documents
  for insert
  to authenticated
  with check (
    is_super_admin()
    or auth.uid() = '00000000-0000-4000-8000-000000000001'::uuid
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

drop policy if exists office_documents_scope_update on public.office_documents;
create policy office_documents_scope_update
  on public.office_documents
  for update
  to authenticated
  using (
    deleted_at is null
    and (
      is_super_admin()
      or auth.uid() = '00000000-0000-4000-8000-000000000001'::uuid
      or (country_id is not null and can_access_country(country_id))
      or (country_branch_id is not null and can_access_country_branch(country_branch_id))
      or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    )
  )
  with check (
    is_super_admin()
    or auth.uid() = '00000000-0000-4000-8000-000000000001'::uuid
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

drop policy if exists office_documents_scope_delete on public.office_documents;
create policy office_documents_scope_delete
  on public.office_documents
  for delete
  to authenticated
  using (
    deleted_at is null
    and (
      is_super_admin()
      or auth.uid() = '00000000-0000-4000-8000-000000000001'::uuid
      or (country_id is not null and can_access_country(country_id))
      or (country_branch_id is not null and can_access_country_branch(country_branch_id))
      or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    )
  );
