-- Register truck driver/owner and vessel name fields on the Shipping Customer Order
-- module for the 5-language translation engine — these are proper-noun free text
-- (transliterate mode) confirmed missing by `npm run i18n:scan`.

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('clearing_customer_orders', 'truck_driver_name', 'transliterate'),
  ('clearing_customer_orders', 'truck_owner_name', 'transliterate'),
  ('clearing_customer_order_legs', 'truck_driver_name', 'transliterate'),
  ('clearing_customer_order_legs', 'vessel_name', 'transliterate')
on conflict (table_name, field_name) do nothing;

select public.attach_translation_triggers();
