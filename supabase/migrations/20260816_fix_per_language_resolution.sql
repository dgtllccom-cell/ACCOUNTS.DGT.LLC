-- =====================================================================
-- 20260816_fix_per_language_resolution.sql
-- Strictly isolate per-language translation resolution.
-- Prevent cross-language string leakage where Urdu text is returned as English
-- or English text is returned as Urdu.
-- =====================================================================

create or replace function public.resolve_record_translation(
  p_record_table text,
  p_record_id uuid,
  p_field_name text,
  p_language_code text
)
returns text language plpgsql stable set search_path = public as $fn$
declare
  v_rec record;
  v_val text;
begin
  select english_text, urdu_text, arabic_text, persian_text, pashto_text, original_text, original_language_code
  into v_rec
  from public.record_translations
  where record_table = p_record_table
    and record_id = p_record_id
    and field_name = p_field_name
    and deleted_at is null
  limit 1;

  if not found then
    return null;
  end if;

  v_val := case p_language_code
    when 'ur' then nullif(trim(v_rec.urdu_text), '')
    when 'ar' then nullif(trim(v_rec.arabic_text), '')
    when 'fa' then nullif(trim(v_rec.persian_text), '')
    when 'ps' then nullif(trim(v_rec.pashto_text), '')
    else nullif(trim(v_rec.english_text), '')
  end;

  if v_val is not null then
    return v_val;
  end if;

  -- If requested language translation is missing, return NULL rather than leaking a different language's raw string
  return null;
end;
$fn$;

create or replace function public.resolve_record_translation_v2(
  p_record_table text,
  p_record_id uuid,
  p_field_name text,
  p_language_code text
)
returns text language plpgsql stable set search_path = public as $fn$
begin
  return public.resolve_record_translation(p_record_table, p_record_id, p_field_name, p_language_code);
end;
$fn$;

create or replace function public.resolve_record_translation_v3(
  p_record_table text,
  p_record_id uuid,
  p_field_name text,
  p_language_code text
)
returns text language plpgsql stable set search_path = public as $fn$
begin
  return public.resolve_record_translation(p_record_table, p_record_id, p_field_name, p_language_code);
end;
$fn$;
