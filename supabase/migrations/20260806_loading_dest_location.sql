-- Destination location (central Location Master) for Truck & Import loading forms.
-- Additive + idempotent.
do $$
declare tbl text;
begin
  foreach tbl in array array['truck_loadings','import_truck_loadings'] loop
    if to_regclass('public.'||tbl) is not null then
      execute format('alter table public.%I add column if not exists dest_country_id uuid references countries(id)', tbl);
      execute format('alter table public.%I add column if not exists dest_state_province_id uuid references states_provinces(id)', tbl);
      execute format('alter table public.%I add column if not exists dest_district_id uuid references districts(id)', tbl);
      execute format('alter table public.%I add column if not exists dest_city_id uuid references cities(id)', tbl);
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
