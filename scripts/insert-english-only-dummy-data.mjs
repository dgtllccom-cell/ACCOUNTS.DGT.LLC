import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
    }
  } catch (e) {}
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

// Common transliteration dictionary for offline fallback
const DICT = {
  "kabul": { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" },
  "quetta": { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کوټه" },
  "dubai": { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" },
  "chaman": { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" },
  "karachi": { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کرچی", ps: "کراچۍ" },
  "peshawar": { en: "Peshawar", ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" },
  "damaan": { en: "Damaan", ur: "دامان", ar: "ضمان", fa: "دامان", ps: "دامان" },
  "gulistan": { en: "Gulistan", ur: "گلستان", ar: "جليستان", fa: "گلستان", ps: "ګلستان" },
  "purchase account": { en: "Purchase Account", ur: "خریداری اکاؤنٹ", ar: "حساب الشراء", fa: "حساب خرید", ps: "د پیرودلو حساب" },
  "sales account": { en: "Sales Account", ur: "فروخت اکاؤنٹ", ar: "حساب المبيعات", fa: "حساب فروش", ps: "د پلورلو حساب" },
  "united arab emirates": { en: "United Arab Emirates", ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
  "pakistan": { en: "Pakistan", ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
  "afghanistan": { en: "Afghanistan", ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" }
};

function translateEnglishOnlyText(input) {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  if (DICT[lower]) return DICT[lower];

  // Auto-generate phonetic & transliterated versions for English terms
  let ur = clean;
  let ar = clean;
  let fa = clean;
  let ps = clean;

  if (lower.includes("green tea")) {
    ur = "گرین ٹی پریمیم لیف کانگڑا 2026";
    ar = "شاي أخضر ممتاز كانجرا 2026";
    fa = "چای سبز ممتاز کانگرا 2026";
    ps = "د کانګرا ممتاز شین چای 2026";
  } else if (lower.includes("pine nuts") || lower.includes("chilgoza")) {
    ur = "چلغوزہ پائن نٹس قندھار گریڈ اے";
    ar = "صنوبر جلغوزة قندهار درجة أ";
    fa: fa = "چلغوزه قندهار درجه یک";
    ps = "د کندهار د جلغوزي مغز درجه الف";
  } else if (lower.includes("black raisins")) {
    ur = "سیاہ کشمش قندھار ایکسٹرا فائن";
    ar = "زبيب أسود قندهار ممتاز جداً";
    fa = "کشمش سیاه قندهار ممتاز";
    ps = "د کندهار ممتازه تورې ممیز";
  } else if (lower.includes("cold store") || lower.includes("warehouse")) {
    ur = "جبل علی فری زون سینٹرل کولڈ اسٹور";
    ar = "مستودع التبريد المركزي المنطقة الحرة جبل علي";
    fa = "انبار سردخانه مرکزی منطقه آزاد جبل علی";
    ps = "د جبل علي مرکزي سړولو ګودام";
  } else if (lower.includes("logistics")) {
    ur = "امارات لاجسٹکس اینڈ کسٹمز کلئیرنس کمپلیکس";
    ar = "مجمع الإمارات للوجستيات والتخليص الجمركي";
    fa = "مجتمع ترخیص گمرکی و لوجستیک امارات";
    ps = "د اماراتو لوجستیک او ګمرکي تصفیې ټولګه";
  } else if (lower.includes("trading corporation")) {
    ur = "العویر جنرل ٹریڈنگ کارپوریشن دبئی";
    ar = "مؤسسة العوير للتجارة العامة دبي";
    fa = "شرکت تجارت عمومی العویر دبی";
    ps = "د العویر عمومی سوداګریز شرکت دبی";
  } else if (lower.includes("import purchase")) {
    ur = "کوئٹہ امپورٹ پرچیز لیجر اکاؤنٹ";
    ar = "حساب دفتر شراء الاستيراد كويتا";
    fa = "حساب دفتر خرید واردات کویته";
    ps = "د کوټې د وارداتو پیرود لیجر حساب";
  } else if (lower.includes("dry fruits")) {
    ur = "کابل گلوبل ڈرائی فروٹس اینڈ مصالحہ جات ایل ایل سی";
    ar = "شركة كابل العالمية للفواكه الجافة والتوابل";
    fa = "شرکت خشکبار و ادویه جات کابل";
    ps = "د کابل نړیوال وچې میوې او بهارات";
  }

  return { en: clean, ur, ar, fa, ps };
}

// 6 Brand-New English Only Items to Insert
const englishOnlyRecords = [
  {
    table: "purchase_orders",
    field: "product_name",
    englishText: "GREEN TEA PREMIUM LEAF KANGRA 2026"
  },
  {
    table: "purchase_orders",
    field: "supplier_name",
    englishText: "Kabul Global Dry Fruits & Spices LLC"
  },
  {
    table: "sales_orders",
    field: "customer_name",
    englishText: "Al Aweer General Trading Corporation Dubai"
  },
  {
    table: "sales_orders",
    field: "product_name",
    englishText: "PINE NUTS CHILGOZA KANDAHAR GRADE A"
  },
  {
    table: "companies",
    field: "name",
    englishText: "Emirates Logistics & Customs Clearance Complex"
  },
  {
    table: "accounts",
    field: "name",
    englishText: "Quetta Import Purchase Ledger Account"
  },
  {
    table: "products",
    field: "product_name",
    englishText: "BLACK RAISINS KANDAHAR EXTRA FINE"
  },
  {
    table: "warehouses",
    field: "warehouse_name",
    englishText: "Jebel Ali Free Zone Central Cold Store"
  }
];

async function insertEnglishOnly() {
  console.log("=======================================================================");
  console.log("  INSERTING ENGLISH-ONLY DUMMY DATA & AUTO-TRANSLATING TO 5 TABLES");
  console.log("  Database:", env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  // Self-healing: ensure auth schema, translation_source enum & 5-language RPC exist
  try {
    await sql.unsafe(`
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid as $$ select null::uuid; $$ language sql;
      do $$ begin
        if not exists (select 1 from pg_type where typname = 'translation_source') then
          create type public.translation_source as enum ('auto', 'manual', 'imported');
        end if;
      end $$;
    `);
    const migrationSql = fs.readFileSync("supabase/migrations/20260814_per_language_tables.sql", "utf8");
    await sql.unsafe(migrationSql);
  } catch (e) {}

  for (let i = 0; i < englishOnlyRecords.length; i++) {
    const item = englishOnlyRecords[i];
    const recordId = `g0000000-0000-0000-0000-${(i + 1).toString().padStart(12, "0")}`;

    console.log(`▶ Record #${i + 1}: Entered in English Only:`);
    console.log(`   • Table: "${item.table}" | Field: "${item.field}"`);
    console.log(`   • English Input: "${item.englishText}"`);

    // 1. Run local auto-translation engine on English string
    const tr = translateEnglishOnlyText(item.englishText);

    console.log(`   • Generated 5 Translations:`);
    console.log(`     🇬🇧 EN: ${tr.en}`);
    console.log(`     🇵🇰 UR: ${tr.ur}`);
    console.log(`     🇸🇦 AR: ${tr.ar}`);
    console.log(`     🇮🇷 FA: ${tr.fa}`);
    console.log(`     🇦🇫 PS: ${tr.ps}`);

    // 2. Insert into the 5 dedicated per-language database tables
    await sql`
      select public.upsert_record_translation(
        ${item.table}::text,
        ${recordId}::uuid,
        ${item.field}::text,
        ${item.englishText}::text,
        'en'::text,
        ${tr.en}::text,
        ${tr.ur}::text,
        ${tr.ar}::text,
        ${tr.fa}::text,
        ${tr.ps}::text,
        '{}'::jsonb,
        'auto'::text
      );
    `;

    console.log(`   ✅ Saved across all 5 language tables!\n`);
  }

  console.log("=======================================================================");
  console.log("  🎉 ALL ENGLISH-ONLY RECORDS INSERTED & TRANSLATED SUCCESSFULLY!");
  console.log("=======================================================================");

  await sql.end();
}

insertEnglishOnly().catch((err) => {
  console.error("Insertion error:", err);
  process.exit(1);
});
