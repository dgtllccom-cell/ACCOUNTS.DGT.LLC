-- 20261116: account categories
--  1. Replace the open policy (FOR ALL USING true to public) with role-based access.
--  2. Category S becomes "Sales" (the S side of the P/S split). Codes never change.
--  3. Five-language names (en, ur, ar, fa, ps) for the 13 business categories.
-- Rows are matched by code + domain, so ids differ per environment and nothing is deleted.
-- Historical accounts keep their stored codes (enterprise_accounts.category).

DROP POLICY IF EXISTS account_categories_all_policy ON public.account_categories;
DROP POLICY IF EXISTS account_categories_read_policy ON public.account_categories;

-- Signed-in users can read active categories; super admins can read all rows.
CREATE POLICY account_categories_read_authenticated ON public.account_categories
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR is_super_admin());

-- Only a global super admin can create, change or deactivate categories.
-- service_role (server routes) bypasses RLS as before.
CREATE POLICY account_categories_write_super_admin ON public.account_categories
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

UPDATE public.account_categories
SET name = 'Sales',
    account_type = 'Customer',
    description = 'Sales and customer invoicing accounts (the S side of the P/S split)',
    updated_at = now()
WHERE code = 'S' AND operational_domain = 'business' AND deleted_at IS NULL;

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
  ('S',             'Sales',                           'فروخت',                            'المبيعات',                           'فروش',                             'پلورنه'),
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

-- Update the existing name translation rows of the 13 categories.
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

-- Insert the name translation for categories that have none yet.
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
