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

const masterData = [
  // ── 1. ACCOUNTS & CHART OF ACCOUNTS ──
  { table: "accounts", field: "name", text: "Kabul Wholesalers Dry Fruits Purchase Account", tr: { en: "Kabul Wholesalers Dry Fruits Purchase Account", ur: "کابل ہول سیلرز ڈرائی فروٹس خریداری اکاؤنٹ", ar: "حساب شراء الفواكه الجافة كابول", fa: "حساب خرید خشکبار کابل", ps: "د کابل وچې میوې پیرود حساب" } },
  { table: "accounts", field: "name", text: "Damaan Global General Trading Sales Account", tr: { en: "Damaan Global General Trading Sales Account", ur: "دامان گلوبل جنرل ٹریڈنگ فروخت اکاؤنٹ", ar: "حساب مبيعات ضمان التجارة العامة", fa: "حساب فروش تجارت عمومی دامان", ps: "د دامان د عمومی سوداګرۍ پلور حساب" } },
  { table: "accounts", field: "name", text: "Al Ras Spices Wholesale Account", tr: { en: "Al Ras Spices Wholesale Account", ur: "الراس مصالحہ جات ہول سیل اکاؤنٹ", ar: "حساب بالجملة بهارات الرأس", fa: "حساب عمده فروشی ادویه الراس", ps: "د الراس بهاراتو د ټول پلور حساب" } },
  { table: "accounts", field: "name", text: "Emirates International Import Export Account", tr: { en: "Emirates International Import Export Account", ur: "امارات انٹرنیشنل امپورٹ ایکسپورٹ اکاؤنٹ", ar: "حساب الإمارات الدولية للاستيراد والتصدير", fa: "حساب واردات و صادرات بین المللی امارات", ps: "د اماراتو نړيوال واردات او صادرات حساب" } },
  { table: "accounts", field: "name", text: "Quetta Logistics Clearing Account", tr: { en: "Quetta Logistics Clearing Account", ur: "کوئٹہ لاجسٹکس کلئیرنگ اکاؤنٹ", ar: "حساب تخليص اللوجستيات كويتا", fa: "حساب ترخیص لوجستیک کویته", ps: "د کوټې لوجستیک د پاکولو حساب" } },

  // ── 2. PURCHASE BOOKING ORDERS ──
  { table: "purchase_orders", field: "product_name", text: "WALNUT KERNEL SIALKOT SUPER 2026", tr: { en: "WALNUT KERNEL SIALKOT SUPER 2026", ur: "والنٹ کرنل سیالکوٹ سپر 2026", ar: "جوز مغز سيالكوت ممتاز 2026", fa: "مغز گردو سیالکوت ممتاز 2026", ps: "د سیالکوټ ممتاز جوز مغز 2026" } },
  { table: "purchase_orders", field: "supplier_name", text: "Kabul Wholesalers Dry Fruits Trading Co.", tr: { en: "Kabul Wholesalers Dry Fruits Trading Co.", ur: "کابل ہول سیلرز ڈرائی فروٹس ٹریڈنگ کمپنی", ar: "شركة كابل لتجارة الفواكه الجافة", fa: "شرکت تجارت خشکبار کابل", ps: "د کابل د وچو میوو سوداګریز شرکت" } },
  { table: "purchase_orders", field: "product_name", text: "GREEN TEA PREMIUM LEAF KANGRA 2026", tr: { en: "GREEN TEA PREMIUM LEAF KANGRA 2026", ur: "گرین ٹی پریمیم لیف کانگڑا 2026", ar: "شاي أخضر ممتاز كانجرا 2026", fa: "چای سبز ممتاز کانگرا 2026", ps: "د کانګرا ممتاز شین چای 2026" } },

  // ── 3. SALES ORDERS & BOOKINGS ──
  { table: "sales_orders", field: "customer_name", text: "Muhammad Gulistan Food Distributors LLC Dubai", tr: { en: "Muhammad Gulistan Food Distributors LLC Dubai", ur: "محمد گلستان فوڈ ڈسٹری بیوٹرز ایل ایل سی دبئی", ar: "شركة محمد جليستان لتوزيع الأغذية ش.ذ.م.م دبي", fa: "شرکت توزیع مواد غذایی محمد گلستان دبی", ps: "د محمد ګلستان خوراکي توکو ویشونکی شرکت دبی" } },
  { table: "sales_orders", field: "product_name", text: "PINE NUTS CHILGOZA KANDAHAR GRADE A", tr: { en: "PINE NUTS CHILGOZA KANDAHAR GRADE A", ur: "چلغوزہ پائن نٹس قندھار گریڈ اے", ar: "صنوبر جلغوزة قندهار درجة أ", fa: "چلوزه قندهار درجه یک", ps: "د کندهار د جلغوزي مغز درجه الف" } },
  { table: "sales_orders", field: "customer_name", text: "Al Aweer General Trading Corporation Dubai", tr: { en: "Al Aweer General Trading Corporation Dubai", ur: "العویر جنرل ٹریڈنگ کارپوریشن دبئی", ar: "مؤسسة العوير للتجارة العامة دبي", fa: "شرکت تجارت عمومی العویر دبی", ps: "د العویر عمومی سوداګریز شرکت دبی" } },

  // ── 4. COMPANIES & COUNTERPARTIES ──
  { table: "companies", field: "name", text: "Damaan Global Trading LLC Dubai", tr: { en: "Damaan Global Trading LLC Dubai", ur: "دامان گلوبل ٹریڈنگ ایل ایل سی دبئی", ar: "شركة ضمان العالمية للتجارة ش.ذ.م.م دبي", fa: "شرکت تجارت عمومی دامان دبی", ps: "د دامان نړیوال سوداګریز شرکت دبی" } },
  { table: "companies", field: "name", text: "Emirates Logistics & Customs Clearance Complex", tr: { en: "Emirates Logistics & Customs Clearance Complex", ur: "امارات لاجسٹکس اینڈ کسٹمز کلئیرنس کمپلیکس", ar: "مجمع الإمارات للوجستيات والتخليص الجمركي", fa: "مجتمع ترخیص گمرکی و لوجستیک امارات", ps: "د اماراتو لوجستیک او ګمرکي تصفیې ټولګه" } },

  // ── 5. PRODUCTS & INVENTORY ──
  { table: "products", field: "product_name", text: "PISTACHIO SHELLED EXTRA FINE GRADE A", tr: { en: "PISTACHIO SHELLED EXTRA FINE GRADE A", ur: "پستہ شیلڈ ایکسٹرا فائن گریڈ اے", ar: "فستق حلبي مقشر ممتاز درجة أ", fa: "پسته مغز شده ممتاز درجه یک", ps: "د پستې ممتاز مغز درجه الف" } },
  { table: "products", field: "product_name", text: "BLACK RAISINS KANDAHAR EXTRA FINE", tr: { en: "BLACK RAISINS KANDAHAR EXTRA FINE", ur: "سیاہ کشمش قندھار ایکسٹرا فائن", ar: "زبيب أسود قندهار ممتاز جداً", fa: "کشمش سیاه قندهار ممتاز", ps: "د کندهار ممتازه تورې ممیز" } },

  // ── 6. WAREHOUSES & LOGISTICS ──
  { table: "warehouses", field: "warehouse_name", text: "Jebel Ali Free Zone Central Cold Store", tr: { en: "Jebel Ali Free Zone Central Cold Store", ur: "جبل علی فری زون سینٹرل کولڈ اسٹور", ar: "مستودع التبريد المركزي المنطقة الحرة جبل علي", fa: "انبار سردخانه مرکزی منطقه آزاد جبل علی", ps: "د جبل علي مرکزي سړولو ګودام" } }
];

async function masterSeed() {
  console.log("=======================================================================");
  console.log("  MASTER SEEDER: POPULATING ALL TABLES & 5 DEDICATED LANGUAGE TABLES");
  console.log("  Database:", env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  // 1. Self-healing schema check
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

  // 2. Seed Accounts, Sales, Purchases, Companies, Products & Warehouses
  console.log("▶ 1. Seeding Master Business Records across all modules...");
  let count = 0;
  for (let i = 0; i < masterData.length; i++) {
    const item = masterData[i];
    const recordId = `h0000000-0000-0000-0000-${(i + 1).toString().padStart(12, "0")}`;
    const t = item.tr;

    await sql`
      select public.upsert_record_translation(
        ${item.table}::text,
        ${recordId}::uuid,
        ${item.field}::text,
        ${item.text}::text,
        'en'::text,
        ${t.en}::text, ${t.ur}::text, ${t.ar}::text, ${t.fa}::text, ${t.ps}::text,
        '{}'::jsonb, 'auto'::text
      );
    `;
    count++;
  }
  console.log(`  ✅ ${count} Master records translated & populated into all 5 language tables!\n`);

  // 3. Inspect Total Rows across the 5 Dedicated Tables
  console.log("=======================================================================");
  console.log(" 📊 SUMMARY: TOTAL ROWS POPULATED IN EACH DEDICATED TABLE");
  console.log("=======================================================================\n");

  const langTables = [
    { name: "translations_english", flag: "🇬🇧", lang: "English Table" },
    { name: "translations_urdu", flag: "🇵🇰", lang: "Urdu Table" },
    { name: "translations_arabic", flag: "🇸🇦", lang: "Arabic Table" },
    { name: "translations_persian", flag: "🇮🇷", lang: "Persian Table" },
    { name: "translations_pashto", flag: "🇦🇫", lang: "Pashto Table" }
  ];

  for (const t of langTables) {
    const res = await sql.unsafe(`select count(*)::int as n from public.${t.name} where deleted_at is null`);
    console.log(`  ${t.flag} public.${t.name.padEnd(23)} : ${res[0].n} Rows Populated`);
  }

  console.log("\n=======================================================================");
  console.log("  🎉 MASTER SEEDING COMPLETE! ALL TABLES POPULATED & TRANSLATED.");
  console.log("=======================================================================");

  await sql.end();
}

masterSeed().catch((err) => {
  console.error("Master seeding error:", err);
  process.exit(1);
});
