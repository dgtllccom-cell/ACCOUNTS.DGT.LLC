-- ============================================================================
-- 20261022 — Translation architecture consolidation.
--
-- Owner requirement: ONE centralised multilingual system. The canonical store is
-- record_translations (a VIEW over translations_english / _urdu / _arabic /
-- _persian / _pashto), written only through upsert_record_translation().
--
-- This migration removes the abandoned "per-module dedicated language table"
-- layer that the original 20260808 automation created — public.<table>_<lang>
-- (e.g. accounts_en, banks_ur) — together with the RECURSIVE tables it spawned
-- once the field registry was polluted with already-suffixed names
-- (accounts_en_en, account_groups_ur_ps, …). All of those tables are empty or
-- fully superseded by record_translations; nothing in the app reads them.
--
-- Data-safety: the DROP loop first ASSERTS that every (record_id, field_name)
-- held in a non-empty per-module table already exists in record_translations
-- for that base table. If any row is not preserved, the migration RAISES and
-- nothing is dropped.
--
-- Idempotent / re-runnable.
-- ============================================================================

-- ── 1) De-pollute the field registry ────────────────────────────────────────
-- Registry table_name must be a REAL base table, never a language-suffixed name.
delete from public.translation_field_registry
where table_name ~ '_(en|ur|ar|fa|ps)$';

do $$
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
end $$;

-- ── 2) Neutralise the per-module table provisioner ──────────────────────────
-- Keep the signature (attach_translation_triggers() still calls it) but make it
-- a no-op so no future deploy re-creates the per-module language tables.
create or replace function public.provision_module_translation_tables() returns integer
language plpgsql security definer set search_path = public as $$
begin
  -- Consolidated architecture: translations live in record_translations only.
  return 0;
end $$;

-- ── 3) Drop the per-module + recursive language tables (data-safe) ──────────
do $$
declare
  r record;
  base text;
  n_rows bigint;
  n_missing bigint;
  dropped int := 0;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind = 'r'
      and c.relname ~ '_(en|ur|ar|fa|ps)(_(en|ur|ar|fa|ps))?$'
      and c.relname not in (
        'translations_english','translations_urdu','translations_arabic',
        'translations_persian','translations_pashto'
      )
      -- must look like a provisioned translation table (has record_id + translated_text)
      and exists (
        select 1 from information_schema.columns col
        where col.table_schema = 'public' and col.table_name = c.relname
          and col.column_name = 'record_id'
      )
      and exists (
        select 1 from information_schema.columns col
        where col.table_schema = 'public' and col.table_name = c.relname
          and col.column_name = 'translated_text'
      )
    order by c.relname
  loop
    -- strip ONE or TWO trailing _<lang> segments to get the real base table name
    base := regexp_replace(r.table_name, '_(en|ur|ar|fa|ps)(_(en|ur|ar|fa|ps))?$', '');

    execute format('select count(*) from public.%I', r.table_name) into n_rows;

    if n_rows > 0 then
      -- assert every row is already preserved in record_translations for the base table
      execute format($q$
        select count(*) from public.%I t
        where not exists (
          select 1 from public.record_translations rt
          where rt.record_table = %L
            and rt.record_id   = t.record_id
            and rt.field_name  = t.field_name
        )
      $q$, r.table_name, base) into n_missing;

      if n_missing > 0 then
        raise exception
          'Refusing to drop %: % row(s) not preserved in record_translations for base table %',
          r.table_name, n_missing, base;
      end if;
    end if;

    execute format('drop table public.%I cascade', r.table_name);
    dropped := dropped + 1;
  end loop;

  raise notice '20261022: dropped % per-module/recursive translation tables', dropped;
end $$;

-- ── 4) Make the enrollment trigger NON-DESTRUCTIVE ─────────────────────────
-- The old body wrote the ORIGINAL text into all five language slots with
-- status 'complete' on every INSERT **and UPDATE** — so any later edit of the
-- row clobbered the real translations the app's Local Translator had produced
-- (this is the root cause of "mixed English/Urdu" records). New behaviour:
-- seed a field only when it is not yet enrolled, or when the source text itself
-- changed (old translations are stale anyway). Status 'pending' — the app
-- engine remains the sole authority for verified renderings.
create or replace function public.tg_enroll_translations() returns trigger
language plpgsql security definer set search_path = public as $$
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
end $$;

-- ── 5) Re-assert the enrollment triggers (provision is now a no-op) ─────────
select public.attach_translation_triggers();
