-- Database-level multilingual search enforcement.
-- This migration does not translate text by itself; it makes the central
-- record_translations table searchable across all supported ERP languages.

create extension if not exists pg_trgm;

create index if not exists idx_record_translations_lookup_active
  on record_translations (record_table, record_id, field_name)
  where deleted_at is null;

create index if not exists idx_record_translations_original_trgm
  on record_translations using gin (original_text gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_record_translations_en_trgm
  on record_translations using gin (english_text gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_record_translations_ur_trgm
  on record_translations using gin (urdu_text gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_record_translations_ps_trgm
  on record_translations using gin (pashto_text gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_record_translations_ar_trgm
  on record_translations using gin (arabic_text gin_trgm_ops)
  where deleted_at is null;

create index if not exists idx_record_translations_fa_trgm
  on record_translations using gin (persian_text gin_trgm_ops)
  where deleted_at is null;

create or replace function resolve_record_translation(
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

create or replace function search_record_translations(
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
    )
  order by rt.updated_at desc;
$$;

notify pgrst, 'reload schema';
