-- =====================================================================
--  DIGITAL DOCK ERP — LOCATION SEED (2b): MAJOR / TRADE CITIES
--  Run AFTER 02_location_seed.sql (needs the states already inserted).
-- ---------------------------------------------------------------------
--  Adds the principal commercial / trade / port cities per state so the
--  Country -> State -> City hierarchy is production-usable. Idempotent
--  (ON CONFLICT DO NOTHING). City code = <state_code>-NN.
--  Native name in the country's primary script; others fall back to EN.
--  This is a curated MAJOR-city set (not every town — that requires a
--  GeoNames import, noted in 02). Extend freely with the same pattern.
-- =====================================================================
BEGIN;

-- Reusable insert pattern per country --------------------------------
-- 1) UAE (Arabic)
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_ar)
SELECT sp.country_id, sp.id, v.city, sp.code||'-'||v.n, true, v.city, v.ar
FROM (VALUES
  ('Abu Dhabi','Al Ain','02','العين'),
  ('Abu Dhabi','Madinat Zayed','03','مدينة زايد'),
  ('Dubai','Jebel Ali','02','جبل علي'),
  ('Dubai','Hatta','03','حتا'),
  ('Sharjah','Khor Fakkan','02','خورفكان'),
  ('Sharjah','Kalba','03','كلباء'),
  ('Ras Al Khaimah','Al Jazirah Al Hamra','02','الجزيرة الحمراء'),
  ('Fujairah','Dibba Al-Fujairah','02','دبا الفجيرة')
) AS v(state,city,n,ar)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='AE'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 2) PAKISTAN (Urdu)
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_ur)
SELECT sp.country_id, sp.id, v.city, sp.code||'-'||v.n, true, v.city, v.ur
FROM (VALUES
  ('Punjab','Faisalabad','02','فیصل آباد'),('Punjab','Rawalpindi','03','راولپنڈی'),
  ('Punjab','Multan','04','ملتان'),('Punjab','Gujranwala','05','گوجرانوالہ'),
  ('Punjab','Sialkot','06','سیالکوٹ'),('Punjab','Bahawalpur','07','بہاولپور'),
  ('Punjab','Sargodha','08','سرگودھا'),('Punjab','Sahiwal','09','ساہیوال'),
  ('Sindh','Hyderabad','02','حیدرآباد'),('Sindh','Sukkur','03','سکھر'),
  ('Sindh','Larkana','04','لاڑکانہ'),('Sindh','Nawabshah','05','نواب شاہ'),
  ('Sindh','Mirpur Khas','06','میرپور خاص'),('Sindh','Port Qasim','07','پورٹ قاسم'),
  ('Khyber Pakhtunkhwa','Mardan','02','مردان'),('Khyber Pakhtunkhwa','Abbottabad','03','ایبٹ آباد'),
  ('Khyber Pakhtunkhwa','Mingora','04','مینگورہ'),('Khyber Pakhtunkhwa','Kohat','05','کوہاٹ'),
  ('Khyber Pakhtunkhwa','Bannu','06','بنوں'),('Khyber Pakhtunkhwa','Dera Ismail Khan','07','ڈیرہ اسماعیل خان'),
  ('Khyber Pakhtunkhwa','Torkham','08','طورخم'),
  ('Balochistan','Gwadar','02','گوادر'),('Balochistan','Turbat','03','تربت'),
  ('Balochistan','Khuzdar','04','خضدار'),('Balochistan','Chaman','05','چمن'),
  ('Balochistan','Sibi','06','سبی'),('Balochistan','Hub','07','حب'),
  ('Gilgit-Baltistan','Skardu','02','سکردو'),
  ('Azad Jammu and Kashmir','Mirpur','02','میرپور')
) AS v(state,city,n,ur)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='PK'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 3) AFGHANISTAN (Pashto) — additional trade/border cities
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_ps)
SELECT sp.country_id, sp.id, v.city, sp.code||'-'||v.n, true, v.city, v.ps
FROM (VALUES
  ('Kandahar','Spin Boldak','02','سپین بولدک'),
  ('Nangarhar','Torkham','02','تورخم'),
  ('Herat','Islam Qala','02','اسلام قلعه'),
  ('Herat','Torghundi','03','تورغوندی'),
  ('Balkh','Hairatan','02','حیرتان'),
  ('Nimroz','Zaranj','02','زرنج'),
  ('Kabul','Paghman','02','پغمان'),
  ('Kunduz','Sher Khan Bandar','02','شیرخان بندر')
) AS v(state,city,n,ps)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='AF'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 4) INDIA (Urdu) — metros + major commercial cities
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_ur)
SELECT sp.country_id, sp.id, v.city, sp.code||'-'||v.n, true, v.city, v.ur
FROM (VALUES
  ('Maharashtra','Pune','02','پونے'),('Maharashtra','Nagpur','03','ناگپور'),
  ('Maharashtra','Nashik','04','ناسک'),('Maharashtra','Jawaharlal Nehru Port','05','جواہر لعل نہرو پورٹ'),
  ('Gujarat','Ahmedabad','02','احمد آباد'),('Gujarat','Surat','03','سورت'),
  ('Gujarat','Vadodara','04','وڈودرا'),('Gujarat','Rajkot','05','راجکوٹ'),
  ('Gujarat','Mundra','06','مندرا'),('Gujarat','Kandla','07','کانڈلا'),
  ('Tamil Nadu','Coimbatore','02','کوئمبٹور'),('Tamil Nadu','Madurai','03','مدورائی'),
  ('Tamil Nadu','Tiruppur','04','تروپور'),('Tamil Nadu','Ennore','05','اینور'),
  ('Karnataka','Mysuru','02','میسورو'),('Karnataka','Mangaluru','03','منگلورو'),
  ('Karnataka','Hubballi','04','ہبلی'),
  ('Uttar Pradesh','Kanpur','02','کانپور'),('Uttar Pradesh','Agra','03','آگرہ'),
  ('Uttar Pradesh','Varanasi','04','وارانسی'),('Uttar Pradesh','Noida','05','نوئیڈا'),
  ('West Bengal','Howrah','02','ہاوڑہ'),('West Bengal','Haldia','03','ہلدیا'),
  ('West Bengal','Siliguri','04','سلی گوڑی'),
  ('Delhi','Delhi','02','دہلی'),
  ('Telangana','Warangal','02','ورنگل'),
  ('Rajasthan','Jodhpur','02','جودھ پور'),('Rajasthan','Udaipur','03','ادے پور'),
  ('Kerala','Kochi','02','کوچی'),('Kerala','Kozhikode','03','کالی کٹ'),
  ('Punjab','Ludhiana','02','لدھیانہ'),('Punjab','Amritsar','03','امرتسر'),
  ('Andhra Pradesh','Visakhapatnam','02','وشاکھاپٹنم'),('Andhra Pradesh','Vijayawada','03','وجے واڑہ'),
  ('Madhya Pradesh','Indore','02','اندور'),('Bihar','Gaya','02','گیا'),
  ('Haryana','Gurugram','02','گروگرام'),('Haryana','Faridabad','03','فرید آباد')
) AS v(state,city,n,ur)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='IN'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 5) IRAN (Farsi) — major commercial / port cities
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_fa)
SELECT sp.country_id, sp.id, v.city, sp.code||'-'||v.n, true, v.city, v.fa
FROM (VALUES
  ('Tehran','Rey','02','ری'),('Tehran','Islamshahr','03','اسلامشهر'),
  ('Isfahan','Kashan','02','کاشان'),('Isfahan','Najafabad','03','نجف آباد'),
  ('Fars','Marvdasht','02','مرودشت'),('Fars','Jahrom','03','جهرم'),
  ('Khuzestan','Abadan','02','آبادان'),('Khuzestan','Khorramshahr','03','خرمشهر'),
  ('Khuzestan','Bandar Imam Khomeini','04','بندر امام خمینی'),('Khuzestan','Mahshahr','05','ماهشهر'),
  ('Hormozgan','Bandar Lengeh','02','بندر لنگه'),('Hormozgan','Qeshm','03','قشم'),
  ('Hormozgan','Kish','04','کیش'),
  ('Razavi Khorasan','Neyshabur','02','نیشابور'),('Razavi Khorasan','Sabzevar','03','سبزوار'),
  ('East Azerbaijan','Maragheh','02','مراغه'),('East Azerbaijan','Marand','03','مرند'),
  ('Bushehr','Asaluyeh','02','عسلویه'),('Bushehr','Bandar Genaveh','03','بندر گناوه'),
  ('Gilan','Bandar Anzali','02','بندر انزلی'),
  ('Mazandaran','Babol','02','بابل'),('Mazandaran','Amol','03','آمل'),
  ('Sistan and Baluchestan','Chabahar','02','چابهار'),('Sistan and Baluchestan','Zabol','03','زابل'),
  ('Kerman','Rafsanjan','02','رفسنجان'),('Kerman','Sirjan','03','سیرجان')
) AS v(state,city,n,fa)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='IR'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- COMMIT;  -- after reviewing counts
ROLLBACK;  -- <-- change to COMMIT

-- VERIFY total city counts per country:
SELECT c.name, count(ci.*) AS cities
FROM public.countries c
LEFT JOIN public.cities ci ON ci.country_id=c.id AND ci.deleted_at IS NULL
WHERE c.deleted_at IS NULL GROUP BY c.name ORDER BY c.name;
