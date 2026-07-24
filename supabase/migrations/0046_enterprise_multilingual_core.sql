-- Enterprise multilingual core policy.
-- Purpose:
-- 1. Keep the existing record_translations table as the central source.
-- 2. Add a flexible jsonb language map so future languages can be added
--    without changing every table again.
-- 3. Add system event logging where Super Admin can always read Urdu text.

insert into languages (code, english_name, native_name, direction, is_default, is_active)
values
  ('en', 'English', 'English', 'ltr', true, true),
  ('ur', 'Urdu', 'اردو', 'rtl', false, true),
  ('ar', 'Arabic', 'العربية', 'rtl', false, true),
  ('fa', 'Persian / Farsi', 'فارسی', 'rtl', false, true),
  ('ps', 'Pashto', 'پښتو', 'rtl', false, true)
on conflict (code) do update set
  english_name = excluded.english_name,
  native_name = excluded.native_name,
  direction = excluded.direction,
  is_active = true,
  updated_at = now();

alter table record_translations
  add column if not exists language_texts jsonb not null default '{}'::jsonb,
  add column if not exists translation_status text not null default 'complete',
  add column if not exists translated_by_engine text not null default 'local_dictionary',
  add column if not exists translated_at timestamptz not null default now();

update record_translations
set language_texts = jsonb_strip_nulls(jsonb_build_object(
  'en', coalesce(english_text, original_text),
  'ur', coalesce(urdu_text, original_text),
  'ar', coalesce(arabic_text, original_text),
  'fa', coalesce(persian_text, original_text),
  'ps', coalesce(pashto_text, original_text)
))
where language_texts = '{}'::jsonb;

create index if not exists idx_record_translations_language_texts_gin
  on record_translations using gin (language_texts)
  where deleted_at is null;

create table if not exists erp_multilingual_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'info',
  source_module text,
  entity_table text,
  entity_id uuid,
  actor_id uuid references profiles(id),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  message_original text not null,
  message_language_code text not null default 'en' references languages(code),
  message_urdu text not null,
  message_translations jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  notify_super_admin boolean not null default true,
  notify_local_admin boolean not null default true,
  notify_email boolean not null default false,
  notify_mobile boolean not null default false,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_erp_multilingual_events_super_admin
  on erp_multilingual_events (notify_super_admin, created_at desc)
  where deleted_at is null;

create index if not exists idx_erp_multilingual_events_scope
  on erp_multilingual_events (country_id, country_branch_id, city_branch_id, created_at desc)
  where deleted_at is null;

create or replace function resolve_record_translation_v2(
  p_record_table text,
  p_record_id uuid,
  p_field_name text,
  p_language_code text
)
returns text
language sql
stable
as $$
  select coalesce(
    language_texts ->> p_language_code,
    case p_language_code
      when 'ur' then urdu_text
      when 'ps' then pashto_text
      when 'ar' then arabic_text
      when 'fa' then persian_text
      else english_text
    end,
    english_text,
    original_text
  )
  from record_translations
  where record_table = p_record_table
    and record_id = p_record_id
    and field_name = p_field_name
    and deleted_at is null
  limit 1;
$$;

create or replace function search_record_translations_v2(
  p_language_code text,
  p_query text,
  p_record_table text default null
)
returns table (
  record_table text,
  record_id uuid,
  field_name text,
  resolved_text text
)
language sql
stable
as $$
  select
    rt.record_table,
    rt.record_id,
    rt.field_name,
    coalesce(
      rt.language_texts ->> p_language_code,
      case p_language_code
        when 'ur' then rt.urdu_text
        when 'ps' then rt.pashto_text
        when 'ar' then rt.arabic_text
        when 'fa' then rt.persian_text
        else rt.english_text
      end,
      rt.english_text,
      rt.original_text
    ) as resolved_text
  from record_translations rt
  where rt.deleted_at is null
    and (p_record_table is null or rt.record_table = p_record_table)
    and (
      rt.original_text ilike '%' || p_query || '%'
      or rt.english_text ilike '%' || p_query || '%'
      or rt.urdu_text ilike '%' || p_query || '%'
      or rt.pashto_text ilike '%' || p_query || '%'
      or rt.arabic_text ilike '%' || p_query || '%'
      or rt.persian_text ilike '%' || p_query || '%'
      or rt.language_texts::text ilike '%' || p_query || '%'
    )
  order by rt.updated_at desc;
$$;

create or replace view super_admin_urdu_notifications as
select
  id,
  event_type,
  severity,
  source_module,
  entity_table,
  entity_id,
  actor_id,
  country_id,
  country_branch_id,
  city_branch_id,
  message_urdu as message,
  payload,
  is_read,
  created_at
from erp_multilingual_events
where notify_super_admin = true
  and deleted_at is null;

notify pgrst, 'reload schema';
