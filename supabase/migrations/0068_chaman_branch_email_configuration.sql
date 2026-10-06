begin;

insert into erp_schema_migrations (name, status)
values ('0068_chaman_branch_email_configuration', 'running')
on conflict (name) do update set status = excluded.status, applied_at = now();

-- 1. Ensure provider exists for dgt.llc
insert into erp_email_providers (provider_name, provider_type, domain, security_mode, settings)
select 'DGT Self Hosted Mail', 'self_hosted', 'dgt.llc', 'tls', '{"notes":"Default official self-hosted email provider"}'::jsonb
where not exists (
  select 1 from erp_email_providers where lower(domain) = 'dgt.llc' and deleted_at is null
);

-- 2. Configure asmat@dgt.llc for Chaman Branch
with prov as (
  select id from erp_email_providers where domain = 'dgt.llc' and deleted_at is null order by created_at asc limit 1
),
chaman as (
  select id, country_id, country_branch_id from city_branches
  where (code = 'PAK-PKBA-001' or name ilike '%Chaman%') and deleted_at is null order by created_at asc limit 1
)
insert into erp_email_accounts (
  provider_id,
  country_id,
  country_branch_id,
  city_branch_id,
  scope,
  display_name,
  email_address,
  reply_to,
  admin_email,
  is_default,
  is_active,
  settings
)
select
  prov.id,
  chaman.country_id,
  chaman.country_branch_id,
  chaman.id,
  'city_branch',
  'Asmat & Brothers - Chaman Branch',
  'asmat@dgt.llc',
  'asmat@dgt.llc',
  'asmat@dgt.llc',
  true,
  true,
  '{"smtpHost":"smtp.gmail.com","smtpPort":465,"smtpSecure":true,"smtpUser":"asmat@dgt.llc","smtpPass":"dgtchamanapppassword"}'::jsonb
from prov, chaman
on conflict (lower(email_address)) where deleted_at is null do update set
  city_branch_id = excluded.city_branch_id,
  country_branch_id = excluded.country_branch_id,
  country_id = excluded.country_id,
  scope = 'city_branch',
  is_active = true,
  is_default = true,
  settings = excluded.settings,
  updated_at = now();

update erp_schema_migrations
set status = 'applied', applied_at = now()
where name = '0068_chaman_branch_email_configuration';

commit;
