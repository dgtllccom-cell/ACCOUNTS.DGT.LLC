begin;

insert into erp_schema_migrations (name, status)
values ('0067_country_email_configuration_defaults', 'running')
on conflict (name) do update set status = excluded.status, applied_at = now();

update countries
set
  official_email = 'Asmatandbrothers@gmail.com',
  admin_email = coalesce(admin_email, 'Asmatandbrothers@gmail.com'),
  email_domain = 'gmail.com',
  email_server_settings = coalesce(email_server_settings, '{}'::jsonb) ||
    jsonb_build_object(
      'officeName', 'Asmat & Brothers',
      'signatureName', 'Asmat & Brothers',
      'defaultFromName', 'Asmat & Brothers'
    )
where lower(coalesce(name, '')) in ('pakistan', 'islamic republic of pakistan')
   or upper(coalesce(iso2, '')) = 'PK'
   or upper(coalesce(iso3, '')) = 'PAK';

update countries
set
  official_email = 'Dgt.llc.com@gmail.com',
  admin_email = coalesce(admin_email, 'Dgt.llc.com@gmail.com'),
  email_domain = 'gmail.com',
  email_server_settings = coalesce(email_server_settings, '{}'::jsonb) ||
    jsonb_build_object(
      'officeName', 'DGT LLC',
      'signatureName', 'DGT LLC',
      'defaultFromName', 'DGT LLC'
    )
where lower(coalesce(name, '')) in ('united arab emirates', 'uae')
   or upper(coalesce(iso2, '')) = 'AE'
   or upper(coalesce(iso3, '')) = 'ARE';

insert into erp_email_providers (provider_name, provider_type, domain, security_mode, settings)
select 'Gmail / Google Workspace', 'smtp', 'gmail.com', 'tls', '{"notes":"Country official Gmail / Workspace accounts"}'::jsonb
where not exists (
  select 1 from erp_email_providers where lower(domain) = 'gmail.com' and deleted_at is null
);

with provider as (
  select id from erp_email_providers
  where lower(domain) = 'gmail.com' and deleted_at is null
  order by created_at asc
  limit 1
),
country_accounts as (
  select
    c.id as country_id,
    c.official_email,
    coalesce(c.email_server_settings->>'officeName', c.name) as display_name,
    c.admin_email,
    c.email_server_settings
  from countries c
  where c.official_email in ('Asmatandbrothers@gmail.com', 'Dgt.llc.com@gmail.com')
)
insert into erp_email_accounts (
  provider_id,
  country_id,
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
  provider.id,
  country_accounts.country_id,
  'country',
  country_accounts.display_name,
  country_accounts.official_email,
  country_accounts.official_email,
  country_accounts.admin_email,
  true,
  true,
  coalesce(country_accounts.email_server_settings, '{}'::jsonb)
from provider
cross join country_accounts
where not exists (
  select 1 from erp_email_accounts e
  where lower(e.email_address) = lower(country_accounts.official_email)
    and e.deleted_at is null
);

update erp_email_accounts e
set
  country_id = c.id,
  scope = 'country',
  display_name = coalesce(c.email_server_settings->>'officeName', c.name),
  reply_to = c.official_email,
  admin_email = c.admin_email,
  is_default = true,
  is_active = true,
  settings = coalesce(e.settings, '{}'::jsonb) || coalesce(c.email_server_settings, '{}'::jsonb),
  updated_at = now()
from countries c
where lower(e.email_address) = lower(c.official_email)
  and c.official_email in ('Asmatandbrothers@gmail.com', 'Dgt.llc.com@gmail.com')
  and e.deleted_at is null;

update erp_schema_migrations
set status = 'applied', applied_at = now()
where name = '0067_country_email_configuration_defaults';

commit;

