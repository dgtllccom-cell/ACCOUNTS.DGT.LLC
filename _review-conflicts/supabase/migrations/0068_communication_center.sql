begin;

create table if not exists communication_center_profiles (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'country' check (scope in ('global', 'country', 'country_branch', 'city_branch')),
  country_id uuid references countries(id) on delete set null,
  country_branch_id uuid references country_branches(id) on delete set null,
  city_branch_id uuid references city_branches(id) on delete set null,
  office_name text not null,
  branch_display_name text,
  email_address text,
  whatsapp_number text,
  signature_text text,
  signature_html text,
  logo_url text,
  contact_info jsonb not null default '{}'::jsonb,
  email_settings jsonb not null default '{}'::jsonb,
  whatsapp_settings jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists communication_center_profiles_scope_idx
  on communication_center_profiles(scope, country_id, country_branch_id, city_branch_id)
  where deleted_at is null;

create table if not exists communication_center_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'whatsapp', 'internal', 'notification')),
  direction text not null default 'outgoing' check (direction in ('incoming', 'outgoing', 'internal')),
  folder text not null default 'sent' check (folder in ('inbox', 'sent', 'draft', 'scheduled', 'failed', 'archive')),
  profile_id uuid references communication_center_profiles(id) on delete set null,
  country_id uuid references countries(id) on delete set null,
  country_branch_id uuid references country_branches(id) on delete set null,
  city_branch_id uuid references city_branches(id) on delete set null,
  customer_id uuid,
  supplier_id uuid,
  lead_id uuid,
  sender_user_id uuid references profiles(id) on delete set null,
  sender_name text,
  sender_email text,
  sender_whatsapp text,
  recipient_to text not null default '',
  recipient_cc text not null default '',
  recipient_bcc text not null default '',
  subject text,
  body text not null default '',
  template_key text,
  attachments jsonb not null default '[]'::jsonb,
  linked_module text,
  linked_document_no text,
  linked_route text,
  delivery_status text not null default 'logged',
  read_status text not null default 'unread',
  provider_message_id text,
  provider_payload jsonb not null default '{}'::jsonb,
  sender_snapshot jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists communication_center_messages_scope_idx
  on communication_center_messages(country_id, country_branch_id, city_branch_id, channel, folder, created_at desc)
  where deleted_at is null;

create index if not exists communication_center_messages_document_idx
  on communication_center_messages(linked_module, linked_document_no)
  where deleted_at is null;

create table if not exists communication_center_leads (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id) on delete set null,
  country_branch_id uuid references country_branches(id) on delete set null,
  city_branch_id uuid references city_branches(id) on delete set null,
  lead_name text not null,
  company_name text,
  contact_person text,
  email text,
  phone text,
  whatsapp text,
  source text,
  status text not null default 'new',
  priority text not null default 'normal',
  notes text,
  next_follow_up_at timestamptz,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists communication_center_leads_scope_idx
  on communication_center_leads(country_id, country_branch_id, city_branch_id, status, created_at desc)
  where deleted_at is null;

create table if not exists communication_center_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references communication_center_leads(id) on delete cascade,
  country_id uuid references countries(id) on delete set null,
  country_branch_id uuid references country_branches(id) on delete set null,
  city_branch_id uuid references city_branches(id) on delete set null,
  title text not null,
  followup_type text not null default 'task',
  due_at timestamptz,
  status text not null default 'open',
  notes text,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists communication_center_followups_due_idx
  on communication_center_followups(status, due_at)
  where deleted_at is null;

create table if not exists communication_center_campaigns (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id) on delete set null,
  country_branch_id uuid references country_branches(id) on delete set null,
  city_branch_id uuid references city_branches(id) on delete set null,
  name text not null,
  channel text not null check (channel in ('email', 'whatsapp', 'mixed')),
  segment_name text,
  status text not null default 'draft',
  subject text,
  body text,
  scheduled_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists communication_center_campaigns_scope_idx
  on communication_center_campaigns(country_id, country_branch_id, city_branch_id, status, created_at desc)
  where deleted_at is null;

insert into communication_center_profiles (
  scope,
  country_id,
  office_name,
  branch_display_name,
  email_address,
  signature_text,
  signature_html,
  email_settings,
  is_default,
  is_active
)
select
  'country',
  c.id,
  coalesce(c.email_server_settings->>'officeName', c.email_server_settings->>'office_name', c.name),
  c.name,
  c.official_email,
  concat(coalesce(c.email_server_settings->>'officeName', c.email_server_settings->>'office_name', c.name), E'\n', c.name, E'\nEmail: ', c.official_email),
  concat('<strong>', coalesce(c.email_server_settings->>'officeName', c.email_server_settings->>'office_name', c.name), '</strong><div>', c.name, '</div><div>Email: ', c.official_email, '</div>'),
  coalesce(c.email_server_settings, '{}'::jsonb),
  true,
  true
from countries c
where c.official_email is not null
  and not exists (
    select 1
    from communication_center_profiles p
    where p.country_id = c.id
      and p.scope = 'country'
      and p.deleted_at is null
  );

insert into permissions (resource, action, description)
values
  ('communication_center', 'read', 'View email, WhatsApp, CRM, follow-ups and communication reports.'),
  ('communication_center', 'create', 'Create communication profiles, messages, leads, campaigns and follow-ups.'),
  ('communication_center', 'post', 'Send or log outgoing ERP emails and WhatsApp messages through the Communication Center.'),
  ('communication_center', 'export', 'Export Communication Center reports.')
on conflict (resource, action) do update
set description = excluded.description;

insert into erp_schema_migrations (name, status, applied_at)
values ('0068_communication_center', 'applied', now())
on conflict (name) do update
set status = excluded.status,
    applied_at = excluded.applied_at;

commit;


