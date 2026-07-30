-- =====================================================================
--  DIGITAL DOCK ERP — LOCATION MANAGEMENT SEED
--  File 2 of 3   (run AFTER File 1 cleanup)
-- ---------------------------------------------------------------------
--  Populates the Location hierarchy:  Country -> State/Province -> City
--  Tables (verified): countries, states_provinces, cities
--  Multilingual contract (migration 0078): name_en/name_ur/name_ar/name_fa/name_ps
--    -> erp_resolve_language_text() falls back to name_en when a language
--       column is empty, so partially-filled rows are NEVER broken.
--  Idempotent: ON CONFLICT DO NOTHING/UPDATE on the existing unique indexes.
--
--  SCOPE OF THIS FILE:
--    * 5 countries — full 5-language names + ISO codes + currency.
--    * ALL states/provinces for all 5 countries — name_en + ISO/official
--      code + primary native-script name (others fall back to English).
--    * One principal city per state (capital) so the 3-level hierarchy is
--      complete and linked end-to-end.
--  File 2b (next) extends CITIES with additional major cities per state.
--
--  DISPLAY NOTE: "State Name (Code)" e.g. "Punjab (PB)" is a UI format.
--    Data is stored normalized: name="Punjab", code="PB". Render the
--    bracketed form in the UI as  name || ' (' || code || ')'.
-- =====================================================================

-- Currency NAME has no column in `countries` (only currency_code). Add it
-- (non-destructive) so we can store both Currency Name and Currency Code:
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS currency_name text;

BEGIN;

-- ---------------------------------------------------------------------
-- 1) COUNTRIES  (5-language + codes + currency)
-- ---------------------------------------------------------------------
INSERT INTO public.countries
  (name, iso2, iso3, currency_code, currency_name, is_active,
   name_en, name_ur, name_ar, name_fa, name_ps)
VALUES
  ('United Arab Emirates','AE','ARE','AED','UAE Dirham',      true,
   'United Arab Emirates','متحدہ عرب امارات','الإمارات العربية المتحدة','امارات متحده عربی','متحده عربي امارات'),
  ('Pakistan','PK','PAK','PKR','Pakistani Rupee',             true,
   'Pakistan','پاکستان','باكستان','پاکستان','پاکستان'),
  ('Afghanistan','AF','AFG','AFN','Afghan Afghani',           true,
   'Afghanistan','افغانستان','أفغانستان','افغانستان','افغانستان'),
  ('India','IN','IND','INR','Indian Rupee',                   true,
   'India','بھارت','الهند','هند','هند'),
  ('Iran','IR','IRN','IRR','Iranian Rial',                    true,
   'Iran','ایران','إيران','ایران','ایران')
ON CONFLICT (name) WHERE deleted_at IS NULL
DO UPDATE SET iso2=EXCLUDED.iso2, iso3=EXCLUDED.iso3,
              currency_code=EXCLUDED.currency_code, currency_name=EXCLUDED.currency_name,
              name_en=EXCLUDED.name_en, name_ur=EXCLUDED.name_ur, name_ar=EXCLUDED.name_ar,
              name_fa=EXCLUDED.name_fa, name_ps=EXCLUDED.name_ps, is_active=true, updated_at=now();

-- Helper: insert states for a country identified by iso2 --------------
-- (pattern repeated per country; columns: name, code, name_en, native)

-- ---------------------------------------------------------------------
-- 2) UNITED ARAB EMIRATES — 7 emirates (native = Arabic)
-- ---------------------------------------------------------------------
INSERT INTO public.states_provinces (country_id, name, code, is_active, name_en, name_ar)
SELECT c.id, v.name, v.code, true, v.name, v.ar
FROM (VALUES
  ('Abu Dhabi','AZ','أبوظبي'),
  ('Dubai','DU','دبي'),
  ('Sharjah','SH','الشارقة'),
  ('Ajman','AJ','عجمان'),
  ('Umm Al Quwain','UQ','أم القيوين'),
  ('Ras Al Khaimah','RK','رأس الخيمة'),
  ('Fujairah','FU','الفجيرة')
) AS v(name,code,ar)
CROSS JOIN LATERAL (SELECT id FROM public.countries WHERE iso2='AE' AND deleted_at IS NULL LIMIT 1) c
ON CONFLICT (country_id, lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- ---------------------------------------------------------------------
-- 3) PAKISTAN — 4 provinces + 3 territories (native = Urdu)
-- ---------------------------------------------------------------------
INSERT INTO public.states_provinces (country_id, name, code, is_active, name_en, name_ur)
SELECT c.id, v.name, v.code, true, v.name, v.ur
FROM (VALUES
  ('Punjab','PB','پنجاب'),
  ('Sindh','SD','سندھ'),
  ('Khyber Pakhtunkhwa','KP','خیبر پختونخوا'),
  ('Balochistan','BA','بلوچستان'),
  ('Gilgit-Baltistan','GB','گلگت بلتستان'),
  ('Azad Jammu and Kashmir','JK','آزاد جموں و کشمیر'),
  ('Islamabad Capital Territory','IS','اسلام آباد دارالحکومت')
) AS v(name,code,ur)
CROSS JOIN LATERAL (SELECT id FROM public.countries WHERE iso2='PK' AND deleted_at IS NULL LIMIT 1) c
ON CONFLICT (country_id, lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- ---------------------------------------------------------------------
-- 4) AFGHANISTAN — 34 provinces (native = Pashto/Dari)
-- ---------------------------------------------------------------------
INSERT INTO public.states_provinces (country_id, name, code, is_active, name_en, name_ps, name_fa)
SELECT c.id, v.name, v.code, true, v.name, v.ps, v.fa
FROM (VALUES
  ('Kabul','KAB','کابل','کابل'),
  ('Kandahar','KAN','کندهار','قندهار'),
  ('Herat','HER','هرات','هرات'),
  ('Balkh','BAL','بلخ','بلخ'),
  ('Nangarhar','NAN','ننګرهار','ننگرهار'),
  ('Kunduz','KDZ','کندز','کندوز'),
  ('Helmand','HEL','هلمند','هلمند'),
  ('Badakhshan','BDS','بدخشان','بدخشان'),
  ('Baghlan','BGL','بغلان','بغلان'),
  ('Bamyan','BAM','بامیان','بامیان'),
  ('Badghis','BDG','بادغیس','بادغیس'),
  ('Daykundi','DAY','دایکندی','دایکندی'),
  ('Farah','FRA','فراه','فراه'),
  ('Faryab','FYB','فاریاب','فاریاب'),
  ('Ghazni','GHA','غزني','غزنی'),
  ('Ghor','GHO','غور','غور'),
  ('Jowzjan','JOW','جوزجان','جوزجان'),
  ('Kapisa','KAP','کاپیسا','کاپیسا'),
  ('Khost','KHO','خوست','خوست'),
  ('Kunar','KNR','کنړ','کنر'),
  ('Laghman','LAG','لغمان','لغمان'),
  ('Logar','LOG','لوګر','لوگر'),
  ('Nimroz','NIM','نیمروز','نیمروز'),
  ('Nuristan','NUR','نورستان','نورستان'),
  ('Paktia','PIA','پکتیا','پکتیا'),
  ('Paktika','PKA','پکتیکا','پکتیکا'),
  ('Panjshir','PAN','پنجشیر','پنجشیر'),
  ('Parwan','PAR','پروان','پروان'),
  ('Samangan','SAM','سمنګان','سمنگان'),
  ('Sar-e Pol','SAR','سرپل','سرپل'),
  ('Takhar','TAK','تخار','تخار'),
  ('Uruzgan','URU','ارزګان','ارزگان'),
  ('Maidan Wardak','WAR','میدان وردګ','میدان وردک'),
  ('Zabul','ZAB','زابل','زابل')
) AS v(name,code,ps,fa)
CROSS JOIN LATERAL (SELECT id FROM public.countries WHERE iso2='AF' AND deleted_at IS NULL LIMIT 1) c
ON CONFLICT (country_id, lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- ---------------------------------------------------------------------
-- 5) INDIA — 28 states + 8 union territories (native = Urdu shown; others fall back)
-- ---------------------------------------------------------------------
INSERT INTO public.states_provinces (country_id, name, code, is_active, name_en, name_ur)
SELECT c.id, v.name, v.code, true, v.name, v.ur
FROM (VALUES
  ('Andhra Pradesh','AP','آندھرا پردیش'),
  ('Arunachal Pradesh','AR','اروناچل پردیش'),
  ('Assam','AS','آسام'),
  ('Bihar','BR','بہار'),
  ('Chhattisgarh','CG','چھتیس گڑھ'),
  ('Goa','GA','گوا'),
  ('Gujarat','GJ','گجرات'),
  ('Haryana','HR','ہریانہ'),
  ('Himachal Pradesh','HP','ہماچل پردیش'),
  ('Jharkhand','JH','جھارکھنڈ'),
  ('Karnataka','KA','کرناٹک'),
  ('Kerala','KL','کیرالہ'),
  ('Madhya Pradesh','MP','مدھیہ پردیش'),
  ('Maharashtra','MH','مہاراشٹر'),
  ('Manipur','MN','منی پور'),
  ('Meghalaya','ML','میگھالیہ'),
  ('Mizoram','MZ','میزورم'),
  ('Nagaland','NL','ناگالینڈ'),
  ('Odisha','OD','اوڈیشہ'),
  ('Punjab','PB','پنجاب'),
  ('Rajasthan','RJ','راجستھان'),
  ('Sikkim','SK','سکم'),
  ('Tamil Nadu','TN','تمل ناڈو'),
  ('Telangana','TG','تلنگانہ'),
  ('Tripura','TR','تری پورہ'),
  ('Uttar Pradesh','UP','اتر پردیش'),
  ('Uttarakhand','UK','اتراکھنڈ'),
  ('West Bengal','WB','مغربی بنگال'),
  ('Andaman and Nicobar Islands','AN','انڈمان و نکوبار جزائر'),
  ('Chandigarh','CH','چندی گڑھ'),
  ('Dadra and Nagar Haveli and Daman and Diu','DH','دادرا و نگر حویلی و دمن و دیو'),
  ('Delhi','DL','دہلی'),
  ('Jammu and Kashmir','JK','جموں و کشمیر'),
  ('Ladakh','LA','لداخ'),
  ('Lakshadweep','LD','لکشدیپ'),
  ('Puducherry','PY','پڈوچیری')
) AS v(name,code,ur)
CROSS JOIN LATERAL (SELECT id FROM public.countries WHERE iso2='IN' AND deleted_at IS NULL LIMIT 1) c
ON CONFLICT (country_id, lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- ---------------------------------------------------------------------
-- 6) IRAN — 31 provinces (native = Farsi)
-- ---------------------------------------------------------------------
INSERT INTO public.states_provinces (country_id, name, code, is_active, name_en, name_fa)
SELECT c.id, v.name, v.code, true, v.name, v.fa
FROM (VALUES
  ('Tehran','THR','تهران'),
  ('Alborz','ABZ','البرز'),
  ('Qom','QOM','قم'),
  ('Markazi','MKZ','مرکزی'),
  ('Qazvin','QZV','قزوین'),
  ('Gilan','GIL','گیلان'),
  ('Mazandaran','MAZ','مازندران'),
  ('Golestan','GLS','گلستان'),
  ('Ardabil','ADL','اردبیل'),
  ('Zanjan','ZAN','زنجان'),
  ('East Azerbaijan','EAZ','آذربایجان شرقی'),
  ('West Azerbaijan','WAZ','آذربایجان غربی'),
  ('Kurdistan','KRD','کردستان'),
  ('Hamadan','HDN','همدان'),
  ('Kermanshah','KRH','کرمانشاه'),
  ('Ilam','ILM','ایلام'),
  ('Lorestan','LRS','لرستان'),
  ('Khuzestan','KHZ','خوزستان'),
  ('Chaharmahal and Bakhtiari','CHB','چهارمحال و بختیاری'),
  ('Kohgiluyeh and Boyer-Ahmad','KBD','کهگیلویه و بویراحمد'),
  ('Bushehr','BHR','بوشهر'),
  ('Fars','FRS','فارس'),
  ('Hormozgan','HRZ','هرمزگان'),
  ('Isfahan','ESF','اصفهان'),
  ('Yazd','YZD','یزد'),
  ('Kerman','KER','کرمان'),
  ('Sistan and Baluchestan','SBN','سیستان و بلوچستان'),
  ('South Khorasan','SKH','خراسان جنوبی'),
  ('Razavi Khorasan','RKH','خراسان رضوی'),
  ('North Khorasan','NKH','خراسان شمالی'),
  ('Semnan','SMN','سمنان')
) AS v(name,code,fa)
CROSS JOIN LATERAL (SELECT id FROM public.countries WHERE iso2='IR' AND deleted_at IS NULL LIMIT 1) c
ON CONFLICT (country_id, lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- ---------------------------------------------------------------------
-- 7) PRINCIPAL CITY per state  (completes Country -> State -> City)
--    City code = state code + '-01'; name defaults; native falls back to en.
--    Extend with more major cities in File 2b.
-- ---------------------------------------------------------------------
-- 7a) UAE — capital city of each emirate
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_ar)
SELECT sp.country_id, sp.id, v.city, v.code, true, v.city, v.ar
FROM (VALUES
  ('Abu Dhabi','Abu Dhabi','AZ-01','أبوظبي'),
  ('Dubai','Dubai','DU-01','دبي'),
  ('Sharjah','Sharjah','SH-01','الشارقة'),
  ('Ajman','Ajman','AJ-01','عجمان'),
  ('Umm Al Quwain','Umm Al Quwain','UQ-01','أم القيوين'),
  ('Ras Al Khaimah','Ras Al Khaimah','RK-01','رأس الخيمة'),
  ('Fujairah','Fujairah','FU-01','الفجيرة')
) AS v(state,city,code,ar)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='AE'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 7b) PAKISTAN — provincial capitals
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_ur)
SELECT sp.country_id, sp.id, v.city, v.code, true, v.city, v.ur
FROM (VALUES
  ('Punjab','Lahore','PB-01','لاہور'),
  ('Sindh','Karachi','SD-01','کراچی'),
  ('Khyber Pakhtunkhwa','Peshawar','KP-01','پشاور'),
  ('Balochistan','Quetta','BA-01','کوئٹہ'),
  ('Gilgit-Baltistan','Gilgit','GB-01','گلگت'),
  ('Azad Jammu and Kashmir','Muzaffarabad','JK-01','مظفرآباد'),
  ('Islamabad Capital Territory','Islamabad','IS-01','اسلام آباد')
) AS v(state,city,code,ur)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='PK'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 7c) AFGHANISTAN — provincial capitals (same name as province for most)
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_ps)
SELECT sp.country_id, sp.id, v.city, sp.code || '-01', true, v.city, v.ps
FROM (VALUES
  ('Kabul','Kabul','کابل'),('Kandahar','Kandahar','کندهار'),('Herat','Herat','هرات'),
  ('Balkh','Mazar-i-Sharif','مزارشریف'),('Nangarhar','Jalalabad','جلال آباد'),
  ('Kunduz','Kunduz','کندز'),('Helmand','Lashkargah','لښکرګاه'),('Badakhshan','Fayzabad','فیض آباد'),
  ('Baghlan','Puli Khumri','پلخمری'),('Bamyan','Bamyan','بامیان'),('Badghis','Qala e Naw','قلعه نو'),
  ('Daykundi','Nili','نیلی'),('Farah','Farah','فراه'),('Faryab','Maymana','میمنه'),
  ('Ghazni','Ghazni','غزني'),('Ghor','Chaghcharan','چغچران'),('Jowzjan','Sheberghan','شبرغان'),
  ('Kapisa','Mahmud-i-Raqi','محمودراقی'),('Khost','Khost','خوست'),('Kunar','Asadabad','اسدآباد'),
  ('Laghman','Mihtarlam','مهترلام'),('Logar','Puli Alam','پل علم'),('Nimroz','Zaranj','زرنج'),
  ('Nuristan','Parun','پارون'),('Paktia','Gardez','ګردیز'),('Paktika','Sharana','شرنه'),
  ('Panjshir','Bazarak','بازارک'),('Parwan','Charikar','چاریکار'),('Samangan','Aybak','ایبک'),
  ('Sar-e Pol','Sar-e Pol','سرپل'),('Takhar','Taloqan','تالقان'),('Uruzgan','Tarinkot','ترینکوټ'),
  ('Maidan Wardak','Maidan Shar','میدان شار'),('Zabul','Qalat','قلات')
) AS v(state,city,ps)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='AF'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 7d) INDIA — state capitals
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_ur)
SELECT sp.country_id, sp.id, v.city, sp.code || '-01', true, v.city, v.ur
FROM (VALUES
  ('Andhra Pradesh','Amaravati','امراوتی'),('Arunachal Pradesh','Itanagar','ایٹا نگر'),
  ('Assam','Dispur','دسپور'),('Bihar','Patna','پٹنہ'),('Chhattisgarh','Raipur','رائے پور'),
  ('Goa','Panaji','پنجی'),('Gujarat','Gandhinagar','گاندھی نگر'),('Haryana','Chandigarh','چندی گڑھ'),
  ('Himachal Pradesh','Shimla','شملہ'),('Jharkhand','Ranchi','رانچی'),('Karnataka','Bengaluru','بنگلورو'),
  ('Kerala','Thiruvananthapuram','تروواننتاپورم'),('Madhya Pradesh','Bhopal','بھوپال'),
  ('Maharashtra','Mumbai','ممبئی'),('Manipur','Imphal','امپھال'),('Meghalaya','Shillong','شیلانگ'),
  ('Mizoram','Aizawl','آئزول'),('Nagaland','Kohima','کوہیما'),('Odisha','Bhubaneswar','بھونیشور'),
  ('Punjab','Chandigarh','چندی گڑھ'),('Rajasthan','Jaipur','جے پور'),('Sikkim','Gangtok','گنگٹوک'),
  ('Tamil Nadu','Chennai','چنئی'),('Telangana','Hyderabad','حیدرآباد'),('Tripura','Agartala','اگرتلہ'),
  ('Uttar Pradesh','Lucknow','لکھنؤ'),('Uttarakhand','Dehradun','دہرہ دون'),('West Bengal','Kolkata','کولکاتا'),
  ('Andaman and Nicobar Islands','Port Blair','پورٹ بلیئر'),('Chandigarh','Chandigarh','چندی گڑھ'),
  ('Dadra and Nagar Haveli and Daman and Diu','Daman','دمن'),('Delhi','New Delhi','نئی دہلی'),
  ('Jammu and Kashmir','Srinagar','سری نگر'),('Ladakh','Leh','لیہہ'),('Lakshadweep','Kavaratti','کاوارتی'),
  ('Puducherry','Puducherry','پڈوچیری')
) AS v(state,city,ur)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='IN'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- 7e) IRAN — provincial capitals
INSERT INTO public.cities (country_id, state_province_id, name, code, is_active, name_en, name_fa)
SELECT sp.country_id, sp.id, v.city, sp.code || '-01', true, v.city, v.fa
FROM (VALUES
  ('Tehran','Tehran','تهران'),('Alborz','Karaj','کرج'),('Qom','Qom','قم'),('Markazi','Arak','اراک'),
  ('Qazvin','Qazvin','قزوین'),('Gilan','Rasht','رشت'),('Mazandaran','Sari','ساری'),('Golestan','Gorgan','گرگان'),
  ('Ardabil','Ardabil','اردبیل'),('Zanjan','Zanjan','زنجان'),('East Azerbaijan','Tabriz','تبریز'),
  ('West Azerbaijan','Urmia','ارومیه'),('Kurdistan','Sanandaj','سنندج'),('Hamadan','Hamadan','همدان'),
  ('Kermanshah','Kermanshah','کرمانشاه'),('Ilam','Ilam','ایلام'),('Lorestan','Khorramabad','خرم آباد'),
  ('Khuzestan','Ahvaz','اهواز'),('Chaharmahal and Bakhtiari','Shahrekord','شهرکرد'),
  ('Kohgiluyeh and Boyer-Ahmad','Yasuj','یاسوج'),('Bushehr','Bushehr','بوشهر'),('Fars','Shiraz','شیراز'),
  ('Hormozgan','Bandar Abbas','بندرعباس'),('Isfahan','Isfahan','اصفهان'),('Yazd','Yazd','یزد'),
  ('Kerman','Kerman','کرمان'),('Sistan and Baluchestan','Zahedan','زاهدان'),('South Khorasan','Birjand','بیرجند'),
  ('Razavi Khorasan','Mashhad','مشهد'),('North Khorasan','Bojnurd','بجنورد'),('Semnan','Semnan','سمنان')
) AS v(state,city,fa)
JOIN public.states_provinces sp ON lower(sp.name)=lower(v.state) AND sp.deleted_at IS NULL
JOIN public.countries c ON c.id=sp.country_id AND c.iso2='IR'
ON CONFLICT (country_id, coalesce(state_province_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name)) WHERE deleted_at IS NULL DO NOTHING;

-- COMMIT;  -- after reviewing counts below
ROLLBACK;  -- <-- change to COMMIT when satisfied


-- =====================================================================
-- VERIFICATION (run after COMMIT)
-- =====================================================================
SELECT c.name country, c.iso2, c.currency_code, c.currency_name,
       count(DISTINCT sp.id) states, count(DISTINCT ci.id) cities
FROM public.countries c
LEFT JOIN public.states_provinces sp ON sp.country_id=c.id AND sp.deleted_at IS NULL
LEFT JOIN public.cities ci ON ci.country_id=c.id AND ci.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.name,c.iso2,c.currency_code,c.currency_name ORDER BY c.name;
-- Expect: AE 7 states, PK 7, AF 34, IN 36, IR 31 — each with 1 city per state.

-- Orphan check (no city without a valid state):
SELECT count(*) AS orphan_cities
FROM public.cities ci
LEFT JOIN public.states_provinces sp ON sp.id=ci.state_province_id AND sp.deleted_at IS NULL
WHERE ci.deleted_at IS NULL AND ci.state_province_id IS NOT NULL AND sp.id IS NULL;  -- expect 0
