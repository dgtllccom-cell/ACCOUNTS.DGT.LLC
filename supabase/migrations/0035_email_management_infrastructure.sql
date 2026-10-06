-- 0035_email_management_infrastructure.sql
-- Multi-country ERP email infrastructure. Extends existing country/branch/message
-- structures without replacing the current audit-backed Message System UI.

alter table countries
  add column if not exists official_email text,
  add column if not exists admin_email text,
  add column if not exists email_domain text,
  add column if not exists email_server_settings jsonb not null default '{}'::jsonb;

create index if not exists countries_official_email_idx
  on countries (lower(official_email))
  where official_email is not null and deleted_at is null;

create index if not exists countries_admin_email_idx
  on countries (lower(admin_email))
  where admin_email is not null and deleted_at is null;

create index if not exists country_branches_email_idx
  on country_branches (lower(email))
  where email is not null and deleted_at is null;

create index if not exists city_branches_email_idx
  on city_branches (lower(email))
  where email is not null and deleted_at is null;

create table if not exists erp_email_providers (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  provider_type text not null default 'self_hosted',
  domain text not null,
  smtp_host text,
  smtp_port integer,
  imap_host text,
  imap_port integer,
  security_mode text not null default 'tls',
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists erp_email_providers_domain_idx
  on erp_email_providers (lower(domain))
  where deleted_at is null;

create table if not exists erp_email_accounts (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  provider_id uuid references erp_email_providers(id),
  scope text not null check (scope in ('super_admin','country','country_branch','city_branch')),
  display_name text not null,
  email_address text not null,
  admin_email text,
  reply_to text,
  cc_super_admin boolean not null default true,
  cc_country_admin boolean not null default true,
  is_default boolean not null default false,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists erp_email_accounts_address_idx
  on erp_email_accounts (lower(email_address))
  where deleted_at is null;

create index if not exists erp_email_accounts_scope_idx
  on erp_email_accounts (country_id, country_branch_id, city_branch_id, scope)
  where deleted_at is null;

create table if not exists erp_email_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'email',
  folder text not null default 'sent',
  provider_id uuid references erp_email_providers(id),
  email_account_id uuid references erp_email_accounts(id),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  customer_id uuid references customers(id),
  supplier_id uuid,
  sender_user_id uuid references profiles(id),
  sender_name text not null,
  sender_email text,
  recipient_to text not null default '',
  recipient_cc text not null default '',
  recipient_bcc text not null default '',
  subject text not null,
  body text not null,
  labels text[] not null default '{}',
  attachment_count integer not null default 0,
  attachments jsonb not null default '[]'::jsonb,
  delivery_status text not null default 'logged',
  external_message_id text,
  thread_id text,
  direction text not null default 'outgoing' check (direction in ('incoming','outgoing','internal')),
  linked_module text,
  linked_route text,
  linked_document_no text,
  audit_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists erp_email_messages_scope_idx
  on erp_email_messages (country_id, country_branch_id, city_branch_id, created_at desc)
  where deleted_at is null;

create index if not exists erp_email_messages_customer_idx
  on erp_email_messages (customer_id, created_at desc)
  where customer_id is not null and deleted_at is null;

create index if not exists erp_email_messages_sender_idx
  on erp_email_messages (lower(sender_email), created_at desc)
  where sender_email is not null and deleted_at is null;

create index if not exists erp_email_messages_thread_idx
  on erp_email_messages (thread_id)
  where thread_id is not null and deleted_at is null;

insert into erp_email_providers (provider_name, provider_type, domain, security_mode, settings)
values ('DGT Self Hosted Mail', 'self_hosted', 'dgt.llc', 'tls', '{"notes":"Default ERP self-hosted email domain"}'::jsonb)
on conflict do nothing;

insert into permissions (resource, action, description)
values
  ('email_management', 'create', 'Compose and send ERP emails'),
  ('email_management', 'read', 'View scoped ERP email communications'),
  ('email_management', 'update', 'Manage ERP email status, folders and labels'),
  ('email_management', 'update', 'Configure email providers and official country/branch email accounts')
on conflict (resource, action) do nothing;

insert into erp_schema_migrations (name, status)
values ('0035_email_management_infrastructure', 'applied')
on conflict (name) do update set status = excluded.status, applied_at = now();
