-- Centralized multilingual master-data contract for the whole ERP.
-- Non-destructive: adds language columns/functions to existing central masters.

insert into public.languages (code, english_name, native_name, direction, is_default, is_active)
values
  ('en', 'English', 'English', 'ltr', true, true),
  ('ur', 'Urdu', U&'\0627\0631\062F\0648', 'rtl', false, true),
  ('ar', 'Arabic', U&'\0627\0644\0639\0631\0628\064A\0629', 'rtl', false, true),
  ('fa', 'Persian / Farsi', U&'\0641\0627\0631\0633\06CC', 'rtl', false, true),
  ('ps', 'Pashto', U&'\067E\069A\062A\0648', 'rtl', false, true)
on conflict (code) do update set
  english_name = excluded.english_name,
  native_name = excluded.native_name,
  direction = excluded.direction,
  is_active = true;

create or replace function public.erp_resolve_language_text(
  p_en text,
  p_ur text,
  p_ar text,
  p_fa text,
  p_ps text,
  p_language_code text default 'en',
  p_fallback text default null
)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(case lower(coalesce(p_language_code, 'en'))
      when 'ur' then coalesce(p_ur, '')
      when 'ar' then coalesce(p_ar, '')
      when 'fa' then coalesce(p_fa, '')
      when 'ps' then coalesce(p_ps, '')
      else coalesce(p_en, '')
    end), ''),
    nullif(trim(coalesce(p_en, '')), ''),
    nullif(trim(coalesce(p_fallback, '')), ''),
    nullif(trim(coalesce(p_ur, '')), ''),
    nullif(trim(coalesce(p_ar, '')), ''),
    nullif(trim(coalesce(p_fa, '')), ''),
    nullif(trim(coalesce(p_ps, '')), ''),
    ''
  );
$$;

do $$
declare
  master_table text;
  code text;
  language_codes text[] := array['en', 'ur', 'ar', 'fa', 'ps'];
  master_tables text[] := array[
    'countries',
    'states_provinces',
    'districts',
    'cities',
    'areas',
    'postal_codes',
    'goods',
    'goods_variations',
    'products',
    'product_brands',
    'product_categories',
    'product_units',
    'customers',
    'banks',
    'companies',
    'enterprise_accounts',
    'warehouses',
    'country_branches',
    'city_branches'
  ];
begin
  foreach master_table in array master_tables loop
    if to_regclass('public.' || master_table) is null then
      continue;
    end if;

    foreach code in array language_codes loop
      execute format('alter table public.%I add column if not exists name_%s text', master_table, code);
      execute format('alter table public.%I add column if not exists description_%s text', master_table, code);
    end loop;

    execute format('comment on table public.%I is %L', master_table, 'Central ERP master table. Use one row with name_en/name_ur/name_ar/name_fa/name_ps; do not create module-specific duplicate masters.');
  end loop;
end $$;

create or replace view public.erp_central_master_tables as
select * from (values
  ('countries', 'countries', 'name_en/name_ur/name_ar/name_fa/name_ps'),
  ('locations', 'countries, states_provinces, districts, cities, areas, postal_codes', 'name_en/name_ur/name_ar/name_fa/name_ps'),
  ('goods', 'goods, goods_variations, products, product_brands, product_categories, product_units', 'name_en/name_ur/name_ar/name_fa/name_ps'),
  ('customers_suppliers', 'customers', 'name_en/name_ur/name_ar/name_fa/name_ps'),
  ('accounts', 'enterprise_accounts', 'name_en/name_ur/name_ar/name_fa/name_ps'),
  ('banks', 'banks', 'name_en/name_ur/name_ar/name_fa/name_ps'),
  ('companies', 'companies', 'name_en/name_ur/name_ar/name_fa/name_ps'),
  ('warehouses', 'warehouses', 'name_en/name_ur/name_ar/name_fa/name_ps'),
  ('branches', 'country_branches, city_branches', 'name_en/name_ur/name_ar/name_fa/name_ps')
) as t(master_key, source_tables, language_contract);

notify pgrst, 'reload schema';
