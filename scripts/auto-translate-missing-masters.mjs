import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const vpsSql = postgres(resolveDbUrl("prod"), { ssl: { rejectUnauthorized: false } });

// Basic dictionary for standard types
const translationsDict = {
  "Sole Proprietorship": { ur: "انفرادی ملکیت", ar: "ملكية فردية", fa: "مالکیت انفرادی", ps: "انفرادي ملکیت" },
  "Partnership": { ur: "شراکت داری", ar: "شراكة", fa: "مشارکت", ps: "شراکت" },
  "Limited Liability Company (LLC)": { ur: "محدود ذمہ داری کمپنی (ایل ایل سی)", ar: "شركة ذات مسؤولية محدودة (ذ.م.م)", fa: "شرکت با مسئولیت محدود", ps: "محدود مسؤلیت لرونکی شرکت" },
  "Public Joint Stock Company (PJSC)": { ur: "پبلک جوائنٹ اسٹاک کمپنی", ar: "شركة مساهمة عامة", fa: "شرکت سهامی عام", ps: "عامه ګډه سټاک شرکت" },
  "Private Joint Stock Company (PrJSC)": { ur: "پرائیویٹ جوائنٹ اسٹاک کمپنی", ar: "شركة مساهمة خاصة", fa: "شرکت سهامی خاص", ps: "خصوصي ګډه سټاک شرکت" },
  "Branch of Free Zone Company": { ur: "فری زون کمپنی کی برانچ", ar: "فرع شركة المنطقة الحرة", fa: "شعبه شرکت منطقه آزاد", ps: "د آزاد زون شرکت څانګه" },
  "Branch of Foreign Company": { ur: "غیر ملکی کمپنی کی برانچ", ar: "فرع شركة أجنبية", fa: "شعبه شرکت خارجی", ps: "د بهرني شرکت څانګه" },
  "Civil Company": { ur: "سول کمپنی", ar: "شركة مدنية", fa: "شرکت مدنی", ps: "مدني شرکت" },
  
  "Commercial Registration": { ur: "تجارتی رجسٹریشن", ar: "سجل تجاري", fa: "ثبت تجاری", ps: "تجارتي ثبت" },
  "Tax Identification Number (TIN)": { ur: "ٹیکس شناختی نمبر", ar: "الرقم التعريفي الضريبي", fa: "شماره شناسایی مالیاتی", ps: "د مالیې پیژندنې شمیره" },
  "Value Added Tax (VAT) Certificate": { ur: "وی اے ٹی سرٹیفکیٹ", ar: "شهادة ضريبة القيمة المضافة", fa: "گواهی مالیات بر ارزش افزوده", ps: "د ارزښت اضافه مالیې سند" },
  "Memorandum of Association (MOA)": { ur: "میمورنڈم آف ایسوسی ایشن", ar: "عقد التأسيس", fa: "اساسنامه شرکت", ps: "د شرکت بنسټ لیک" },
  "Articles of Association (AOA)": { ur: "آرٹیکلز آف ایسوسی ایشن", ar: "النظام الأساسي", fa: "آیین‌نامه شرکت", ps: "د شرکت مقررات" },
  "Power of Attorney (POA)": { ur: "مختار نامہ", ar: "توكيل رسمي", fa: "وکالت‌نامه", ps: "وکالت لیک" },
  "Passport Copy": { ur: "پاسپورٹ کی کاپی", ar: "نسخة جواز السفر", fa: "کپی گذرنامه", ps: "د پاسپورټ کاپي" },
  "Emirates ID Copy": { ur: "امارات آئی ڈی کاپی", ar: "نسخة الهوية الإماراتية", fa: "کپی کارت شناسایی امارات", ps: "د اماراتو د پیژندپاڼې کاپي" }
};

async function autoTranslateMissingMasters() {
  console.log("=== AUTO-TRANSLATING ALL REMAINING MASTER RECORDS (5 LANGUAGES) ===");

  // 1. Company Registration Types
  const regTypes = await vpsSql`SELECT id, name FROM company_registration_types`;
  for (const rt of regTypes) {
    const t = translationsDict[rt.name] || { ur: rt.name, ar: rt.name, fa: rt.name, ps: rt.name };
    await vpsSql`
      INSERT INTO record_translations (
        record_table, record_id, field_name, original_text, original_language_code,
        english_text, urdu_text, arabic_text, persian_text, pashto_text
      ) VALUES (
        'company_registration_types', ${rt.id}, 'name', ${rt.name}, 'en',
        ${rt.name}, ${t.ur}, ${t.ar}, ${t.fa}, ${t.ps}
      )
      ON CONFLICT (id) DO UPDATE SET
        english_text = EXCLUDED.english_text,
        urdu_text = EXCLUDED.urdu_text,
        arabic_text = EXCLUDED.arabic_text,
        persian_text = EXCLUDED.persian_text,
        pashto_text = EXCLUDED.pashto_text;
    `;
  }
  console.log(`✓ Translated ${regTypes.length} Company Registration Types across 5 languages.`);

  // 2. Document Types
  const docTypes = await vpsSql`SELECT id, name FROM document_types`;
  for (const dt of docTypes) {
    const t = translationsDict[dt.name] || { ur: dt.name, ar: dt.name, fa: dt.name, ps: dt.name };
    await vpsSql`
      INSERT INTO record_translations (
        record_table, record_id, field_name, original_text, original_language_code,
        english_text, urdu_text, arabic_text, persian_text, pashto_text
      ) VALUES (
        'document_types', ${dt.id}, 'name', ${dt.name}, 'en',
        ${dt.name}, ${t.ur}, ${t.ar}, ${t.fa}, ${t.ps}
      )
      ON CONFLICT (id) DO UPDATE SET
        english_text = EXCLUDED.english_text,
        urdu_text = EXCLUDED.urdu_text,
        arabic_text = EXCLUDED.arabic_text,
        persian_text = EXCLUDED.persian_text,
        pashto_text = EXCLUDED.pashto_text;
    `;
  }
  console.log(`✓ Translated ${docTypes.length} Document Types across 5 languages.`);

  await vpsSql.end();
}

autoTranslateMissingMasters().catch(console.error);
