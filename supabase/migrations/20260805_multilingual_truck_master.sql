-- Multilingual Truck Master Data & 5-Language Options Migration.
-- Adds 5-language support (en, ur, ar, fa, ps) to trucks table and creates options master table.

do $$
begin
  -- Add 5-language fields to trucks table if not exists
  alter table public.trucks add column if not exists fuel_type text;
  alter table public.trucks add column if not exists purchase_date date;
  alter table public.trucks add column if not exists driver_license_no text;
  alter table public.trucks add column if not exists owner_cnic_passport text;
  alter table public.trucks add column if not exists owner_address text;
  alter table public.trucks add column if not exists driver_address text;

  -- 5-Language Name & Text fields
  alter table public.trucks add column if not exists owner_name_en text;
  alter table public.trucks add column if not exists owner_name_ur text;
  alter table public.trucks add column if not exists owner_name_ar text;
  alter table public.trucks add column if not exists owner_name_fa text;
  alter table public.trucks add column if not exists owner_name_ps text;

  alter table public.trucks add column if not exists driver_name_en text;
  alter table public.trucks add column if not exists driver_name_ur text;
  alter table public.trucks add column if not exists driver_name_ar text;
  alter table public.trucks add column if not exists driver_name_fa text;
  alter table public.trucks add column if not exists driver_name_ps text;

  alter table public.trucks add column if not exists transport_company_en text;
  alter table public.trucks add column if not exists transport_company_ur text;
  alter table public.trucks add column if not exists transport_company_ar text;
  alter table public.trucks add column if not exists transport_company_fa text;
  alter table public.trucks add column if not exists transport_company_ps text;

  alter table public.trucks add column if not exists notes_en text;
  alter table public.trucks add column if not exists notes_ur text;
  alter table public.trucks add column if not exists notes_ar text;
  alter table public.trucks add column if not exists notes_fa text;
  alter table public.trucks add column if not exists notes_ps text;
end $$;

-- Central 5-Language Truck Master Dropdown Options Table
create table if not exists public.erp_truck_master_options (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- 'truck_type', 'make', 'color', 'fuel_type', 'document_type', 'contract_type'
  code text not null,
  name_en text not null,
  name_ur text,
  name_ar text,
  name_fa text,
  name_ps text,
  sort_order integer default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  constraint erp_truck_master_options_cat_code_uniq unique (category, code)
);

-- Seed default 5-language master options
insert into public.erp_truck_master_options (category, code, name_en, name_ur, name_ar, name_fa, name_ps, sort_order)
values
  -- Truck Types
  ('truck_type', 'trailer', 'Trailer', U&'\0679\0631\06CC\0644\0631', U&'\0645\0642\0637\0648\0631\0629', U&'\062A\0631\06CC\0644\0631', U&'\0679\0631\06CC\0644\0631', 1),
  ('truck_type', 'flatbed', 'Flatbed Truck', U&'\0641\0644\06CC\0679 \0628\0688\06CC', U&'\0634\0627\062D\0646\0629 \0645\0633\0637\062D\0629', U&'\06A9\0641 \0020\062A\0631\06CC\0644\0631', U&'\0641\0644\06CC\0679 \0679\0631\06A9', 2),
  ('truck_type', 'container_40ft', 'Container (40ft)', U&'\06A9\0646\0679\06CC\0646\0631 (40 \0641\0679)', U&'\062D\0627\0648\064A\0629 (40 \0642\062F\0645)', U&'\06A9\0646\062A\06CC\0646\0631 (40 \0641\0648\062A)', U&'\06A9\0646\0679\06CC\0646\0631 (40 \0641\0679)', 3),
  ('truck_type', 'container_20ft', 'Container (20ft)', U&'\06A9\0646\0679\06CC\0646\0631 (20 \0641\0679)', U&'\062D\0627\0648\064A\0629 (20 \0642\062F\0645)', U&'\06A9\0646\062A\06CC\0646\0631 (20 \0641\0648\062A)', U&'\06A9\0646\0679\06CC\0646\0631 (20 \0641\0679)', 4),
  ('truck_type', 'box_truck', 'Box Truck', U&'\0628\0627\06A9\0633 \0679\0631\06A9', U&'\0634\0627\062D\0646\0629 \0645\063A\0644\0642\0629', U&'\06A9\0627\0645\06CC\0648\0646 \0627\062A\0627\0642\06CC', U&'\0628\0627\06A9\0633 \0679\0631\06A9', 5),
  ('truck_type', 'tanker', 'Tanker', U&'\0679\06CC\0646\06A9\0631', U&'\0635\0647\0631\064A\062C', U&'\062A\0627\0646\06A9\0631', U&'\0679\06CC\0646\06A9\0631', 6),
  ('truck_type', 'lowbed', 'Lowbed Trailer', U&'\0644\0648 \0020\0628\06CC\0688 \0679\0631\06CC\0644\0631', U&'\0645\0642\0637\0648\0631\0629 \0645\0646\062E\0641\0636\0629', U&'\06A9\0641 \0020\06A9\0645 \0020\0627\0631\062A\0641\0627\0639', U&'\0644\0648\0628\06CC\0688 \0679\0631\06CC\0644\0631', 7),
  ('truck_type', 'tipper', 'Dump Truck / Tipper', U&'\0688\0645\067E\0631 \0679\0631\06A9', U&'\0634\0627\062D\0646\0629 \0642\0644\0627\0629', U&'\06A9\0645\067E\0631\0633\0648\0631', U&'\0688\0645\067E\0631 \0679\0631\06A9', 8),

  -- Makes
  ('make', 'volvo', 'Volvo', 'وولوو', 'فولفو', 'ولوو', 'وولوو', 1),
  ('make', 'scania', 'Scania', 'اسکانیا', 'سكانيا', 'اسکانیا', 'اسکانیا', 2),
  ('make', 'mercedes', 'Mercedes-Benz', 'مرسڈیز بینز', 'مرسيدس بنز', 'مرسدس بنز', 'مرسڈیز بینز', 3),
  ('make', 'man', 'MAN', 'مین', 'مان', 'مان', 'مین', 4),
  ('make', 'isuzu', 'ISUZU', 'ائسوزو', 'إيسوزو', 'ایسوزو', 'ائسوزو', 5),
  ('make', 'hino', 'Hino', 'ہینو', 'هينو', 'هینو', 'ہینو', 6),
  ('make', 'shacman', 'Shacman', 'شیک مین', 'شاكمان', 'شاکمان', 'شیک مین', 7),
  ('make', 'faw', 'FAW', 'فاو', 'فاو', 'فاو', 'فاو', 8),

  -- Fuel Types
  ('fuel_type', 'diesel', 'Diesel', 'ڈیزل', 'ديزل', 'دیزل', 'ڈیزل', 1),
  ('fuel_type', 'petrol', 'Petrol', 'پیٹرول', 'بنزين', 'بنزین', 'پیٹرول', 2),
  ('fuel_type', 'cng', 'CNG', 'سی این جی', 'غاز طبيعي', 'سی ان جی', 'سی این جی', 3),
  ('fuel_type', 'electric', 'Electric', 'الیکٹرک', 'كهربائي', 'برقی', 'الیکٹرک', 4),

  -- Document Types
  ('document_type', 'reg_book', 'Registration Book', 'رجسٹریشن بک', 'دفتر التسجيل', 'دفترچه ثبت', 'رجسٹریشن کتاب', 1),
  ('document_type', 'insurance', 'Insurance Policy', 'انشورنس پالیسی', 'بوليصة التأمين', 'بیمه نامه', 'انشورنس پالیسی', 2),
  ('document_type', 'fitness', 'Fitness Certificate', 'فٹنس سرٹیفکیٹ', 'شهادة اللياقة', 'گواهی سلامت', 'فټنس سند', 3),
  ('document_type', 'route_permit', 'Route Permit', 'روٹ پرمٹ', 'تصريح المسار', 'مجوز مسیر', 'روټ پرمټ', 4),
  ('document_type', 'driver_license', 'Driver License', 'ڈرائیونگ لائسنس', 'رخصة القيادة', 'گواهینامه رانندگی', 'ډرایور لایسنس', 5),
  ('document_type', 'owner_cnic', 'Owner CNIC / Passport', 'مالک قومی شناختی کارڈ / پاسپورٹ', 'هوية المالك / الجواز', 'شناسنامه مالک / پاسپورت', 'د مالک پیژندپاڼه', 6),

  -- Contract Types
  ('contract_type', 'long_term', 'Long-Term Transport Contract', 'طویل المدتی ٹرانسپورٹ معاہدہ', 'عقد نقل طويل الأجل', 'قرارداد حمل و نقل بلند مدت', 'اوږد مهاله ټرانسپورټ تړون', 1),
  ('contract_type', 'spot', 'Spot Transport Agreement', 'اسپاٹ ٹرانسپورٹ معاہدہ', 'اتفاقية نقل فوري', 'قرارداد حمل و نقل موردی', 'سمدستي ټرانسپورټ تړون', 2),
  ('contract_type', 'border_crossing', 'Border Crossing Transit Permit', 'بارڈر کراسنگ ٹرانزٹ پرمٹ', 'تصريح عبور الحدود', 'مجوز عبور از مرز', 'د سرحد کراسنګ پرمټ', 3),
  ('contract_type', 'lease', 'Fleet Lease Agreement', 'لیز معاہدہ', 'عقد إيجار أسطول', 'قرارداد اجاره ناوگان', 'د لیز تړون', 4)

on conflict (category, code) do update set
  name_en = excluded.name_en,
  name_ur = excluded.name_ur,
  name_ar = excluded.name_ar,
  name_fa = excluded.name_fa,
  name_ps = excluded.name_ps;

notify pgrst, 'reload schema';
