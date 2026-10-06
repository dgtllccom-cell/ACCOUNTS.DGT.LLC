begin;

insert into erp_schema_migrations (name, status)
values ('0069_update_chaman_branch_email', 'running')
on conflict (name) do update set status = excluded.status, applied_at = now();

-- 1. Update the email column in city_branches for Chaman branch
update city_branches
set email = 'dgtllc@dgt.llc'
where (code = 'PAK-PKBA-001' or name ilike '%Chaman%') and deleted_at is null;

-- 2. Update the email_address in erp_email_accounts for Chaman branch
with chaman as (
  select id from city_branches
  where (code = 'PAK-PKBA-001' or name ilike '%Chaman%') and deleted_at is null order by created_at asc limit 1
)
update erp_email_accounts
set 
  email_address = 'dgtllc@dgt.llc',
  reply_to = 'dgtllc@dgt.llc',
  admin_email = 'dgtllc@dgt.llc',
  settings = jsonb_set(
    jsonb_set(settings, '{smtpUser}', '"dgtllc@dgt.llc"'),
    '{smtpPass}',
    '"dgtchamanapppassword"'
  )
where city_branch_id = (select id from chaman) and deleted_at is null;

update erp_schema_migrations
set status = 'applied', applied_at = now()
where name = '0069_update_chaman_branch_email';

commit;
