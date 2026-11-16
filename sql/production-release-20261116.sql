-- ============================================================================
-- PRODUCTION RUNBOOK: release 2026-11-16 (account categories + FX carry-forward)
-- Supersedes sql/production-categories-release.sql (that file had no S rename,
-- no RLS change, no translations and no carried_forward_from column).
--
-- DO NOT RUN until ALL of these hold:
--   1. A verified backup exists: /root/backups/prod-manual-before-release-20261116-080123.dump
--      (sha256 e5d9c40ae3b7bd88bbd8b7254652442159bc14d72a41139b63a0e8e9b2b9fd14).
--   2. The owner gave the final approval for THIS SQL, S keeps its current name (the owner corrects it in Settings).
--   3. Deploy order: this SQL first (it adds carried_forward_from, which the new
--      FX route writes), then scripts/production/deploy-via-gate.sh <sha>.
--
-- Run as ONE transaction, stopping on the first error:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f production-release-20261116.sql
-- Any failed check raises an exception and rolls back everything.
--
-- State checked read-only on production on 2026-11-16 (before this runs):
--   - 25 live active business rows. The 15 extras below are among them.
--   - 10 of the 13 approved codes already exist (S, P/S, B/C, B/P, EX, OFFICE_EXP,
--     TRAVEL_EXP, UTILITY_EXP, INTER_TRADE, INTER_TRANSFER). P, B and C do not exist.
--   - S is currently "Staff & Payroll Expenses". 2 enterprise_accounts use category S.
--     S is not renamed by this script; its stored code stays S.
--   - daily_usd_rates.carried_forward_from does not exist yet.
--   - account_categories has 2 policies: account_categories_all_policy and
--     account_categories_read_policy (both replaced here).
--   - No live row is named Purchases, Bank, Cash or Sales (no unique-name conflict).
--   - 36 record_translations rows with record_table = 'account_categories'.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Preconditions. Abort (and roll back) if production is not in the state above.
-- ----------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.account_categories
   WHERE deleted_at IS NULL AND operational_domain = 'business' AND is_active;
  IF n <> 25 THEN
    RAISE EXCEPTION 'precondition failed: expected 25 active business rows, found %', n;
  END IF;

  SELECT count(*) INTO n FROM public.account_categories
   WHERE deleted_at IS NULL AND operational_domain = 'business'
     AND (code IN ('P','B','C') OR lower(trim(name)) IN ('purchases','bank','cash','sales'));
  IF n <> 0 THEN
    RAISE EXCEPTION 'precondition failed: P/B/C or a Purchases/Bank/Cash/Sales name already exists (%)', n;
  END IF;

  SELECT count(*) INTO n FROM public.account_categories
   WHERE deleted_at IS NULL AND operational_domain = 'business' AND code = 'S';
  IF n <> 1 THEN
    RAISE EXCEPTION 'precondition failed: expected exactly one S row, found %', n;
  END IF;

  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'is_super_admin';
  IF n < 1 THEN
    RAISE EXCEPTION 'precondition failed: public.is_super_admin() is missing (policies depend on it)';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Snapshot the rows this release touches (additive tables, used by rollback).
-- ----------------------------------------------------------------------------
CREATE TABLE public.bkp_20261116_account_categories AS
  SELECT * FROM public.account_categories;

CREATE TABLE public.bkp_20261116_record_translations_ac AS
  SELECT * FROM public.record_translations WHERE record_table = 'account_categories';

-- ----------------------------------------------------------------------------
-- 2. Deactivate (never delete) the 15 extra business rows.
--    Their codes/ids are unchanged; no account changes category.
-- ----------------------------------------------------------------------------
UPDATE public.account_categories
SET is_active = false, updated_at = now()
WHERE id IN (
  '26698967-e437-405f-97db-cf6459f78c1a',
  '21c6522a-df47-418b-b1d5-6ad6d4bb6f64',
  '5a8b2b5b-ff48-4257-90b3-a732905fe1ee',
  '60a8ea75-26b1-40b3-82e7-af7fd88435cb',
  '1b543766-6ac6-4ce9-ad02-d0baed1f00d4',
  'e7392807-2671-48ec-9b44-3a371b1beea7',
  '7e58d3d2-5bfa-475e-8889-52aa252df682',
  'fcca0f1a-ee55-4f55-b76a-de4ea627ad14',
  '00c9b81f-c6e8-4258-a2d5-17a7c8a1c56b',
  'f6822081-b262-4a46-a68d-8ef6a8bd4256',
  '8e918fe9-0247-4bc3-aa93-39f29f0b25f0',
  '13dc33e7-46a3-47ad-8055-396ddca92e42',
  'faeb343e-1312-4a50-8561-f751c27c94b4',
  '0483017b-28bf-4e3c-b244-681c42196250',
  'f622373b-8325-46b2-af8c-7f460a038129'
)
AND deleted_at IS NULL
AND is_active = true;

-- ----------------------------------------------------------------------------
-- 3. Insert the three missing business categories P, B and C.
-- ----------------------------------------------------------------------------
INSERT INTO public.account_categories (code, name, description, account_type, operational_domain, is_active, sort_order, is_system)
SELECT 'P', 'Purchases',
       'Purchase-side accounts (suppliers and purchases), separate from the combined P/S category',
       'Company', 'business', true, 0, false
WHERE NOT EXISTS (SELECT 1 FROM public.account_categories
                  WHERE deleted_at IS NULL AND lower(trim(name)) = 'purchases' AND operational_domain = 'business');

INSERT INTO public.account_categories (code, name, description, account_type, operational_domain, is_active, sort_order, is_system)
SELECT 'B', 'Bank',
       'Bank accounts, separate from the combined B/C category',
       'Bank', 'business', true, 0, false
WHERE NOT EXISTS (SELECT 1 FROM public.account_categories
                  WHERE deleted_at IS NULL AND lower(trim(name)) = 'bank' AND operational_domain = 'business');

INSERT INTO public.account_categories (code, name, description, account_type, operational_domain, is_active, sort_order, is_system)
SELECT 'C', 'Cash',
       'Cash counters and petty cash, separate from the combined B/C category',
       'Bank', 'business', true, 0, false
WHERE NOT EXISTS (SELECT 1 FROM public.account_categories
                  WHERE deleted_at IS NULL AND lower(trim(name)) = 'cash' AND operational_domain = 'business');

-- ----------------------------------------------------------------------------
-- 4. Carry-forward source date column (additive; NULL for every existing rate).
-- ----------------------------------------------------------------------------
ALTER TABLE public.daily_usd_rates
  ADD COLUMN IF NOT EXISTS carried_forward_from date;

COMMENT ON COLUMN public.daily_usd_rates.carried_forward_from IS
  'Rate date of the approved rate this row was carried forward from. NULL when the rate was entered.';

-- ----------------------------------------------------------------------------
-- 5. RLS: establish hardened role-based policies (aligned with 20261125 migration).
--    service_role (server routes) bypasses RLS as before.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS account_categories_all_policy ON public.account_categories;
DROP POLICY IF EXISTS account_categories_read_policy ON public.account_categories;
DROP POLICY IF EXISTS account_categories_read_authenticated ON public.account_categories;
DROP POLICY IF EXISTS account_categories_write_super_admin ON public.account_categories;
DROP POLICY IF EXISTS account_categories_write_policy ON public.account_categories;

CREATE POLICY account_categories_read_policy ON public.account_categories
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY account_categories_write_policy ON public.account_categories
  FOR ALL
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND r.name IN ('super_admin', 'country_admin', 'admin', 'accountant', 'finance_manager')
      )
      OR auth.jwt() ->> 'role' = 'service_role'
    )
  )
  WITH CHECK (
    deleted_at IS NULL AND (
      EXISTS (
        SELECT 1 FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id
        WHERE ura.user_id = auth.uid()
          AND r.name IN ('super_admin', 'country_admin', 'admin', 'accountant', 'finance_manager')
      )
      OR auth.jwt() ->> 'role' = 'service_role'
    )
  );

-- ----------------------------------------------------------------------------
-- 6. S keeps its current name. The owner corrects the S name in Settings (red row).

-- ----------------------------------------------------------------------------
-- 7. Five-language names for the 13 approved business categories (from 0acf63a).
--    Runs AFTER step 3, so the new P/B/C rows get translations too.
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE tmp_cat_names (
  code text PRIMARY KEY,
  en text NOT NULL,
  ur text NOT NULL,
  ar text NOT NULL,
  fa text NOT NULL,
  ps text NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_cat_names (code, en, ur, ar, fa, ps) VALUES
  ('P',             'Purchases',                       'خریداری',                          'المشتريات',                          'خرید',                             'پېرود'),
  ('P/S',           'Purchases & Sales / Trading',     'خریداری اور فروخت / تجارت',        'المشتريات والمبيعات / التجارة',       'خرید و فروش / تجارت',              'پېرود او پلورنه / سوداګري'),
  ('B',             'Bank',                            'بینک',                             'البنك',                              'بانک',                             'بانک'),
  ('C',             'Cash',                            'نقد',                              'النقد',                              'نقد',                              'نغدي'),
  ('B/C',           'Bank & Cash Accounts',            'بینک اور نقد اکاؤنٹس',             'حسابات البنك والنقد',                'حساب‌های بانک و نقد',              'د بانک او نغدو حسابونه'),
  ('B/P',           'Bills & Payables',                'بل اور واجب الادا رقم',            'الفواتير والمستحقات الدائنة',        'صورتحساب‌ها و پرداختنی‌ها',         'بلونه او د ورکړې وړ پیسې'),
  ('EX',            'General Operating Expenses',      'عمومی آپریٹنگ اخراجات',            'مصاريف التشغيل العامة',              'هزینه‌های عملیاتی عمومی',          'عمومي عملياتي لګښتونه'),
  ('OFFICE_EXP',    'Office & Administrative Expenses','دفتری اور انتظامی اخراجات',         'مصاريف المكتب والإدارة',             'هزینه‌های دفتری و اداری',          'د دفتر او اداري لګښتونه'),
  ('TRAVEL_EXP',    'Travel & Conveyance Expenses',    'سفر اور آمد و رفت کے اخراجات',     'مصاريف السفر والنقل',                'هزینه‌های سفر و حمل‌ونقل',         'د سفر او ترانسپورت لګښتونه'),
  ('UTILITY_EXP',   'Utilities & Facilities',          'یوٹیلیٹیز اور سہولیات',            'المرافق والخدمات',                   'خدمات و تأسیسات',                  'خدمات او تاسیسات'),
  ('INTER_TRADE',   'Inter-Country Trade & Settlement','بین ملکی تجارت اور تصفیہ',         'التجارة والتسوية بين الدول',         'تجارت و تسویه بین‌کشوری',          'د هېوادونو ترمنځ سوداګري او تصفیه'),
  ('INTER_TRANSFER','Inter-Country Money Transfer',    'بین ملکی رقم کی منتقلی',           'التحويل المالي بين الدول',           'انتقال پول بین‌کشوری',             'د هېوادونو ترمنځ د پیسو لېږد');

UPDATE public.record_translations rt
SET original_text = t.en,
    original_language_code = 'en',
    english_text = t.en,
    urdu_text = t.ur,
    arabic_text = t.ar,
    persian_text = t.fa,
    pashto_text = t.ps,
    translation_status = 'complete',
    source = 'manual',
    translated_by_engine = 'manual',
    translated_at = now(),
    updated_at = now()
FROM public.account_categories ac
JOIN tmp_cat_names t ON t.code = ac.code
WHERE rt.record_table = 'account_categories'
  AND rt.field_name = 'name'
  AND rt.deleted_at IS NULL
  AND rt.record_id = ac.id
  AND ac.operational_domain = 'business'
  AND ac.deleted_at IS NULL;

INSERT INTO public.record_translations (
  record_table, record_id, field_name, original_text, original_language_code,
  english_text, urdu_text, arabic_text, persian_text, pashto_text,
  translation_status, source, translated_by_engine, translated_at
)
SELECT 'account_categories', ac.id, 'name', t.en, 'en',
       t.en, t.ur, t.ar, t.fa, t.ps,
       'complete', 'manual', 'manual', now()
FROM public.account_categories ac
JOIN tmp_cat_names t ON t.code = ac.code
WHERE ac.operational_domain = 'business'
  AND ac.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.record_translations rt
    WHERE rt.record_table = 'account_categories'
      AND rt.record_id = ac.id
      AND rt.field_name = 'name'
      AND rt.deleted_at IS NULL
  );

-- ----------------------------------------------------------------------------
-- 7b. Description translations (five languages) for the 13 approved categories. Same rules as the names.
CREATE TEMP TABLE tmp_cat_desc (
  code text PRIMARY KEY,
  en text NOT NULL,
  ur text NOT NULL,
  ar text NOT NULL,
  fa text NOT NULL,
  ps text NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_cat_desc (code, en, ur, ar, fa, ps) VALUES
  ('P',             'Purchase-side accounts (suppliers and purchases), separate from the combined P/S category',
                    'خریداری کی سمت کے کھاتے (سپلائرز اور خریداری)، جو مشترکہ P/S کیٹگری سے الگ ہیں',
                    'حسابات جانب المشتريات (الموردون والمشتريات)، منفصلة عن فئة P/S المشتركة',
                    'حساب‌های سمت خرید (تأمین‌کنندگان و خریدها)، جدا از دسته مشترک P/S',
                    'د پېرود اړخ حسابونه (وړاندیز کونکي او پېرودنې)، د ګډ P/S کټګورۍ څخه جلا'),
  ('P/S',           'Accounts for core trading, customer invoicing, supplier purchases',
                    'بنیادی تجارت، کسٹمر انوائسنگ اور سپلائر خریداری کے کھاتے',
                    'حسابات التجارة الأساسية وفواتير العملاء ومشتريات الموردين',
                    'حساب‌های تجارت اصلی، صورتحساب مشتری و خرید از تأمین‌کننده',
                    'د اصلي سوداګرۍ، د پیرودونکو د بلونو او د وړاندیز کونکو د پېرود حسابونه'),
  ('B',             'Bank accounts, separate from the combined B/C category',
                    'بینک کے کھاتے، جو مشترکہ B/C کیٹگری سے الگ ہیں',
                    'حسابات البنوك، منفصلة عن فئة B/C المشتركة',
                    'حساب‌های بانکی، جدا از دسته مشترک B/C',
                    'د بانک حسابونه، د ګډ B/C کټګورۍ څخه جلا'),
  ('C',             'Cash counters and petty cash, separate from the combined B/C category',
                    'نقد کاؤنٹرز اور پیٹی کیش، جو مشترکہ B/C کیٹگری سے الگ ہیں',
                    'صناديق النقد والنقد الصغير، منفصلة عن فئة B/C المشتركة',
                    'صندوق‌های نقد و تنخواه، جدا از دسته مشترک B/C',
                    'د نغدو صندوقونه او واړه نغدي، د ګډ B/C کټګورۍ څخه جلا'),
  ('B/C',           'Liquid cash counters, bank operational accounts, petty cash',
                    'نقد کاؤنٹرز، بینک کے آپریشنل کھاتے اور پیٹی کیش',
                    'صناديق النقد السائلة، والحسابات التشغيلية للبنوك، والنقد الصغير',
                    'صندوق‌های نقد، حساب‌های عملیاتی بانک و تنخواه',
                    'د نغدو صندوقونه، د بانک عملیاتي حسابونه او واړه نغدي'),
  ('B/P',           'Trade vendor bills, recurring payables, freight invoices',
                    'تجارتی وینڈر بلز، باقاعدہ واجب الادا رقوم اور فریٹ انوائسز',
                    'فواتير الموردين التجاريين، والمستحقات الدائنة المتكررة، وفواتير الشحن',
                    'صورتحساب‌های فروشندگان تجاری، پرداختنی‌های دوره‌ای و صورتحساب حمل',
                    'د سوداګریزو پلورونکو بلونه، دورې ورکړې وړ پیسې او د لېږد بلونه'),
  ('EX',            'Administrative overhead, supplies, communication, daily operations',
                    'انتظامی اوور ہیڈ، سپلائیز، مواصلات اور روزمرہ کے آپریشنز',
                    'المصاريف الإدارية، والمستلزمات، والاتصالات، والعمليات اليومية',
                    'سربار اداری، لوازم، ارتباطات و عملیات روزانه',
                    'اداري لګښتونه، توکي، اړیکې او ورځني عملیات'),
  ('INTER_TRADE',   'Cross-border commercial trade settlements between countries (e.g. Dubai, Pakistan, Afghanistan)',
                    'ممالک کے درمیان سرحد پار تجارتی لین دین کی تصفیہ (مثلاً دبئی، پاکستان، افغانستان)',
                    'تسويات التجارة التجارية عبر الحدود بين الدول (مثل دبي وباكستان وأفغانستان)',
                    'تسویه تجارت مرزی بین کشورها (مانند دبی، پاکستان، افغانستان)',
                    'د هېوادونو ترمنځ د پولو تېرې سوداګریزې تصفیې (لکه دبی، پاکستان، افغانستان)'),
  ('INTER_TRANSFER','Inter-country fund transfers, exchange settlements, and central holding balances',
                    'ممالک کے درمیان فنڈ ٹرانسفر، ایکسچینج تصفیہ اور مرکزی ہولڈنگ بیلنس',
                    'التحويلات المالية بين الدول وتسويات الصرف وأرصدة الحيازة المركزية',
                    'انتقال وجوه بین کشوری، تسویه ارز و موجودی‌های نگهداری مرکزی',
                    'د هېوادونو ترمنځ د پیسو لېږدونه، د بدلون تصفیې او مرکزي ساتنې توازنونه'),
  ('OFFICE_EXP',    'Rent, stationery, computer hardware, maintenance',
                    'کرایہ، اسٹیشنری، کمپیوٹر ہارڈویئر، مرمت',
                    'الإيجار، والقرطاسية، وأجهزة الحاسوب، والصيانة',
                    'اجاره، لوازم التحریر، سخت‌افزار رایانه، نگهداری',
                    'کرایه، لیکنځۍ توکي، د کمپیوټر سخت‌افزار، ساتنه'),
  ('TRAVEL_EXP',    'Field travel, boarding, lodging, transport costs',
                    'فیلڈ سفر، بورڈنگ، رہائش اور ٹرانسپورٹ کے اخراجات',
                    'نفقات السفر الميداني والإقامة والمبيت والنقل',
                    'هزینه‌های سفر میدانی، اقامت، اسکان و حمل‌ونقل',
                    'د ساحې سفر، اوسیدنې، هوټل او ترانسپورت لګښتونه'),
  ('UTILITY_EXP',   'Electricity, water, gas, broadband internet services',
                    'بجلی، پانی، گیس اور براڈ بینڈ انٹرنیٹ سروسز',
                    'الكهرباء والمياه والغاز وخدمات الإنترنت عريض النطاق',
                    'برق، آب، گاز و خدمات اینترنت پرسرعت',
                    'بریښنا، اوبه، ګاز او د براډ بینډ انټرنیټ خدمات');

UPDATE public.record_translations rt
SET original_text = t.en,
    original_language_code = 'en',
    english_text = t.en,
    urdu_text = t.ur,
    arabic_text = t.ar,
    persian_text = t.fa,
    pashto_text = t.ps,
    translation_status = 'complete',
    source = 'manual',
    translated_by_engine = 'manual',
    translated_at = now(),
    updated_at = now()
FROM public.account_categories ac
JOIN tmp_cat_desc t ON t.code = ac.code
WHERE rt.record_table = 'account_categories'
  AND rt.field_name = 'description'
  AND rt.deleted_at IS NULL
  AND rt.record_id = ac.id
  AND ac.operational_domain = 'business'
  AND ac.deleted_at IS NULL;

INSERT INTO public.record_translations (
  record_table, record_id, field_name, original_text, original_language_code,
  english_text, urdu_text, arabic_text, persian_text, pashto_text,
  translation_status, source, translated_by_engine, translated_at
)
SELECT 'account_categories', ac.id, 'description', t.en, 'en',
       t.en, t.ur, t.ar, t.fa, t.ps,
       'complete', 'manual', 'manual', now()
FROM public.account_categories ac
JOIN tmp_cat_desc t ON t.code = ac.code
WHERE ac.operational_domain = 'business'
  AND ac.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.record_translations rt
    WHERE rt.record_table = 'account_categories'
      AND rt.record_id = ac.id
      AND rt.field_name = 'description'
      AND rt.deleted_at IS NULL
  );

-- ----------------------------------------------------------------------------
-- 8. Verification. Any mismatch raises an exception and the whole run rolls back.
-- ----------------------------------------------------------------------------
DO $$
DECLARE n int; missing int;
BEGIN
  SELECT count(*) INTO n FROM public.account_categories
   WHERE deleted_at IS NULL AND operational_domain = 'business' AND is_active;
  IF n <> 13 THEN
    RAISE EXCEPTION 'verify failed: expected 13 active business rows, found %', n;
  END IF;

  SELECT count(*) INTO missing FROM tmp_cat_names t
   WHERE NOT EXISTS (SELECT 1 FROM public.account_categories ac
                     WHERE ac.code = t.code AND ac.operational_domain = 'business'
                       AND ac.deleted_at IS NULL AND ac.is_active);
  IF missing <> 0 THEN
    RAISE EXCEPTION 'verify failed: % approved codes are not active', missing;
  END IF;

  SELECT count(*) INTO n FROM public.account_categories
   WHERE code = 'S' AND operational_domain = 'business' AND deleted_at IS NULL AND is_active;
  IF n <> 1 THEN
    RAISE EXCEPTION 'verify failed: S category missing or inactive';
  END IF;

  SELECT count(*) INTO n FROM public.account_categories ac
   WHERE ac.operational_domain = 'business' AND ac.deleted_at IS NULL AND ac.is_active AND ac.code <> 'S'
     AND NOT EXISTS (SELECT 1 FROM public.record_translations rt
                     WHERE rt.record_table = 'account_categories' AND rt.record_id = ac.id
                       AND rt.field_name = 'name' AND rt.deleted_at IS NULL
                       AND rt.english_text IS NOT NULL AND rt.urdu_text IS NOT NULL
                       AND rt.arabic_text IS NOT NULL AND rt.persian_text IS NOT NULL
                       AND rt.pashto_text IS NOT NULL);
  IF n <> 0 THEN
    RAISE EXCEPTION 'verify failed: % active business categories lack a complete 5-language name', n;
  END IF;

  SELECT count(*) INTO n FROM public.account_categories ac
   WHERE ac.operational_domain = 'business' AND ac.deleted_at IS NULL AND ac.is_active
     AND NOT EXISTS (SELECT 1 FROM public.record_translations rt
                     WHERE rt.record_table = 'account_categories' AND rt.record_id = ac.id
                       AND rt.field_name = 'description' AND rt.deleted_at IS NULL
                       AND rt.english_text IS NOT NULL AND rt.urdu_text IS NOT NULL
                       AND rt.arabic_text IS NOT NULL AND rt.persian_text IS NOT NULL
                       AND rt.pashto_text IS NOT NULL);
  IF n <> 0 THEN
    RAISE EXCEPTION 'verify failed: % active business categories lack a complete 5-language description', n;
  END IF;

  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'account_categories'
     AND policyname IN ('account_categories_read_policy','account_categories_write_policy');
  IF n <> 2 THEN
    RAISE EXCEPTION 'verify failed: expected the 2 account_categories policies (read and write), found %', n;
  END IF;

  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'daily_usd_rates' AND column_name = 'carried_forward_from';
  IF n <> 1 THEN
    RAISE EXCEPTION 'verify failed: daily_usd_rates.carried_forward_from is missing';
  END IF;
END $$;

-- Review the result set below before you approve the COMMIT:
SELECT code, name, account_type, is_active
FROM public.account_categories
WHERE deleted_at IS NULL AND operational_domain = 'business' AND is_active
ORDER BY code;

COMMIT;
