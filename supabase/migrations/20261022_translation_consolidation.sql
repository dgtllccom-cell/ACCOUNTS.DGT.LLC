-- ============================================================================
-- 20261022 — Translation architecture consolidation.
--
-- Owner requirement: ONE centralised multilingual system. The canonical store is
-- record_translations (a VIEW over translations_english / _urdu / _arabic /
-- _persian / _pashto), written only through upsert_record_translation().
--
-- Removes the abandoned "per-module dedicated language table" layer that the
-- original 20260808 automation created — public.<table>_<lang> (accounts_en,
-- banks_ur, …) — plus the RECURSIVE tables it spawned once the field registry
-- was polluted with already-suffixed names (accounts_en_en, …). All of those
-- tables are empty or fully superseded by record_translations; nothing reads them.
--
-- The DROP work is split into one transaction per language suffix (COMMIT
-- between blocks) so it does not exhaust max_locks_per_transaction. A companion
-- pre-flight, scripts/verify-translation-consolidation-safe.mjs, proves no row
-- is lost; step 3a re-checks the same inside the migration.
--
-- Idempotent / re-runnable.
-- ============================================================================

-- ── 1) De-pollute the field registry ────────────────────────────────────────
delete from public.translation_field_registry
where table_name ~ '_(en|ur|ar|fa|ps)$';

do $blk$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'translation_field_registry'
      and constraint_name = 'translation_field_registry_base_table_only'
  ) then
    alter table public.translation_field_registry
      add constraint translation_field_registry_base_table_only
      check (table_name !~ '_(en|ur|ar|fa|ps)$');
  end if;
end
$blk$;
commit;

-- ── 2) Neutralise the per-module table provisioner (no-op, keep signature) ──
create or replace function public.provision_module_translation_tables() returns integer
language plpgsql security definer set search_path = public as $fn$
begin
  return 0;  -- consolidated architecture: translations live in record_translations only
end
$fn$;
commit;

-- ── 3a) DATA-SAFETY ASSERTION (read-only) ─────────────────────────────────
do $blk$
declare
  r record;
  base text;
  n_rows bigint;
  n_missing bigint;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r'
      and c.relname ~ '_(en|ur|ar|fa|ps)(_(en|ur|ar|fa|ps))?$'
      and c.relname not in ('translations_english','translations_urdu','translations_arabic','translations_persian','translations_pashto')
      and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')
  loop
    execute format('select count(*) from public.%I', r.table_name) into n_rows;
    continue when n_rows = 0;
    base := regexp_replace(r.table_name, '_(en|ur|ar|fa|ps)(_(en|ur|ar|fa|ps))?$', '');
    execute format($q$
      select count(*) from public.%I t
      where not exists (
        select 1 from public.record_translations rt
        where rt.record_table=%L and rt.record_id=t.record_id and rt.field_name=t.field_name
      )
    $q$, r.table_name, base) into n_missing;
    if n_missing > 0 then
      raise exception 'Refusing to consolidate: % has % row(s) not preserved in record_translations for base %', r.table_name, n_missing, base;
    end if;
  end loop;
end
$blk$;
commit;

-- ── 3b) Drop the per-module + recursive language tables (one txn per suffix) ─
do $blk$
declare r record; n int := 0;
begin
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r' and c.relname ~ '_en$'
      and c.relname <> 'translations_english'
      and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')
  loop execute format('drop table if exists public.%I cascade', r.relname); n := n + 1; end loop;
  raise notice '20261022: dropped % *_en tables', n;
end
$blk$;
commit;

do $blk$
declare r record; n int := 0;
begin
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r' and c.relname ~ '_ur$'
      and c.relname <> 'translations_urdu'
      and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')
  loop execute format('drop table if exists public.%I cascade', r.relname); n := n + 1; end loop;
  raise notice '20261022: dropped % *_ur tables', n;
end
$blk$;
commit;

do $blk$
declare r record; n int := 0;
begin
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r' and c.relname ~ '_ar$'
      and c.relname <> 'translations_arabic'
      and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')
  loop execute format('drop table if exists public.%I cascade', r.relname); n := n + 1; end loop;
  raise notice '20261022: dropped % *_ar tables', n;
end
$blk$;
commit;

do $blk$
declare r record; n int := 0;
begin
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r' and c.relname ~ '_fa$'
      and c.relname <> 'translations_persian'
      and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')
  loop execute format('drop table if exists public.%I cascade', r.relname); n := n + 1; end loop;
  raise notice '20261022: dropped % *_fa tables', n;
end
$blk$;
commit;

do $blk$
declare r record; n int := 0;
begin
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r' and c.relname ~ '_ps$'
      and c.relname <> 'translations_pashto'
      and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')
  loop execute format('drop table if exists public.%I cascade', r.relname); n := n + 1; end loop;
  raise notice '20261022: dropped % *_ps tables', n;
end
$blk$;
commit;

-- Catch any left over (e.g. <base>_<lang1>_<lang2> whose last segment somehow
-- did not match above) — final sweep, still one dedicated transaction.
do $blk$
declare r record; n int := 0;
begin
  for r in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='public' and c.relkind='r'
      and c.relname ~ '_(en|ur|ar|fa|ps)(_(en|ur|ar|fa|ps))?$'
      and c.relname not in ('translations_english','translations_urdu','translations_arabic','translations_persian','translations_pashto')
      and exists (select 1 from information_schema.columns col where col.table_schema='public' and col.table_name=c.relname and col.column_name='translated_text')
  loop execute format('drop table if exists public.%I cascade', r.relname); n := n + 1; end loop;
  raise notice '20261022: final sweep dropped % tables', n;
end
$blk$;
commit;

-- ── 4) Make the enrollment trigger NON-DESTRUCTIVE ────────────────────────
-- The old body wrote the ORIGINAL text into all five language slots with status
-- 'complete' on every INSERT **and UPDATE** — so any later edit clobbered the
-- verified translations the app's Local Translator produced (root cause of
-- "mixed English/Urdu" records). New: seed a field only when not yet enrolled,
-- or when the source text itself changed; status 'pending'. The app engine is
-- the sole authority for verified renderings.
create or replace function public.tg_enroll_translations() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  r record;
  v_val text;
  v_id_text text;
  v_id uuid;
  v_existing_orig text;
begin
  begin execute 'select ($1).id::text' into v_id_text using NEW; exception when others then return NEW; end;
  if v_id_text is null then return NEW; end if;
  begin v_id := v_id_text::uuid; exception when others then return NEW; end;

  for r in select field_name from public.translation_field_registry
           where table_name = TG_TABLE_NAME and is_active loop
    begin
      execute format('select ($1).%I::text', r.field_name) into v_val using NEW;
      if v_val is null or btrim(v_val) = '' then continue; end if;

      select original_text into v_existing_orig
      from public.record_translations
      where record_table = TG_TABLE_NAME and record_id = v_id and field_name = r.field_name;

      if v_existing_orig is null or v_existing_orig is distinct from v_val then
        perform public.upsert_record_translation(
          TG_TABLE_NAME, v_id, r.field_name, v_val, 'en',
          v_val, v_val, v_val, v_val, v_val,
          jsonb_build_object('en',v_val,'ur',v_val,'ar',v_val,'fa',v_val,'ps',v_val),
          'imported','pending','trigger_enroll', null);
      end if;
    exception when others then null;
    end;
  end loop;
  return NEW;
end
$fn$;
commit;

-- ── 5) Re-assert the enrollment triggers (provision is now a no-op) ────────
select public.attach_translation_triggers();
