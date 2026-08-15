-- =====================================================================
-- 20260814_per_language_tables.sql
-- Move multilingual storage from the single central `record_translations`
-- table to FIVE dedicated per-language tables, while keeping
-- `record_translations` alive as a drop-in VIEW (Option A: view + triggers)
-- so ALL existing read/write application code keeps working unchanged.
--
-- Design:
--   translations_english  = canonical/base row. Holds the per-field shared
--                           metadata (original_text, original_language_code,
--                           source, status, engine, corrected_by/at,
--                           timestamps, deleted_at) + the English text.
--                           English always exists (the local translator always
--                           emits an `en` value), so it is the natural anchor.
--   translations_urdu / _arabic / _persian / _pashto = skinny tables:
--                           (record_table, record_id, field_name, text, ...).
--
--   VIEW record_translations reconstructs the original column shape by joining
--   the base to the four skinny tables and computing `language_texts` on the fly.
--   INSTEAD OF INSERT/UPDATE/DELETE triggers fan writes back out to the 5 tables.
--   upsert_record_translation() is rewritten to write the 5 tables directly
--   (ON CONFLICT cannot target a view).
--
-- Idempotent: safe to re-run. Backfills from the existing table (0 rows on DEV,
-- ~706k on PROD) before swapping the table out for the view.
-- =====================================================================

-- pg_trgm is already installed (original table had trigram indexes); guard anyway.
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- 1. The five per-language tables
-- ---------------------------------------------------------------------

-- English = base / canonical (carries shared per-field metadata)
create table if not exists public.translations_english (
  id                     uuid primary key default gen_random_uuid(),
  record_table           text not null,
  record_id              uuid not null,
  field_name             text not null,
  text                   text,                              -- english translation (mirrors english_text)
  original_text          text not null default '',
  original_language_code text not null default 'en',
  source                 public.translation_source not null default 'auto',
  translation_status     text not null default 'complete',
  translated_by_engine   text not null default 'local_dictionary',
  corrected_by           uuid references public.profiles(id),
  corrected_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  translated_at          timestamptz not null default now(),
  deleted_at             timestamptz
);

-- Skinny language tables share the same key + text shape.
create table if not exists public.translations_urdu (
  id           uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id    uuid not null,
  field_name   text not null,
  text         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.translations_arabic (
  id           uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id    uuid not null,
  field_name   text not null,
  text         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.translations_persian (
  id           uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id    uuid not null,
  field_name   text not null,
  text         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.translations_pashto (
  id           uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id    uuid not null,
  field_name   text not null,
  text         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Partial unique indexes (mirror the original: one active row per field).
create unique index if not exists translations_english_field_uidx
  on public.translations_english (record_table, record_id, field_name) where deleted_at is null;
create unique index if not exists translations_urdu_field_uidx
  on public.translations_urdu (record_table, record_id, field_name) where deleted_at is null;
create unique index if not exists translations_arabic_field_uidx
  on public.translations_arabic (record_table, record_id, field_name) where deleted_at is null;
create unique index if not exists translations_persian_field_uidx
  on public.translations_persian (record_table, record_id, field_name) where deleted_at is null;
create unique index if not exists translations_pashto_field_uidx
  on public.translations_pashto (record_table, record_id, field_name) where deleted_at is null;

-- Trigram indexes for the ilike search functions.
create index if not exists translations_english_trgm on public.translations_english using gin (text gin_trgm_ops) where deleted_at is null;
create index if not exists translations_english_orig_trgm on public.translations_english using gin (original_text gin_trgm_ops) where deleted_at is null;
create index if not exists translations_urdu_trgm on public.translations_urdu using gin (text gin_trgm_ops) where deleted_at is null;
create index if not exists translations_arabic_trgm on public.translations_arabic using gin (text gin_trgm_ops) where deleted_at is null;
create index if not exists translations_persian_trgm on public.translations_persian using gin (text gin_trgm_ops) where deleted_at is null;
create index if not exists translations_pashto_trgm on public.translations_pashto using gin (text gin_trgm_ops) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. Backfill from the existing central table (if it is still a real table)
--    0 rows on DEV, ~706k on PROD. Only runs when record_translations is a
--    base table (relkind = 'r'); once swapped to a view this block is skipped.
-- ---------------------------------------------------------------------
do $backfill$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'record_translations' and c.relkind = 'r'
  ) then
    insert into public.translations_english
      (id, record_table, record_id, field_name, text, original_text, original_language_code,
       source, translation_status, translated_by_engine, corrected_by, corrected_at,
       created_at, updated_at, translated_at, deleted_at)
    select id, record_table, record_id, field_name, english_text,
           coalesce(original_text, ''), coalesce(original_language_code, 'en'),
           source, translation_status, translated_by_engine, corrected_by, corrected_at,
           created_at, updated_at, translated_at, deleted_at
    from public.record_translations
    on conflict (id) do nothing;

    insert into public.translations_urdu (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
    select record_table, record_id, field_name, urdu_text, created_at, updated_at, deleted_at from public.record_translations
    on conflict do nothing;

    insert into public.translations_arabic (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
    select record_table, record_id, field_name, arabic_text, created_at, updated_at, deleted_at from public.record_translations
    on conflict do nothing;

    insert into public.translations_persian (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
    select record_table, record_id, field_name, persian_text, created_at, updated_at, deleted_at from public.record_translations
    on conflict do nothing;

    insert into public.translations_pashto (record_table, record_id, field_name, text, created_at, updated_at, deleted_at)
    select record_table, record_id, field_name, pashto_text, created_at, updated_at, deleted_at from public.record_translations
    on conflict do nothing;

    -- Retire the old table (keep as a backup, do not drop).
    alter table public.record_translations rename to record_translations_legacy;
  end if;
end
$backfill$;

-- ---------------------------------------------------------------------
-- 3. The drop-in view (same columns the app already reads/writes)
-- ---------------------------------------------------------------------
drop view if exists public.record_translations;
create view public.record_translations
with (security_invoker = true) as
select
  e.id,
  e.record_table,
  e.record_id,
  e.field_name,
  e.original_text,
  e.original_language_code,
  e.text        as english_text,
  ar.text       as arabic_text,
  ur.text       as urdu_text,
  fa.text       as persian_text,
  ps.text       as pashto_text,
  e.source,
  e.corrected_by,
  e.corrected_at,
  e.created_at,
  e.updated_at,
  e.deleted_at,
  jsonb_strip_nulls(jsonb_build_object(
    'en', e.text, 'ur', ur.text, 'ar', ar.text, 'fa', fa.text, 'ps', ps.text
  )) as language_texts,
  e.translation_status,
  e.translated_by_engine,
  e.translated_at
from public.translations_english e
left join public.translations_urdu    ur on ur.record_table = e.record_table and ur.record_id = e.record_id and ur.field_name = e.field_name and ur.deleted_at is null
left join public.translations_arabic  ar on ar.record_table = e.record_table and ar.record_id = e.record_id and ar.field_name = e.field_name and ar.deleted_at is null
left join public.translations_persian fa on fa.record_table = e.record_table and fa.record_id = e.record_id and fa.field_name = e.field_name and fa.deleted_at is null
left join public.translations_pashto  ps on ps.record_table = e.record_table and ps.record_id = e.record_id and ps.field_name = e.field_name and ps.deleted_at is null;

-- ---------------------------------------------------------------------
-- 4. INSTEAD OF triggers so the view is writable (direct .insert/.update paths)
-- ---------------------------------------------------------------------
create or replace function public.record_translations_view_insert()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.translations_english
    (id, record_table, record_id, field_name, text, original_text, original_language_code,
     source, translation_status, translated_by_engine, corrected_by, corrected_at,
     created_at, updated_at, translated_at, deleted_at)
  values
    (coalesce(new.id, gen_random_uuid()), new.record_table, new.record_id, new.field_name, new.english_text,
     coalesce(new.original_text, new.english_text, ''), coalesce(new.original_language_code, 'en'),
     coalesce(new.source, 'auto'), coalesce(new.translation_status, 'complete'),
     coalesce(new.translated_by_engine, 'local_dictionary'), new.corrected_by, new.corrected_at,
     coalesce(new.created_at, now()), coalesce(new.updated_at, now()), coalesce(new.translated_at, now()), new.deleted_at)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, original_text = excluded.original_text,
     original_language_code = excluded.original_language_code, source = excluded.source,
     translation_status = excluded.translation_status, translated_by_engine = excluded.translated_by_engine,
     corrected_by = excluded.corrected_by, corrected_at = excluded.corrected_at,
     translated_at = excluded.translated_at, updated_at = now()
  returning id into v_id;
  new.id := v_id;

  insert into public.translations_urdu (record_table, record_id, field_name, text)
  values (new.record_table, new.record_id, new.field_name, new.urdu_text)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_arabic (record_table, record_id, field_name, text)
  values (new.record_table, new.record_id, new.field_name, new.arabic_text)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_persian (record_table, record_id, field_name, text)
  values (new.record_table, new.record_id, new.field_name, new.persian_text)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_pashto (record_table, record_id, field_name, text)
  values (new.record_table, new.record_id, new.field_name, new.pashto_text)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  return new;
end
$fn$;

create or replace function public.record_translations_view_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  update public.translations_english set
    text = new.english_text,
    original_text = coalesce(new.original_text, original_text),
    original_language_code = coalesce(new.original_language_code, original_language_code),
    source = coalesce(new.source, source),
    translation_status = coalesce(new.translation_status, translation_status),
    translated_by_engine = coalesce(new.translated_by_engine, translated_by_engine),
    corrected_by = new.corrected_by,
    corrected_at = new.corrected_at,
    translated_at = coalesce(new.translated_at, translated_at),
    deleted_at = new.deleted_at,
    updated_at = now()
  where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name
    and deleted_at is null;

  -- Upsert each skinny language (update active row, else insert).
  update public.translations_urdu set text = new.urdu_text, deleted_at = new.deleted_at, updated_at = now()
    where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name and deleted_at is null;
  if not found then
    insert into public.translations_urdu (record_table, record_id, field_name, text, deleted_at)
    values (old.record_table, old.record_id, old.field_name, new.urdu_text, new.deleted_at);
  end if;

  update public.translations_arabic set text = new.arabic_text, deleted_at = new.deleted_at, updated_at = now()
    where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name and deleted_at is null;
  if not found then
    insert into public.translations_arabic (record_table, record_id, field_name, text, deleted_at)
    values (old.record_table, old.record_id, old.field_name, new.arabic_text, new.deleted_at);
  end if;

  update public.translations_persian set text = new.persian_text, deleted_at = new.deleted_at, updated_at = now()
    where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name and deleted_at is null;
  if not found then
    insert into public.translations_persian (record_table, record_id, field_name, text, deleted_at)
    values (old.record_table, old.record_id, old.field_name, new.persian_text, new.deleted_at);
  end if;

  update public.translations_pashto set text = new.pashto_text, deleted_at = new.deleted_at, updated_at = now()
    where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name and deleted_at is null;
  if not found then
    insert into public.translations_pashto (record_table, record_id, field_name, text, deleted_at)
    values (old.record_table, old.record_id, old.field_name, new.pashto_text, new.deleted_at);
  end if;

  return new;
end
$fn$;

create or replace function public.record_translations_view_delete()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  delete from public.translations_urdu    where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name;
  delete from public.translations_arabic  where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name;
  delete from public.translations_persian where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name;
  delete from public.translations_pashto  where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name;
  delete from public.translations_english where record_table = old.record_table and record_id = old.record_id and field_name = old.field_name;
  return old;
end
$fn$;

drop trigger if exists record_translations_ii on public.record_translations;
drop trigger if exists record_translations_iu on public.record_translations;
drop trigger if exists record_translations_id on public.record_translations;
create trigger record_translations_ii instead of insert on public.record_translations for each row execute function public.record_translations_view_insert();
create trigger record_translations_iu instead of update on public.record_translations for each row execute function public.record_translations_view_update();
create trigger record_translations_id instead of delete on public.record_translations for each row execute function public.record_translations_view_delete();

-- ---------------------------------------------------------------------
-- 5. Rewrite upsert_record_translation() to write the 5 tables directly.
--    (Same signature the app already calls via db.rpc.)
-- ---------------------------------------------------------------------
drop function if exists public.upsert_record_translation CASCADE;
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
declare v_id uuid;
begin
  insert into public.translations_english
    (record_table, record_id, field_name, text, original_text, original_language_code,
     source, translation_status, translated_by_engine, corrected_by, corrected_at, translated_at, updated_at)
  values
    (p_record_table, p_record_id, p_field_name, p_english, coalesce(p_original_text, ''),
     coalesce(p_original_language_code, 'en'), coalesce(p_source, 'auto')::public.translation_source,
     coalesce(p_translation_status, 'complete'), coalesce(p_translated_by_engine, 'local_dictionary'),
     case when p_source = 'manual' then p_actor_id else null end,
     case when p_source = 'manual' then now() else null end,
     now(), now())
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, original_text = excluded.original_text,
     original_language_code = excluded.original_language_code, source = excluded.source,
     translation_status = excluded.translation_status, translated_by_engine = excluded.translated_by_engine,
     corrected_by = excluded.corrected_by, corrected_at = excluded.corrected_at,
     translated_at = now(), updated_at = now()
  returning id into v_id;

  insert into public.translations_urdu (record_table, record_id, field_name, text)
  values (p_record_table, p_record_id, p_field_name, p_urdu)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_arabic (record_table, record_id, field_name, text)
  values (p_record_table, p_record_id, p_field_name, p_arabic)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_persian (record_table, record_id, field_name, text)
  values (p_record_table, p_record_id, p_field_name, p_persian)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  insert into public.translations_pashto (record_table, record_id, field_name, text)
  values (p_record_table, p_record_id, p_field_name, p_pashto)
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set text = excluded.text, updated_at = now();

  return v_id;
end
$fn$;

-- ---------------------------------------------------------------------
-- 5b. Read helpers (resolve/search) — recreated so a FRESH database (e.g. a
--     plain local Postgres) is self-sufficient. On Supabase these already
--     exist; `create or replace` with identical bodies is a harmless no-op.
--     All of them read `record_translations` (now the view).
-- ---------------------------------------------------------------------
create or replace function public.resolve_record_translation(p_record_table text, p_record_id uuid, p_field_name text, p_language_code text)
returns text language sql stable as $fn$
  select coalesce(
    case p_language_code
      when 'ur' then urdu_text when 'ps' then pashto_text when 'ar' then arabic_text when 'fa' then persian_text
      else english_text end,
    english_text, original_text)
  from public.record_translations
  where record_table = p_record_table and record_id = p_record_id and field_name = p_field_name and deleted_at is null
  limit 1;
$fn$;

create or replace function public.resolve_record_translation_v2(p_record_table text, p_record_id uuid, p_field_name text, p_language_code text)
returns text language sql stable as $fn$
  select coalesce(
    language_texts ->> p_language_code,
    case p_language_code
      when 'ur' then urdu_text when 'ps' then pashto_text when 'ar' then arabic_text when 'fa' then persian_text
      else english_text end,
    english_text, original_text)
  from public.record_translations
  where record_table = p_record_table and record_id = p_record_id and field_name = p_field_name and deleted_at is null
  limit 1;
$fn$;

create or replace function public.resolve_record_translation_v3(p_record_table text, p_record_id uuid, p_field_name text, p_language_code text)
returns text language sql stable as $fn$
  select coalesce(
    language_texts ->> p_language_code,
    case p_language_code
      when 'ur' then urdu_text when 'ps' then pashto_text when 'ar' then arabic_text when 'fa' then persian_text
      else english_text end,
    english_text, original_text)
  from public.record_translations
  where record_table = p_record_table and record_id = p_record_id and field_name = p_field_name and deleted_at is null
  limit 1;
$fn$;

create or replace function public.search_record_translations(p_language_code text, p_query text, p_record_table text default null)
returns table(record_table text, record_id uuid, field_name text, resolved_text text) language sql stable as $fn$
  select rt.record_table, rt.record_id, rt.field_name,
    coalesce(
      case p_language_code
        when 'ur' then rt.urdu_text when 'ps' then rt.pashto_text when 'ar' then rt.arabic_text when 'fa' then rt.persian_text
        else rt.english_text end,
      rt.english_text, rt.original_text) as resolved_text
  from public.record_translations rt
  where rt.deleted_at is null and (p_record_table is null or rt.record_table = p_record_table)
    and (rt.original_text ilike '%'||p_query||'%' or rt.english_text ilike '%'||p_query||'%'
      or rt.urdu_text ilike '%'||p_query||'%' or rt.pashto_text ilike '%'||p_query||'%'
      or rt.arabic_text ilike '%'||p_query||'%' or rt.persian_text ilike '%'||p_query||'%')
  order by rt.updated_at desc;
$fn$;

create or replace function public.search_record_translations_v2(p_language_code text, p_query text, p_record_table text default null)
returns table(record_table text, record_id uuid, field_name text, resolved_text text) language sql stable as $fn$
  select rt.record_table, rt.record_id, rt.field_name,
    coalesce(
      rt.language_texts ->> p_language_code,
      case p_language_code
        when 'ur' then rt.urdu_text when 'ps' then rt.pashto_text when 'ar' then rt.arabic_text when 'fa' then rt.persian_text
        else rt.english_text end,
      rt.english_text, rt.original_text) as resolved_text
  from public.record_translations rt
  where rt.deleted_at is null and (p_record_table is null or rt.record_table = p_record_table)
    and (rt.original_text ilike '%'||p_query||'%' or rt.english_text ilike '%'||p_query||'%'
      or rt.urdu_text ilike '%'||p_query||'%' or rt.pashto_text ilike '%'||p_query||'%'
      or rt.arabic_text ilike '%'||p_query||'%' or rt.persian_text ilike '%'||p_query||'%'
      or rt.language_texts::text ilike '%'||p_query||'%')
  order by rt.updated_at desc;
$fn$;

-- ---------------------------------------------------------------------
-- 6. RLS + grants (Supabase posture). Guarded so this migration also runs
--    on a plain local Postgres that has no `auth` schema / Supabase roles.
-- ---------------------------------------------------------------------
do $sec$
declare
  t text;
  has_auth_uid boolean := exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  );
  existing_roles text[] := array(
    select rolname from pg_roles where rolname in ('anon','authenticated','service_role')
  );
  grant_targets text := array_to_string(existing_roles, ', ');
begin
  foreach t in array array[
    'translations_english','translations_urdu','translations_arabic','translations_persian','translations_pashto'
  ] loop
    if has_auth_uid then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I_read on public.%I', t, t);
      execute format('drop policy if exists %I_insert on public.%I', t, t);
      execute format('drop policy if exists %I_update on public.%I', t, t);
      execute format('create policy %I_read on public.%I for select using (auth.uid() is not null)', t, t);
      execute format('create policy %I_insert on public.%I for insert with check (auth.uid() is not null)', t, t);
      execute format('create policy %I_update on public.%I for update using (auth.uid() is not null)', t, t);
    end if;
    if grant_targets <> '' then
      execute format('grant select, insert, update, delete on public.%I to %s', t, grant_targets);
    end if;
  end loop;

  if grant_targets <> '' then
    execute format('grant select, insert, update, delete on public.record_translations to %s', grant_targets);
  end if;
end
$sec$;

-- Ask PostgREST to reload its schema cache so the view replaces the table
-- (harmless no-op on a plain Postgres with no PostgREST listener).
notify pgrst, 'reload schema';
