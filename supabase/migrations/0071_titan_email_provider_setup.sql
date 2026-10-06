-- Migration: Register Hostinger Titan Email provider and 5 mailboxes
-- Purpose: Set up the complete email infrastructure for DGT operations
-- Credentials: Read from environment variables (MAILBOX_*_PASSWORD), never stored in DB

-- Insert Hostinger/Titan Email Provider if not already present
insert into erp_email_providers (provider_name, provider_type, domain, smtp_host, smtp_port, imap_host, imap_port, security_mode, settings)
values (
  'Hostinger Titan Email',
  'self_hosted',
  'dgt.llc',
  'smtp.titan.email',
  465,
  'imap.titan.email',
  993,
  'ssl',
  '{
    "verified": true,
    "endpoint_standard": "smtp.titan.email:465 SSL/TLS, imap.titan.email:993 SSL/TLS",
    "notes": "Verified Hostinger Titan standard endpoints (not EU-specific)"
  }'::jsonb
)
on conflict (lower(domain)) do update
  set smtp_host = excluded.smtp_host,
      smtp_port = excluded.smtp_port,
      imap_host = excluded.imap_host,
      imap_port = excluded.imap_port,
      security_mode = excluded.security_mode,
      settings = excluded.settings;

-- Get the Titan provider ID for the inserts below
create temp table temp_titan_provider as
  select id from erp_email_providers
  where domain = 'dgt.llc' and provider_name = 'Hostinger Titan Email'
  limit 1;

-- Register 5 mailboxes in erp_email_accounts
-- Each uses environment variables for auth (read by getTitanTransporter)
-- Scope: all are super_admin accessible; can be scoped to branches later
insert into erp_email_accounts (
  provider_id,
  email_address,
  display_name,
  scope,
  is_active,
  is_default,
  settings,
  cc_super_admin,
  cc_country_admin
)
select
  tp.id as provider_id,
  mailbox.email,
  mailbox.display_name,
  'super_admin' as scope,
  true as is_active,
  mailbox.is_default,
  '{}'::jsonb as settings,
  true as cc_super_admin,
  true as cc_country_admin
from temp_titan_provider tp
cross join (
  values
    ('dgtllc@dgt.llc', 'DGT Main Office', true),
    ('dubai@dgt.llc', 'Dubai Office', false),
    ('chaman@dgt.llc', 'Chaman Office', false),
    ('quetta@dgt.llc', 'Quetta Office', false),
    ('kandahar@dgt.llc', 'Kandahar Office', false)
) as mailbox(email, display_name, is_default)
on conflict (lower(email_address)) do update
  set provider_id = excluded.provider_id,
      display_name = excluded.display_name,
      is_active = excluded.is_active,
      is_default = excluded.is_default;

-- Clean up temp table
drop table temp_titan_provider;

-- Update migration registry
insert into erp_schema_migrations (name, status)
values ('0071_titan_email_provider_setup', 'applied')
on conflict (name) do update set status = excluded.status, applied_at = now();
