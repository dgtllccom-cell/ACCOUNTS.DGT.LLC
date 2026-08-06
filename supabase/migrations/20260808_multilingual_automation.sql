-- ============================================================================
-- Multilingual automation — permanent, self-restoring database layer.
--
-- Idempotent (create-or-replace / if-not-exists / on-conflict). Safe to replay on
-- every environment (local, VPS, production) so the five-language architecture is
-- automatically rebuilt on any deploy/restore.
--
-- Objects:
--   * upsert_record_translation()        — write one translation row (partial-index safe)
--   * backfill_record_translations()     — enroll a whole table/field (bulk)
--   * backfill_translation_keyset()       — resumable, batched backfill for LARGE tables
--   * translation_field_registry          — DB source of truth for eligible fields
--   * tg_enroll_translations()            — universal AFTER INSERT/UPDATE enrollment trigger
--   * attach_translation_triggers()       — (re)attach the trigger to every registered table
--
-- The app-side mirror of the registry is lib/i18n/translatable-fields.ts; the
-- scripts/i18n-scan.mjs validator flags any new user-facing field not registered here.
-- ============================================================================

-- ── 1) Upsert one translation row (handles the PARTIAL unique index) ────────────
create or replace function public.upsert_record_translation(
  p_record_table text, p_record_id uuid, p_field_name text, p_original_text text,
  p_original_language_code text, p_english text, p_urdu text, p_arabic text, p_persian text,
  p_pashto text, p_language_texts jsonb, p_source text default 'auto',
  p_translation_status text default 'complete', p_translated_by_engine text default 'local_dictionary',
  p_actor_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_source translation_source := coalesce(nullif(p_source,''),'auto')::translation_source;
begin
  insert into record_translations (record_table, record_id, field_name, original_text, original_language_code,
    english_text, urdu_text, arabic_text, persian_text, pashto_text, language_texts, source, translation_status,
    translated_by_engine, translated_at, corrected_by, corrected_at, created_at, updated_at)
  values (p_record_table, p_record_id, p_field_name, p_original_text, coalesce(nullif(p_original_language_code,''),'en'),
    p_english, p_urdu, p_arabic, p_persian, p_pashto, coalesce(p_language_texts,'{}'::jsonb), v_source,
    coalesce(nullif(p_translation_status,''),'complete'), coalesce(nullif(p_translated_by_engine,''),'local_dictionary'), now(),
    case when v_source='manual' then p_actor_id else null end,
    case when v_source='manual' then now() else null end, now(), now())
  on conflict (record_table, record_id, field_name) where deleted_at is null
  do update set original_text=excluded.original_text, original_language_code=excluded.original_language_code,
    english_text=excluded.english_text, urdu_text=excluded.urdu_text, arabic_text=excluded.arabic_text,
    persian_text=excluded.persian_text, pashto_text=excluded.pashto_text, language_texts=excluded.language_texts,
    source=excluded.source, translation_status=excluded.translation_status, translated_by_engine=excluded.translated_by_engine,
    translated_at=now(), corrected_by=excluded.corrected_by, corrected_at=excluded.corrected_at, updated_at=now()
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.upsert_record_translation(text,uuid,text,text,text,text,text,text,text,text,jsonb,text,text,text,uuid) to authenticated, service_role;

-- ── 2) Bulk backfill one table/field ────────────────────────────────────────────
create or replace function public.backfill_record_translations(p_table text, p_field text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; has_deleted boolean; sql text;
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name=p_field) then return -2; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='id') then return -3; end if;
  has_deleted := exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='deleted_at');
  sql := format($f$
    insert into record_translations (record_table, record_id, field_name, original_text, original_language_code,
      english_text, urdu_text, arabic_text, persian_text, pashto_text, language_texts, source, translation_status,
      translated_by_engine, translated_at, created_at, updated_at)
    select %L, t.id, %L, t.%I::text, 'en', t.%I::text, t.%I::text, t.%I::text, t.%I::text, t.%I::text,
      jsonb_build_object('en',t.%I::text,'ur',t.%I::text,'ar',t.%I::text,'fa',t.%I::text,'ps',t.%I::text),
      'imported','pending','backfill_pending', now(), now(), now()
    from %I t
    where t.%I is not null and btrim(t.%I::text) <> '' %s
      and not exists (select 1 from record_translations r where r.record_table=%L and r.record_id=t.id and r.field_name=%L and r.deleted_at is null)
  $f$, p_table, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field, p_field,
       p_table, p_field, p_field, case when has_deleted then 'and t.deleted_at is null' else '' end, p_table, p_field);
  execute sql; get diagnostics n = row_count; return n;
exception when others then return -1;
end $$;

-- ── 3) Resumable, batched backfill for LARGE tables (keyset by id) ───────────────
create or replace function public.backfill_translation_keyset(
  p_table text, p_field text, p_after text default null, p_limit int default 50000
) returns jsonb language plpgsql security definer set search_path = public as $$
declare has_deleted boolean; sql text; res jsonb;
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name=p_field) then return jsonb_build_object('error','field_missing'); end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='id') then return jsonb_build_object('error','no_id'); end if;
  has_deleted := exists (select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name='deleted_at');
  sql := format($f$
    with batch as (
      select t.id, t.%I::text as val from %I t
      where (%L::uuid is null or t.id > %L::uuid) and t.%I is not null and btrim(t.%I::text) <> '' %s
      order by t.id limit %s
    ), ins as (
      insert into record_translations (record_table, record_id, field_name, original_text, original_language_code,
        english_text, urdu_text, arabic_text, persian_text, pashto_text, language_texts, source, translation_status,
        translated_by_engine, translated_at, created_at, updated_at)
      select %L, b.id, %L, b.val, 'en', b.val, b.val, b.val, b.val, b.val,
        jsonb_build_object('en',b.val,'ur',b.val,'ar',b.val,'fa',b.val,'ps',b.val),
        'imported','pending','backfill_pending', now(), now(), now()
      from batch b on conflict (record_table, record_id, field_name) where deleted_at is null do nothing returning 1
    )
    select jsonb_build_object('scanned',(select count(*) from batch),'inserted',(select count(*) from ins),'last_id',(select id from batch order by id desc limit 1))
  $f$, p_field, p_table, p_after, p_after, p_field, p_field,
       case when has_deleted then 'and t.deleted_at is null' else '' end, p_limit, p_table, p_field);
  execute sql into res; return res;
exception when others then return jsonb_build_object('error', SQLERRM);
end $$;

-- ── 4) Registry: DB source of truth for eligible fields ──────────────────────────
create table if not exists public.translation_field_registry (
  table_name text not null,
  field_name text not null,
  mode text not null default 'translate' check (mode in ('translate','transliterate')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (table_name, field_name)
);

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('account_groups','name','transliterate'),('account_types','name','translate'),('accounts','name','transliterate'),('enterprise_accounts','name','transliterate'),('ledgers','name','transliterate'),('financial_periods','period_name','transliterate'),('countries','name','transliterate'),('states_provinces','name','transliterate'),('districts','name','transliterate'),('cities','name','transliterate'),('areas_locations','name','transliterate'),('postal_codes','place_name','transliterate'),('postal_codes','admin1_name','transliterate'),('postal_codes','admin2_name','transliterate'),('postal_codes','admin3_name','transliterate'),('loading_ports','port_name','transliterate'),('received_ports','port_name','transliterate'),('ports','port_name','transliterate'),('parent_business_groups','name','transliterate'),('parent_business_groups','legal_name','transliterate'),('companies','name','transliterate'),('companies','legal_name','transliterate'),('companies','owner_name','transliterate'),('companies','city_name','transliterate'),('companies','state_name','transliterate'),('companies','district_name','transliterate'),('companies','area_name','transliterate'),('companies','country_name','transliterate'),('country_company_profiles','company_name','transliterate'),('country_company_profiles','legal_name','transliterate'),('country_company_profiles','hr_manager_name','transliterate'),('country_company_profiles','hr_department_name','translate'),('customers','customer_name','transliterate'),('customers','company_name','transliterate'),('customers','contact_person','transliterate'),('branches','name','transliterate'),('branches','owner_name','transliterate'),('country_branches','name','transliterate'),('country_branches','owner_name','transliterate'),('country_branches','branding_company_name','translate'),('country_branches','branding_address','translate'),('country_branches','branding_report_header','translate'),('country_branches','branding_report_footer','translate'),('city_branches','name','transliterate'),('city_branches','city_name','transliterate'),('city_branches','owner_name','transliterate'),('city_branches','branding_company_name','translate'),('city_branches','branding_address','translate'),('city_branches','branding_report_header','translate'),('city_branches','branding_report_footer','translate'),('clearing_agents','name','transliterate'),('clearing_agent_branches','name','transliterate'),('banks','bank_name','transliterate'),('banks','branch_name','transliterate'),('banks','short_name','transliterate'),('banks','account_title','translate'),('profiles','full_name','transliterate'),('products','product_name','translate'),('products','product_description','translate'),('product_categories','category_name','translate'),('product_categories','description','translate'),('product_brands','brand_name','translate'),('product_brands','description','translate'),('product_units','unit_name','translate'),('goods','goods_name','translate'),('goods_variations','brand','translate'),('warehouses','warehouse_name','transliterate'),('warehouses','owner_name','transliterate'),('warehouses','description','translate'),('contact_types','name','translate'),('payment_methods','name','translate'),('tax_codes','tax_name','translate'),('tax_codes','country_name','transliterate'),('roles','name','translate'),('roles','description','translate'),('erp_role_templates','name','translate'),('erp_role_templates','description','translate'),('permissions','description','translate'),('erp_modules','name','translate'),('erp_modules','description','translate'),('management_categories','name','translate'),('management_categories','description','translate'),('management_parameters','name','translate'),('management_parameters','description','translate'),('report_definitions','name','translate'),('report_definitions','description','translate'),('erp_report_templates','report_title','translate'),('shipping_line_records','shipping_line_name','transliterate'),('shipping_line_records','vessel_name','transliterate'),('shipping_bl_records','shipping_line_name','transliterate'),('shipping_bl_records','vessel_name','transliterate'),('shipment_documents','document_type','translate'),('purchase_loading_records','carrier_name','transliterate'),('purchase_order_items','goods_name','translate'),('purchase_order_items','brand','translate'),('purchase_order_items','unit_name','translate'),('local_purchases','goods_name','translate'),('local_purchases','brand','translate'),('local_purchases','supplier_name','transliterate'),('local_purchases','driver_name','transliterate'),('local_purchases','warehouse_name','transliterate'),('local_purchases','origin_country_name','transliterate'),('import_truck_loadings','goods_name','translate'),('import_truck_loadings','supplier_name','transliterate'),('import_truck_loadings','importer_name','transliterate'),('import_truck_loadings','driver_name','transliterate'),('transit_truck_loadings','goods_name','translate'),('transit_truck_loadings','driver_name','transliterate'),('truck_loadings','goods_name','translate'),('truck_loadings','driver_name','transliterate'),('truck_loadings','truck_name','transliterate'),('truck_loadings','truck_owner_name','transliterate'),('trucks','driver_name','transliterate'),('trucks','owner_name','transliterate'),('money_exchange_entries','receipt_name','transliterate'),('money_exchange_entries','received_office_name','transliterate'),('money_exchange_entries','purchase_city','transliterate'),('money_exchange_entries','received_city','transliterate'),('expenses_bills','bill_title','translate'),('sales_orders','customer_name','transliterate'),('office_documents','title','translate'),('office_documents','category','translate'),('office_documents','country_name','transliterate'),('office_documents','main_branch_name','transliterate'),('office_documents','city_branch_name','transliterate'),('communication_templates','title','translate'),('communication_templates','category','translate'),('communication_center_campaigns','name','transliterate'),('communication_center_campaigns','segment_name','transliterate'),('communication_center_campaigns','body','translate'),('communication_center_followups','title','translate'),('communication_center_leads','lead_name','transliterate'),('communication_center_leads','company_name','transliterate'),('communication_center_leads','contact_person','transliterate'),('communication_center_profiles','office_name','transliterate'),('communication_center_profiles','branch_display_name','translate'),('communication_reminder_rules','rule_name','transliterate'),('erp_email_accounts','display_name','translate'),('erp_email_providers','provider_name','transliterate'),('erp_pdf_email_jobs','document_title','translate'),('erp_assignments','title','translate'),('erp_assignments','message','translate'),('whatsapp_accounts','display_name','translate'),('whatsapp_contacts','display_name','translate'),('whatsapp_messages','template_name','translate')
on conflict (table_name, field_name) do nothing;

-- ── 5) Universal enrollment trigger (never breaks the underlying write) ──────────
create or replace function public.tg_enroll_translations() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; v_val text; v_id_text text; v_id uuid;
begin
  begin execute 'select ($1).id::text' into v_id_text using NEW; exception when others then return NEW; end;
  if v_id_text is null then return NEW; end if;
  begin v_id := v_id_text::uuid; exception when others then return NEW; end;
  for r in select field_name from public.translation_field_registry where table_name = TG_TABLE_NAME and is_active loop
    begin
      execute format('select ($1).%I::text', r.field_name) into v_val using NEW;
      if v_val is not null and btrim(v_val) <> '' then
        perform public.upsert_record_translation(TG_TABLE_NAME, v_id, r.field_name, v_val, 'en',
          v_val, v_val, v_val, v_val, v_val,
          jsonb_build_object('en',v_val,'ur',v_val,'ar',v_val,'fa',v_val,'ps',v_val),
          'imported','pending','trigger_enroll', null);
      end if;
    exception when others then null;
    end;
  end loop;
  return NEW;
end $$;

-- ── 6) Attach the trigger to every registered base table (re-runnable) ───────────
create or replace function public.attach_translation_triggers() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select distinct table_name from public.translation_field_registry where is_active loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=r.table_name and table_type='BASE TABLE')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name=r.table_name and column_name='id') then
      execute format('drop trigger if exists trg_enroll_translations on public.%I', r.table_name);
      execute format('create trigger trg_enroll_translations after insert or update on public.%I for each row execute function public.tg_enroll_translations()', r.table_name);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

select public.attach_translation_triggers();
