-- Transit Loading destination via the central Location Master. Additive + idempotent.
alter table transit_truck_loadings add column if not exists dest_country_id uuid references countries(id);
alter table transit_truck_loadings add column if not exists dest_state_province_id uuid references states_provinces(id);
alter table transit_truck_loadings add column if not exists dest_district_id uuid references districts(id);
alter table transit_truck_loadings add column if not exists dest_city_id uuid references cities(id);
notify pgrst, 'reload schema';
