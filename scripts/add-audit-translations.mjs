import postgres from 'postgres';
import fs from 'fs';

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env.local', '.env']) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

const dbUrl = getDbUrl();
const sql = postgres(dbUrl, { max: 5, prepare: false });

const auditTranslations = [
  {
    key: "enterprise_audit_monitoring_center",
    en: "Enterprise Audit, Monitoring & Accountability Center",
    ur: "انٹرپرائز آڈٹ، مانیٹرنگ اور احتسابی مرکز",
    ar: "مركز تدقيق ومراقبة ومساءلة المؤسسة",
    fa: "مرکز حسابرسی، نظارت و پاسخگویی سازمانی",
    ps: "د تصدۍ د پلټنې، څارنې او حساب ورکونې مرکز"
  },
  {
    key: "complete_version_timeline",
    en: "Complete Entry Version & Edit Timeline",
    ur: "مکمل انٹری ورژن و ترمیم کی ٹائم لائن",
    ar: "الجدول الزمني الكامل لنسخ السجلات وتعديلها",
    fa: "جدول زمانی کامل نسخه و ویرایش ورودی",
    ps: "د ننوتلو بشپړ نسخه او د ترمیم مهال ویش"
  },
  {
    key: "deleted_records_archive_vault",
    en: "Deleted Records Archive & Restore Vault",
    ur: "ڈیلیٹ شدہ ریکارڈز کا محفوظ آرکائیو و بحالی کا والٹ",
    ar: "خزينة أرشيف واستعادة السجلات المحذوفة",
    fa: "مخزن آرشیو و بازیابی سوابق حذف شده",
    ps: "د حذف شوي ریکارډونو آرشیف او بیرته راګرځولو والټ"
  },
  {
    key: "daily_branch_monitoring",
    en: "Daily Branch Monitoring & Accountability",
    ur: "روزانہ برانچ مانیٹرنگ اور احتسابی رپورٹ",
    ar: "المراقبة والمساءلة اليومية للفروع",
    fa: "نظارت و پاسخگویی روزانه شعب",
    ps: "د څانګې ورځنۍ څارنه او حساب ورکونه"
  },
  {
    key: "user_productivity_audit",
    en: "User Activity & Productivity Audit",
    ur: "صارف کی سرگرمی اور پیداواری صلاحیت کا آڈٹ",
    ar: "تدقيق نشاط وإنتاجية المستخدمين",
    fa: "حسابرسی فعالیت و بهره‌وری کاربر",
    ps: "د کارونکي فعالیت او تولیداتو پلټنه"
  }
];

async function addTranslations() {
  console.log('=== ADDING 5-LANGUAGE TRANSLATIONS FOR ENTERPRISE AUDIT CENTER ===\n');

  for (const t of auditTranslations) {
    try {
      await sql`
        INSERT INTO translations_english (translation_key, translated_text, category)
        VALUES (${t.key}, ${t.en}, 'audit')
        ON CONFLICT (translation_key) DO UPDATE SET translated_text = ${t.en};
      `;
      await sql`
        INSERT INTO translations_urdu (translation_key, translated_text, category)
        VALUES (${t.key}, ${t.ur}, 'audit')
        ON CONFLICT (translation_key) DO UPDATE SET translated_text = ${t.ur};
      `;
      await sql`
        INSERT INTO translations_arabic (translation_key, translated_text, category)
        VALUES (${t.key}, ${t.ar}, 'audit')
        ON CONFLICT (translation_key) DO UPDATE SET translated_text = ${t.ar};
      `;
      await sql`
        INSERT INTO translations_persian (translation_key, translated_text, category)
        VALUES (${t.key}, ${t.fa}, 'audit')
        ON CONFLICT (translation_key) DO UPDATE SET translated_text = ${t.fa};
      `;
      await sql`
        INSERT INTO translations_pashto (translation_key, translated_text, category)
        VALUES (${t.key}, ${t.ps}, 'audit')
        ON CONFLICT (translation_key) DO UPDATE SET translated_text = ${t.ps};
      `;
      console.log(`✓ Added translation key: ${t.key}`);
    } catch (e) {
      console.warn(`Warning on ${t.key}:`, e.message);
    }
  }

  await sql.end();
  console.log('\n=== TRANSLATIONS UPDATED SUCCESSFULLY ===');
}

addTranslations().catch(console.error);
