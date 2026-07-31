-- Truck base location using the central Location Master (state/district/city).
-- registration_country_id already exists on trucks. Additive + idempotent.
alter table trucks add column if not exists base_state_province_id uuid references states_provinces(id);
alter table trucks add column if not exists base_district_id uuid references districts(id);
alter table trucks add column if not exists base_city_id uuid references cities(id);
notify pgrst, 'reload schema';
