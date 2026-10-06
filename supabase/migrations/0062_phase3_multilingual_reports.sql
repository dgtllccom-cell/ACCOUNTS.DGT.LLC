-- Phase 3 multilingual and professional report foundation.
-- Keeps existing ERP data intact and hardens reusable translation/report infrastructure.

insert into languages (code, english_name, native_name, direction, is_default, is_active)
values
  ('en', 'English', 'English', 'ltr', true, true),
  ('ur', 'Urdu', 'اردو', 'rtl', false, true),
  ('ps', 'Pashto', 'پښتو', 'rtl', false, true),
  ('fa', 'Persian / Farsi', 'فارسی', 'rtl', false, true),
  ('ar', 'Arabic', 'العربية', 'rtl', false, true)
on conflict (code) do update set
  english_name = excluded.english_name,
  native_name = excluded.native_name,
  direction = excluded.direction,
  is_active = true,
  updated_at = now();

alter table record_translations
  add column if not exists language_texts jsonb not null default '{}'::jsonb,
  add column if not exists translation_status text not null default 'complete',
  add column if not exists translated_by_engine text not null default 'local_fallback',
  add column if not exists translated_at timestamptz not null default now();

update record_translations
set language_texts = jsonb_strip_nulls(jsonb_build_object(
  'en', coalesce(english_text, original_text),
  'ur', coalesce(urdu_text, original_text),
  'ps', coalesce(pashto_text, original_text),
  'fa', coalesce(persian_text, original_text),
  'ar', coalesce(arabic_text, original_text)
))
where language_texts = '{}'::jsonb;

create index if not exists idx_record_translations_language_texts_gin
  on record_translations using gin (language_texts)
  where deleted_at is null;

create table if not exists translation_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id uuid not null,
  source_language_code text not null references languages(code),
  target_language_codes text[] not null default array['en','ur','ps','fa','ar'],
  field_names text[] not null default '{}',
  status text not null default 'pending',
  provider text not null default 'local_fallback',
  error_message text,
  requested_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_translation_generation_jobs_record
  on translation_generation_jobs (record_table, record_id, created_at desc);

create table if not exists erp_report_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  module_key text not null,
  report_title text not null,
  report_title_translations jsonb not null default '{}'::jsonb,
  language_code text not null default 'en' references languages(code),
  paper_size text not null default 'A4',
  orientation text not null default 'portrait',
  html_template text,
  css_template text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists erp_report_templates_key_language_idx
  on erp_report_templates (template_key, language_code)
  where deleted_at is null;

create table if not exists erp_report_exports (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  module_key text not null,
  source_table text,
  source_id uuid,
  language_code text not null default 'en' references languages(code),
  file_name text,
  file_url text,
  export_format text not null default 'pdf',
  export_status text not null default 'created',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_erp_report_exports_source
  on erp_report_exports (source_table, source_id, created_at desc)
  where deleted_at is null;

create or replace function resolve_record_translation_v3(
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

notify pgrst, 'reload schema';
