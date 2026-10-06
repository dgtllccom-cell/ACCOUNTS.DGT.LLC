-- Seed the 'color' category on erp_truck_master_options.
--
-- The original migration (20260805_multilingual_truck_master.sql) documented
-- 'color' as one of the six intended dropdown categories in its own column
-- comment ("'truck_type', 'make', 'color', 'fuel_type', 'document_type',
-- 'contract_type'") but never actually seeded any color rows, and the Truck
-- Registration wizard's Color field was built against a hardcoded static
-- English-only <option> list instead of the master table (Work1/QA G6).
-- This migration completes the intended design; a follow-up code change
-- switches the wizard's Color field to read optionsMap["color"] the same
-- way it already reads optionsMap["fuel_type"].

insert into public.erp_truck_master_options (category, code, name_en, name_ur, name_ar, name_fa, name_ps, sort_order)
values
  ('color', 'white', 'White', 'سفید', 'أبيض', 'سفید', 'سپین', 1),
  ('color', 'black', 'Black', 'کالا', 'أسود', 'مشکی', 'تور', 2),
  ('color', 'blue', 'Blue', 'نیلا', 'أزرق', 'آبی', 'نیلی', 3),
  ('color', 'red', 'Red', 'سرخ', 'أحمر', 'قرمز', 'سور', 4),
  ('color', 'yellow', 'Yellow', 'پیلا', 'أصفر', 'زرد', 'ژیړ', 5),
  ('color', 'silver', 'Silver', 'چاندی', 'فضي', 'نقره‌ای', 'سپینه زرینه', 6),
  ('color', 'grey', 'Grey', 'سرمئی', 'رمادي', 'خاکستری', 'خړ', 7),
  ('color', 'green', 'Green', 'سبز', 'أخضر', 'سبز', 'شین', 8)
on conflict (category, code) do update set
  name_en = excluded.name_en,
  name_ur = excluded.name_ur,
  name_ar = excluded.name_ar,
  name_fa = excluded.name_fa,
  name_ps = excluded.name_ps;

notify pgrst, 'reload schema';
