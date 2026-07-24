-- 0066_whatsapp_team_inbox.sql
-- WhatsApp Team Inbox module: complete schema with RLS.
-- Mirrors the email management infrastructure pattern (migration 0035).
-- Uses existing RLS helper functions: is_super_admin(), can_access_country(),
-- can_access_city_branch(), can_manage_country().

-- ────────────────────────────────────────────────────────────────────────────
-- cleanup existing elements if they exist
-- ────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS wa_messages_sync_last_message ON whatsapp_messages;
DROP TRIGGER IF EXISTS wa_messages_increment_unread ON whatsapp_messages;
DROP FUNCTION IF EXISTS sync_conversation_last_message() CASCADE;
DROP FUNCTION IF EXISTS increment_unread_count() CASCADE;
DROP FUNCTION IF EXISTS can_access_whatsapp_account(uuid) CASCADE;

DROP TABLE IF EXISTS whatsapp_activity_log CASCADE;
DROP TABLE IF EXISTS whatsapp_message_media CASCADE;
DROP TABLE IF EXISTS whatsapp_messages CASCADE;
DROP TABLE IF EXISTS whatsapp_conversations CASCADE;
DROP TABLE IF EXISTS whatsapp_contacts CASCADE;
DROP TABLE IF EXISTS whatsapp_accounts CASCADE;

DROP TYPE IF EXISTS whatsapp_account_scope CASCADE;
DROP TYPE IF EXISTS whatsapp_conversation_status CASCADE;
DROP TYPE IF EXISTS whatsapp_message_direction CASCADE;
DROP TYPE IF EXISTS whatsapp_message_type CASCADE;
DROP TYPE IF EXISTS whatsapp_message_status CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 0. ENUMS
-- ────────────────────────────────────────────────────────────────────────────

create type whatsapp_account_scope as enum (
  'super_admin',
  'country',
  'country_branch',
  'city_branch'
);

create type whatsapp_conversation_status as enum (
  'open',
  'assigned',
  'resolved',
  'spam'
);

create type whatsapp_message_direction as enum (
  'inbound',
  'outbound',
  'internal_note'
);

create type whatsapp_message_type as enum (
  'text',
  'image',
  'document',
  'audio',
  'video',
  'sticker',
  'location',
  'contact',
  'template',
  'reaction',
  'unknown'
);

create type whatsapp_message_status as enum (
  'pending',
  'sent',
  'delivered',
  'read',
  'failed'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 1. whatsapp_accounts
--    One record per connected WhatsApp Business number.
--    Scoped to: super_admin | country | country_branch | city_branch
-- ────────────────────────────────────────────────────────────────────────────

create table whatsapp_accounts (
  id                  uuid primary key default gen_random_uuid(),
  scope               whatsapp_account_scope not null,
  country_id          uuid references countries(id),
  country_branch_id   uuid references country_branches(id),
  city_branch_id      uuid references city_branches(id),
  -- Meta / WhatsApp Business API fields
  display_name        text not null,
  phone_number        text not null,          -- E.164 format, e.g. +971501234567
  phone_number_id     text not null,          -- Meta phone number ID
  waba_id             text not null,          -- WhatsApp Business Account ID
  access_token        text not null,          -- Permanent system user token (encrypted at app level)
  -- Webhook / verification
  verify_token        text,                   -- Per-account verify token override (optional)
  webhook_registered  boolean not null default false,
  -- State
  is_active           boolean not null default true,
  is_default          boolean not null default false,
  settings            jsonb not null default '{}'::jsonb,
  -- Metadata
  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  -- Scope integrity: scope must match the nullable FK pattern
  constraint whatsapp_accounts_scope_chk check (
    (scope = 'super_admin'    and country_id is null  and country_branch_id is null and city_branch_id is null)
    or (scope = 'country'       and country_id is not null and country_branch_id is null and city_branch_id is null)
    or (scope = 'country_branch' and country_id is not null and country_branch_id is not null and city_branch_id is null)
    or (scope = 'city_branch'   and country_id is not null and country_branch_id is not null and city_branch_id is not null)
  )
);

create unique index whatsapp_accounts_phone_number_id_idx
  on whatsapp_accounts (phone_number_id)
  where deleted_at is null;

create index whatsapp_accounts_scope_idx
  on whatsapp_accounts (country_id, country_branch_id, city_branch_id, scope)
  where deleted_at is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. whatsapp_contacts
--    Phone numbers that have been seen in conversations.
--    Linked to ERP customers/suppliers when found.
-- ────────────────────────────────────────────────────────────────────────────

create table whatsapp_contacts (
  id               uuid primary key default gen_random_uuid(),
  -- The WA account this contact was seen on (determines scoping)
  whatsapp_account_id uuid not null references whatsapp_accounts(id),
  country_id       uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id   uuid references city_branches(id),
  -- Contact identity
  phone_number     text not null,  -- E.164
  wa_profile_name  text,           -- Name from WhatsApp profile
  -- ERP cross-references (populated by phone number lookup)
  customer_id      uuid,           -- references customers(id) — loose FK for flexibility
  supplier_id      uuid,           -- references enterprise_accounts(id) — loose FK
  linked_account_id uuid,          -- generic ERP account link
  -- Display / classification
  display_name     text,           -- Override from ERP (customer name takes precedence)
  labels           text[] not null default '{}',
  notes            text,
  is_blocked       boolean not null default false,
  -- Metadata
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create unique index whatsapp_contacts_account_phone_idx
  on whatsapp_contacts (whatsapp_account_id, phone_number)
  where deleted_at is null;

create index whatsapp_contacts_phone_idx
  on whatsapp_contacts (phone_number)
  where deleted_at is null;

create index whatsapp_contacts_customer_idx
  on whatsapp_contacts (customer_id)
  where customer_id is not null and deleted_at is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. whatsapp_conversations
--    One per (contact, account) pair. Status tracks the inbox view.
-- ────────────────────────────────────────────────────────────────────────────

create table whatsapp_conversations (
  id                  uuid primary key default gen_random_uuid(),
  whatsapp_account_id uuid not null references whatsapp_accounts(id),
  contact_id          uuid not null references whatsapp_contacts(id),
  -- Scoping (denormalized from account for fast RLS queries)
  country_id          uuid references countries(id),
  country_branch_id   uuid references country_branches(id),
  city_branch_id      uuid references city_branches(id),
  -- Conversation state
  status              whatsapp_conversation_status not null default 'open',
  assigned_user_id    uuid references profiles(id),
  unread_count        integer not null default 0,
  -- Last message snapshot (for list view, avoids a subquery)
  last_message_text   text,
  last_message_at     timestamptz,
  last_message_dir    whatsapp_message_direction,
  -- ERP link fields (show in contact panel)
  linked_customer_id  uuid,
  linked_supplier_id  uuid,
  linked_module       text,    -- e.g. 'purchase_order', 'sales_order', 'invoice'
  linked_document_no  text,
  -- Labels/tags
  labels              text[] not null default '{}',
  -- Meta conversation window (24h window tracking)
  meta_conversation_id text,
  window_expires_at   timestamptz,
  -- Metadata
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create unique index whatsapp_conversations_account_contact_idx
  on whatsapp_conversations (whatsapp_account_id, contact_id)
  where deleted_at is null;

create index whatsapp_conversations_scope_status_idx
  on whatsapp_conversations (country_id, country_branch_id, city_branch_id, status, last_message_at desc)
  where deleted_at is null;

create index whatsapp_conversations_assigned_idx
  on whatsapp_conversations (assigned_user_id, status)
  where assigned_user_id is not null and deleted_at is null;

create index whatsapp_conversations_last_msg_idx
  on whatsapp_conversations (whatsapp_account_id, last_message_at desc)
  where deleted_at is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. whatsapp_messages
--    Individual messages inside a conversation.
-- ────────────────────────────────────────────────────────────────────────────

create table whatsapp_messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references whatsapp_conversations(id) on delete cascade,
  whatsapp_account_id uuid not null references whatsapp_accounts(id),
  -- Scoping (denormalized)
  country_id          uuid references countries(id),
  country_branch_id   uuid references country_branches(id),
  city_branch_id      uuid references city_branches(id),
  -- Direction and type
  direction           whatsapp_message_direction not null,
  message_type        whatsapp_message_type not null default 'text',
  status              whatsapp_message_status not null default 'pending',
  -- Content
  body                text,                        -- Text content
  template_name       text,                        -- For template messages
  template_params     jsonb,
  media_url           text,                        -- URL to stored media
  media_mime_type     text,
  media_size_bytes    integer,
  media_filename      text,
  media_sha256        text,
  location_lat        numeric(10, 7),
  location_lng        numeric(10, 7),
  location_name       text,
  raw_payload         jsonb,                       -- Full Meta webhook payload
  -- Meta identifiers
  external_message_id text,                        -- wamid from Meta
  context_message_id  text,                        -- Quoted/replied-to wamid
  -- Author
  sender_user_id      uuid references profiles(id), -- For outbound/notes
  sender_phone        text,                        -- For inbound
  -- Timestamps from Meta
  sent_at             timestamptz,
  delivered_at        timestamptz,
  read_at             timestamptz,
  failed_at           timestamptz,
  failed_reason       text,
  -- ERP metadata
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create unique index whatsapp_messages_external_id_idx
  on whatsapp_messages (external_message_id)
  where external_message_id is not null and deleted_at is null;

create index whatsapp_messages_conversation_idx
  on whatsapp_messages (conversation_id, created_at asc)
  where deleted_at is null;

create index whatsapp_messages_scope_idx
  on whatsapp_messages (country_id, country_branch_id, city_branch_id, created_at desc)
  where deleted_at is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. whatsapp_message_media
--    Media files stored in Supabase Storage, linked to messages.
-- ────────────────────────────────────────────────────────────────────────────

create table whatsapp_message_media (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references whatsapp_messages(id) on delete cascade,
  conversation_id uuid not null references whatsapp_conversations(id),
  -- Storage reference
  bucket          text not null default 'whatsapp-media',
  storage_path    text not null,
  public_url      text,
  -- File info
  mime_type       text,
  filename        text,
  size_bytes      integer,
  duration_secs   integer,  -- for audio/video
  -- Meta reference
  meta_media_id   text,
  -- Metadata
  uploaded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index whatsapp_message_media_message_idx on whatsapp_message_media (message_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. whatsapp_activity_log
--    Audit trail: status changes, assignments, notes, account events.
-- ────────────────────────────────────────────────────────────────────────────

create table whatsapp_activity_log (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references whatsapp_conversations(id),
  whatsapp_account_id uuid references whatsapp_accounts(id),
  -- Scoping
  country_id      uuid references countries(id),
  city_branch_id  uuid references city_branches(id),
  -- Actor
  actor_id        uuid references profiles(id),
  actor_name      text,
  -- Event
  event_type      text not null,   -- e.g. 'status_change', 'assigned', 'resolved', 'note_added'
  event_data      jsonb not null default '{}'::jsonb,
  -- Metadata
  created_at      timestamptz not null default now()
);

create index whatsapp_activity_log_conversation_idx
  on whatsapp_activity_log (conversation_id, created_at desc)
  where conversation_id is not null;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────────────

alter table whatsapp_accounts        enable row level security;
alter table whatsapp_contacts        enable row level security;
alter table whatsapp_conversations   enable row level security;
alter table whatsapp_messages        enable row level security;
alter table whatsapp_message_media   enable row level security;
alter table whatsapp_activity_log    enable row level security;

-- Helper: can user access this whatsapp account?
create or replace function can_access_whatsapp_account(account_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from whatsapp_accounts wa
    where wa.id = account_id
      and wa.deleted_at is null
      and (
        is_super_admin()
        or (wa.scope = 'country'       and wa.country_id is not null and can_access_country(wa.country_id))
        or (wa.scope = 'country_branch' and wa.country_id is not null and can_access_country(wa.country_id))
        or (wa.scope = 'city_branch'    and wa.city_branch_id is not null and can_access_city_branch(wa.city_branch_id))
      )
  );
$$;

-- whatsapp_accounts policies
create policy wa_accounts_read on whatsapp_accounts
  for select using (
    is_super_admin()
    or (scope = 'country'       and country_id is not null and can_access_country(country_id))
    or (scope = 'country_branch' and country_id is not null and can_access_country(country_id))
    or (scope = 'city_branch'    and city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy wa_accounts_insert on whatsapp_accounts
  for insert with check (
    is_super_admin()
    or (scope = 'country'       and country_id is not null and can_manage_country(country_id))
    or (scope = 'country_branch' and country_id is not null and can_manage_country(country_id))
    or (scope = 'city_branch'    and city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy wa_accounts_update on whatsapp_accounts
  for update using (
    is_super_admin()
    or (scope = 'country'        and country_id is not null and can_manage_country(country_id))
    or (scope = 'country_branch'  and country_id is not null and can_manage_country(country_id))
    or (scope = 'city_branch'     and city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

-- whatsapp_contacts policies
create policy wa_contacts_read on whatsapp_contacts
  for select using (can_access_whatsapp_account(whatsapp_account_id));

create policy wa_contacts_write on whatsapp_contacts
  for all using (can_access_whatsapp_account(whatsapp_account_id))
  with check (can_access_whatsapp_account(whatsapp_account_id));

-- whatsapp_conversations policies
create policy wa_conversations_read on whatsapp_conversations
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    or assigned_user_id = auth.uid()
  );

create policy wa_conversations_write on whatsapp_conversations
  for all using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  )
  with check (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

-- whatsapp_messages policies
create policy wa_messages_read on whatsapp_messages
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    or exists (
      select 1 from whatsapp_conversations wc
      where wc.id = conversation_id
        and wc.assigned_user_id = auth.uid()
    )
  );

create policy wa_messages_write on whatsapp_messages
  for all using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    or exists (
      select 1 from whatsapp_conversations wc
      where wc.id = conversation_id
        and wc.assigned_user_id = auth.uid()
    )
  )
  with check (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    or exists (
      select 1 from whatsapp_conversations wc
      where wc.id = conversation_id
        and wc.assigned_user_id = auth.uid()
    )
  );

-- whatsapp_message_media: access via parent message
create policy wa_media_read on whatsapp_message_media
  for select using (
    exists (
      select 1 from whatsapp_messages wm
      where wm.id = whatsapp_message_media.message_id
        and (
          is_super_admin()
          or (wm.country_id is not null and can_access_country(wm.country_id))
          or (wm.city_branch_id is not null and can_access_city_branch(wm.city_branch_id))
          or exists (
            select 1 from whatsapp_conversations wc
            where wc.id = wm.conversation_id
              and wc.assigned_user_id = auth.uid()
          )
        )
    )
  );

create policy wa_media_write on whatsapp_message_media
  for all using (
    exists (
      select 1 from whatsapp_messages wm
      where wm.id = whatsapp_message_media.message_id
        and (
          is_super_admin()
          or (wm.country_id is not null and can_access_country(wm.country_id))
          or (wm.city_branch_id is not null and can_access_city_branch(wm.city_branch_id))
          or exists (
            select 1 from whatsapp_conversations wc
            where wc.id = wm.conversation_id
              and wc.assigned_user_id = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from whatsapp_messages wm
      where wm.id = whatsapp_message_media.message_id
        and (
          is_super_admin()
          or (wm.country_id is not null and can_access_country(wm.country_id))
          or (wm.city_branch_id is not null and can_access_city_branch(wm.city_branch_id))
          or exists (
            select 1 from whatsapp_conversations wc
            where wc.id = wm.conversation_id
              and wc.assigned_user_id = auth.uid()
          )
        )
    )
  );

-- whatsapp_activity_log
create policy wa_activity_read on whatsapp_activity_log
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    or actor_id = auth.uid()
  );

create policy wa_activity_insert on whatsapp_activity_log
  for insert with check (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 8. PERMISSIONS CATALOG
-- ────────────────────────────────────────────────────────────────────────────

insert into permissions (resource, action, description)
values
  ('whatsapp', 'read',            'View WhatsApp conversations and messages'),
  ('whatsapp', 'create',          'Send WhatsApp messages and add internal notes'),
  ('whatsapp', 'update',          'Update conversation status, assignments, and labels'),
  ('whatsapp', 'delete',          'Connect and manage WhatsApp Business accounts')
on conflict (resource, action) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. TRIGGER: keep conversations.last_message_* in sync
-- ────────────────────────────────────────────────────────────────────────────

create or replace function sync_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only update for non-deleted inbound/outbound messages (not internal notes for the preview)
  if new.deleted_at is null and new.direction <> 'internal_note' then
    update whatsapp_conversations
    set
      last_message_text = left(coalesce(new.body, '[' || new.message_type::text || ']'), 200),
      last_message_at   = coalesce(new.sent_at, new.created_at),
      last_message_dir  = new.direction,
      updated_at        = now()
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

create trigger wa_messages_sync_last_message
  after insert or update on whatsapp_messages
  for each row execute function sync_conversation_last_message();

-- ────────────────────────────────────────────────────────────────────────────
-- 10. TRIGGER: unread_count increment on inbound message
-- ────────────────────────────────────────────────────────────────────────────

create or replace function increment_unread_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'inbound' and new.deleted_at is null then
    update whatsapp_conversations
    set unread_count = unread_count + 1,
        status = case when status = 'resolved' then 'open' else status end,
        updated_at = now()
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

create trigger wa_messages_increment_unread
  after insert on whatsapp_messages
  for each row execute function increment_unread_count();

-- ────────────────────────────────────────────────────────────────────────────
-- 11. RECORD MIGRATION
-- ────────────────────────────────────────────────────────────────────────────

insert into erp_schema_migrations (name, status)
values ('0066_whatsapp_team_inbox', 'applied')
on conflict (name) do update set status = excluded.status, applied_at = now();
