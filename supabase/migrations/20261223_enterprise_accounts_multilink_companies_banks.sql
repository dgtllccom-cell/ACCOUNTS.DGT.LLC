-- Migration: Add linked_companies and linked_banks jsonb columns to enterprise_accounts
alter table enterprise_accounts
  add column if not exists linked_companies jsonb default '[]'::jsonb,
  add column if not exists linked_banks jsonb default '[]'::jsonb;

insert into erp_schema_migrations (name, status, applied_at)
values ('20261223_enterprise_accounts_multilink_companies_banks', 'applied', now())
on conflict (name) do update set status = excluded.status, applied_at = excluded.applied_at;
