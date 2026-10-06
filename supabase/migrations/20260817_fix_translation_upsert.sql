-- Fix the live multilingual writer so it uses the actual per-language table
-- conflict targets and never tries to ON CONFLICT against the writable view.
-- The current function body in the local/dev database was still upserting the
-- `record_translations` view and then using the wrong conflict key on the skinny
-- language tables. That produced:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"

drop function if exists public.upsert_record_translation(
  text, uuid, text, text, text, text, text, text, text, text, jsonb, text, text, text, uuid
);

create or replace function public.upsert_record_translation(
  p_record_table text,
  p_record_id uuid,
  p_field_name text,
  p_original_text text,
  p_original_language_code text,
  p_english text,
  p_urdu text,
  p_arabic text,
  p_persian text,
  p_pashto text,
  p_language_texts jsonb,
  p_source text,
  p_translation_status text,
  p_translated_by_engine text,
  p_actor_id uuid
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid;
  v_source public.translation_source := coalesce(nullif(p_source, ''), 'auto')::public.translation_source;
  v_english text := coalesce(nullif(p_english, ''), p_original_text, '');
  v_urdu text := coalesce(nullif(p_urdu, ''), p_original_text, '');
  v_arabic text := coalesce(nullif(p_arabic, ''), p_original_text, '');
  v_persian text := coalesce(nullif(p_persian, ''), p_original_text, '');
  v_pashto text := coalesce(nullif(p_pashto, ''), p_original_text, '');
begin
  insert into public.translations_english (
    record_table, record_id, field_name, text, original_text, original_language_code,
    source, translation_status, translated_by_engine, corrected_by, corrected_at,
    created_at, updated_at, translated_at, deleted_at
  )
  values (
    p_record_table, p_record_id, p_field_name, v_english, coalesce(nullif(p_original_text, ''), ''),
    coalesce(nullif(p_original_language_code, ''), 'en'), v_source,
    coalesce(nullif(p_translation_status, ''), 'complete'),
    coalesce(nullif(p_translated_by_engine, ''), 'local_dictionary'),
    case when v_source = 'manual' then p_actor_id else null end,
    case when v_source = 'manual' then now() else null end,
    now(), now(), now(), null
  )
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set
    text = excluded.text,
    original_text = excluded.original_text,
    original_language_code = excluded.original_language_code,
    source = excluded.source,
    translation_status = excluded.translation_status,
    translated_by_engine = excluded.translated_by_engine,
    corrected_by = excluded.corrected_by,
    corrected_at = excluded.corrected_at,
    translated_at = now(),
    updated_at = now()
  returning id into v_id;

  insert into public.translations_urdu (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
  values (p_record_table, p_record_id, p_field_name, v_urdu, now(), now(), null)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_arabic (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
  values (p_record_table, p_record_id, p_field_name, v_arabic, now(), now(), null)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_persian (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
  values (p_record_table, p_record_id, p_field_name, v_persian, now(), now(), null)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_pashto (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
  values (p_record_table, p_record_id, p_field_name, v_pashto, now(), now(), null)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  return v_id;
end
$fn$;
