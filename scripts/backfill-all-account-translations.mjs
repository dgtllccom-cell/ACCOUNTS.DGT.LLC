import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || "").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const DICTIONARY_PAIRS = [
  // Compound Accounts
  { en: "Payable Account", ur: "قابل ادائیگی کھاتہ", ar: "حساب الدفع", fa: "حساب پرداختنی", ps: "د تادیې وړ حساب" },
  { en: "Receivable Account", ur: "قابل وصولی کھاتہ", ar: "حساب القبض", fa: "حساب دریافتنی", ps: "د ترلاسه کولو وړ حساب" },
  { en: "Cash Account", ur: "کیش اکاؤنٹ", ar: "حساب النقد", fa: "حساب نقدی", ps: "د نغدو پیسو حساب" },
  { en: "Bank Account", ur: "بینک اکاؤنٹ", ar: "حساب بنكي", fa: "حساب بانکی", ps: "بانکي حساب" },
  { en: "Purchase Account", ur: "خریداری اکاؤنٹ", ar: "حساب الشراء", fa: "حساب خرید", ps: "د پیرودلو حساب" },
  { en: "Sales Account", ur: "فروخت اکاؤنٹ", ar: "حساب المبيعات", fa: "حساب فروش", ps: "د پلورلو حساب" },
  { en: "Expense Account", ur: "اخراجات اکاؤنٹ", ar: "حساب المصروفات", fa: "حساب هزینه‌ها", ps: "د لګښتونو حساب" },
  { en: "Income Account", ur: "آمدنی اکاؤنٹ", ar: "حساب الإيرادات", fa: "حساب درآمد", ps: "د عاید حساب" },
  { en: "Asset Account", ur: "اثاثہ جات اکاؤنٹ", ar: "حساب الأصول", fa: "حساب دارایی", ps: "د شتمنیو حساب" },
  { en: "Liability Account", ur: "واجبات اکاؤنٹ", ar: "حساب الخصوم", fa: "حساب بدهی", ps: "د پورونو حساب" },
  { en: "Equity Account", ur: "سرمایہ اکاؤنٹ", ar: "حساب حقوق الملكية", fa: "حساب حقوق صاحبان سهام", ps: "د پانګې حساب" },
  { en: "Capital Account", ur: "سرمایہ اکاؤنٹ", ar: "حساب رأس المال", fa: "حساب سرمایه", ps: "د سرمایې حساب" },
  { en: "Main Branch", ur: "مین برانچ", ar: "الفرع الرئيسي", fa: "شعبه اصلی", ps: "اصلي څانګه" },
  { en: "City Branch", ur: "سٹی برانچ", ar: "فرع المدينة", fa: "شعبه شهری", ps: "د ښار څانګه" },
  { en: "Head Office", ur: "ہیڈ آفس", ar: "المكتب الرئيسي", fa: "دفتر مرکزی", ps: "مرکزي دفتر" },
  { en: "Habib Bank Limited", ur: "حبیب بینک لمیٹڈ", ar: "حبيب بنك المحدود", fa: "حبیب بانک محدود", ps: "حبیب بانک محدود" },
  { en: "National Bank of Pakistan", ur: "نیشنل بینک آف پاکستان", ar: "بنك باكستان الوطني", fa: "بانک ملی پاکستان", ps: "د پاکستان ملي بانک" },
  { en: "Meezan Bank", ur: "میزان بینک", ar: "بنك ميزان", fa: "بانک میزان", ps: "میزان بانک" },
  { en: "United Bank Limited", ur: "یونائیٹڈ بینک لمیٹڈ", ar: "يونايتد بنك المحدود", fa: "یونایتد بانک محدود", ps: "یونایټډ بانک محدود" },
  { en: "Bank Alfalah", ur: "بینک الفلاح", ar: "بنك الفلاح", fa: "بانک الفلاح", ps: "بانک الفلاح" },
  { en: "Allied Bank Limited", ur: "الائیڈ بینک لمیٹڈ", ar: "ألايد بنك المحدود", fa: "الاید بانک محدود", ps: "الایډ بانک محدود" },

  // Single terms
  { en: "Dev", ur: "دیو", ar: "ديف", fa: "دو", ps: "ډیو" },
  { en: "Test", ur: "ٹیسٹ", ar: "اختبار", fa: "تست", ps: "ازموینه" },
  { en: "Account", ur: "اکاؤنٹ", ar: "حساب", fa: "حساب", ps: "حساب" },
  { en: "Account", ur: "کھاتہ", ar: "حساب", fa: "حساب", ps: "حساب" },
  { en: "Payable", ur: "قابل ادائیگی", ar: "الدفع", fa: "پرداختنی", ps: "د تادیې وړ" },
  { en: "Receivable", ur: "قابل وصولی", ar: "القبض", fa: "دریافتنی", ps: "د ترلاسه کولو وړ" },
  { en: "Payable", ur: "ادائیگی", ar: "الدفع", fa: "پرداختنی", ps: "تادیه" },
  { en: "Receivable", ur: "وصولی", ar: "القبض", fa: "دریافتنی", ps: "ترلاسه کول" },
  { en: "Cash", ur: "کیش", ar: "النقد", fa: "نقد", ps: "نغدې پیسې" },
  { en: "Cash", ur: "نقد", ar: "النقد", fa: "نقد", ps: "نغد" },
  { en: "Bank", ur: "بینک", ar: "بنك", fa: "بانک", ps: "بانک" },
  { en: "Traders", ur: "ٹریڈرز", ar: "تجار", fa: "بازرگانان", ps: "سوداګر" },
  { en: "Trading", ur: "ٹریڈنگ", ar: "تجارة", fa: "تجارت", ps: "سوداګري" },
  { en: "Company", ur: "کمپنی", ar: "شركة", fa: "شرکت", ps: "شرکت" },
  { en: "Transport", ur: "ٹرانسپورٹ", ar: "النقل", fa: "حمل و نقل", ps: "ټرانسپورټ" },
  { en: "Enterprises", ur: "انٹرپرائزز", ar: "مشاريع", fa: "موسسات", ps: "تصدۍ" },
  { en: "Services", ur: "سروسز", ar: "خدمات", fa: "خدمات", ps: "خدمتونه" },
  { en: "Logistics", ur: "لوجسٹکس", ar: "لوجستيات", fa: "لجستیک", ps: "لوژستیک" },
  { en: "Limited", ur: "لمیٹڈ", ar: "المحدودة", fa: "محدود", ps: "محدود" },
  { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کوټه" },
  { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" },
  { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کرچی", ps: "کراچۍ" },
  { en: "Lahore", ur: "لاہور", ar: "لاهور", fa: "لاهور", ps: "لاهور" },
  { en: "Islamabad", ur: "اسلام آباد", ar: "إسلام أباد", fa: "اسلام‌آباد", ps: "اسلام آباد" },
  { en: "Peshawar", ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" },
  { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" },
  { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" },
  { en: "Kandahar", ur: "قندھار", ar: "قندهار", fa: "قندهار", ps: "کندهار" },
  { en: "Ahmed", ur: "احمد", ar: "أحمد", fa: "احمد", ps: "احمد" },
  { en: "Muhammad", ur: "محمد", ar: "محمد", fa: "محمد", ps: "محمد" },
  { en: "Ali", ur: "علی", ar: "علي", fa: "علی", ps: "علي" },
  { en: "Khan", ur: "خان", ar: "خان", fa: "خان", ps: "خان" },
  { en: "Hassan", ur: "حسن", ar: "حسن", fa: "حسن", ps: "حسن" },
  { en: "Tariq", ur: "طارق", ar: "طارق", fa: "طارق", ps: "طارق" }
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectScriptType(text) {
  if (!text) return "latin";
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (arabicPattern.test(text)) return "arabic";
  return "latin";
}

function autoTranslate5(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return { en: "", ur: "", ar: "", fa: "", ps: "" };
  }

  const script = detectScriptType(trimmed);
  const isArabic = script === "arabic";

  // Exact phrase match
  const exact = DICTIONARY_PAIRS.find((item) =>
    (isArabic
      ? item.ur === trimmed || item.ar === trimmed || item.fa === trimmed || item.ps === trimmed
      : item.en.toLowerCase() === trimmed.toLowerCase())
  );
  if (exact) {
    return {
      en: exact.en,
      ur: exact.ur,
      ar: exact.ar,
      fa: exact.fa,
      ps: exact.ps
    };
  }

  // Token replacement
  let enResult = trimmed;
  let urResult = trimmed;
  let arResult = trimmed;
  let faResult = trimmed;
  let psResult = trimmed;

  const sortedPairs = [...DICTIONARY_PAIRS].sort((a, b) => {
    const lenA = isArabic ? a.ur.length : a.en.length;
    const lenB = isArabic ? b.ur.length : b.en.length;
    return lenB - lenA;
  });

  for (const pair of sortedPairs) {
    const fromText = isArabic ? (pair.ur || pair.ar) : pair.en;
    if (!fromText) continue;

    const regex = isArabic
      ? new RegExp(escapeRegExp(fromText), "g")
      : new RegExp(`\\b${escapeRegExp(fromText)}\\b`, "gi");

    if (regex.test(trimmed)) {
      enResult = enResult.replace(regex, pair.en);
      urResult = urResult.replace(regex, pair.ur);
      arResult = arResult.replace(regex, pair.ar);
      faResult = faResult.replace(regex, pair.fa);
      psResult = psResult.replace(regex, pair.ps);
    }
  }

  return {
    en: enResult || trimmed,
    ur: urResult || trimmed,
    ar: arResult || trimmed,
    fa: faResult || trimmed,
    ps: psResult || trimmed
  };
}

async function runSupabaseBackfill() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.log("Supabase credentials missing. Skipping Supabase backfill.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log("Connected to Supabase.");

  // 1. enterprise_accounts
  const { data: accounts, error: accErr } = await supabase
    .from("enterprise_accounts")
    .select("id, name")
    .is("deleted_at", null);

  if (accErr) {
    console.error("Error loading enterprise_accounts:", accErr);
  } else if (accounts?.length) {
    console.log(`Found ${accounts.length} enterprise_accounts in Supabase.`);
    for (const acc of accounts) {
      if (!acc.name) continue;
      const isArabic = detectScriptType(acc.name) === "arabic";
      const srcLang = isArabic ? "ur" : "en";
      const trans = autoTranslate5(acc.name);

      await supabase.from("record_translations").upsert({
        record_table: "enterprise_accounts",
        record_id: acc.id,
        field_name: "name",
        original_text: acc.name,
        original_language_code: srcLang,
        english_text: trans.en,
        urdu_text: trans.ur,
        arabic_text: trans.ar,
        persian_text: trans.fa,
        pashto_text: trans.ps,
        language_texts: trans,
        translation_source: "auto",
        translation_status: "complete",
        translated_by_engine: "local_dictionary",
        updated_at: new Date().toISOString()
      }, { onConflict: "record_table,record_id,field_name" });
    }
    console.log(`✅ Backfilled translations for ${accounts.length} enterprise_accounts.`);
  }

  // 2. ledgers
  const { data: ledgers, error: ledErr } = await supabase
    .from("ledgers")
    .select("id, name")
    .is("deleted_at", null);

  if (ledErr) {
    console.error("Error loading ledgers:", ledErr);
  } else if (ledgers?.length) {
    console.log(`Found ${ledgers.length} ledgers in Supabase.`);
    for (const led of ledgers) {
      if (!led.name) continue;
      const isArabic = detectScriptType(led.name) === "arabic";
      const srcLang = isArabic ? "ur" : "en";
      const trans = autoTranslate5(led.name);

      await supabase.from("record_translations").upsert({
        record_table: "ledgers",
        record_id: led.id,
        field_name: "name",
        original_text: led.name,
        original_language_code: srcLang,
        english_text: trans.en,
        urdu_text: trans.ur,
        arabic_text: trans.ar,
        persian_text: trans.fa,
        pashto_text: trans.ps,
        language_texts: trans,
        translation_source: "auto",
        translation_status: "complete",
        translated_by_engine: "local_dictionary",
        updated_at: new Date().toISOString()
      }, { onConflict: "record_table,record_id,field_name" });
    }
    console.log(`✅ Backfilled translations for ${ledgers.length} ledgers.`);
  }
}

async function main() {
  await runSupabaseBackfill();
  console.log("=== Backfill Complete ===");
}

main().catch(console.error);
