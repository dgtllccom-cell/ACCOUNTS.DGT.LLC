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
  } catch (e) {
    console.error("Could not read .env.local", e);
  }
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

// Multi-table Seeder Payload
const seedData = [
  // 1. Purchase Orders
  {
    table: "purchase_orders",
    field: "product_name",
    en: "WALNUT KERNEL SIALKOT SUPER 2026",
    ur: "والنٹ کرنل سیالکوٹ سپر 2026",
    ar: "جوز مغز سيالكوت ممتاز 2026",
    fa: "مغز گردو سیالکوت ممتاز 2026",
    ps: "د سیالکوټ ممتاز جوز مغز 2026"
  },
  {
    table: "purchase_orders",
    field: "supplier_name",
    en: "Kabul Wholesalers Dry Fruits Trading Co.",
    ur: "کابل ہول سیلرز ڈرائی فروٹس ٹریڈنگ کمپنی",
    ar: "شركة كابل لتجارة الفواكه الجافة",
    fa: "شرکت تجارت خشکبار کابل",
    ps: "د کابل د وچو میوو سوداګریز شرکت"
  },

  // 2. Companies / Counterparties
  {
    table: "companies",
    field: "name",
    en: "Damaan Global Trading LLC Dubai",
    ur: "دامان گلوبل ٹریڈنگ ایل ایل سی دبئی",
    ar: "شركة ضمان العالمية للتجارة ش.ذ.م.م دبي",
    fa: "شرکت تجارت عمومی دامان دبی",
    ps: "د دامان نړیوال سوداګریز شرکت دبی"
  },
  {
    table: "companies",
    field: "name",
    en: "Al Ras Spices Wholesalers Complex",
    ur: "الراس مصالحہ جات ہول سیلرز کمپلیکس",
    ar: "مجمع الرأس لتجارة التوابل بالجملة",
    fa: "مجتمع عمده فروشی ادویه الراس",
    ps: "د الراس بهاراتو د ټول پلور ټولګه"
  },

  // 3. Customers
  {
    table: "customers",
    field: "customer_name",
    en: "Muhammad Gulistan Food Distributors",
    ur: "محمد گلستان فوڈ ڈسٹری بیوٹرز",
    ar: "موزعو الأغذية محمد جليستان",
    fa: "توزیع کنندگان مواد غذایی محمد گلستان",
    ps: "د محمد ګلستان خوراکي توکو ویشونکي"
  },

  // 4. Products / Inventory
  {
    table: "products",
    field: "product_name",
    en: "PISTACHIO SHELLED EXTRA FINE GRADE A",
    ur: "پستہ شیلڈ ایکسٹرا فائن گریڈ اے",
    ar: "فستق حلبي مقشر ممتاز درجة أ",
    fa: "پسته مغز شده ممتاز درجه یک",
    ps: "د پستې ممتاز مغز درجه الف"
  },
  {
    table: "products",
    field: "product_name",
    en: "GREEN RAISINS KANDAHAR PREMIUM",
    ur: "سبز کشمش قندھار پریمیم",
    ar: "زبيب أخضر قندهار ممتاز",
    fa: "کشمش سبز قندهار ممتاز",
    ps: "د کندهار ممتازه شنې ممیز"
  },

  // 5. Goods Master
  {
    table: "goods",
    field: "goods_name",
    en: "ALMONDS GIRI CALIFORNIA 20/22",
    ur: "بادام گری کیلیفورنیا 20/22",
    ar: "لوز كاليفورنيا ممتاز 20/22",
    fa: "بادام کالیفرنیا ممتاز 20/22",
    ps: "د کالیفورنیا بادام 20/22"
  },

  // 6. Chart of Accounts & Ledgers
  {
    table: "accounts",
    field: "name",
    en: "Dubai Main Branch Cash Account",
    ur: "دبئی مین برانچ کیش اکاؤنٹ",
    ar: "حساب النقد فرع دبي الرئيسي",
    fa: "حساب صندوق شعبه اصلی دبی",
    ps: "د دبي مرکزي څانګې نقدي حساب"
  },
  {
    table: "ledgers",
    field: "name",
    en: "Import Purchase Ledger Account (DR)",
    ur: "امپورٹ پرچیز لیجر اکاؤنٹ (ڈی آر)",
    ar: "حساب دفتر المبيعات والاستيراد",
    fa: "حساب دفتر کل خرید واردات",
    ps: "د وارداتو پیرود لیجر حساب"
  },

  // 7. Warehouses
  {
    table: "warehouses",
    field: "warehouse_name",
    en: "Al Aweer Central Cold Storage Warehouse",
    ur: "العویر سینٹرل کولڈ اسٹوریج ویئر ہاؤس",
    ar: "مستودع التبريد المركزي العوير",
    fa: "انبار سردخانه مرکزی العویر",
    ps: "د العویر د سړولو مرکزي ګودام"
  },

  // 8. Locations / Countries / Ports
  {
    table: "countries",
    field: "name",
    en: "United Arab Emirates",
    ur: "متحدہ عرب امارات",
    ar: "الإمارات العربية المتحدة",
    fa: "امارات متحده عربی",
    ps: "د متحدو عربي اماراتو"
  },
  {
    table: "ports",
    field: "port_name",
    en: "Jebel Ali Port Terminal 2 Dubai",
    ur: "جبل علی پورٹ ٹرمینل 2 دبئی",
    ar: "ميناء جبل علي المحطة 2 دبي",
    fa: "بندر جبل علی ترمینال 2 دبی",
    ps: "د جبل علي بندر ټرمینل 2 دبي"
  },

  // 9. Shipping Lines
  {
    table: "shipping_line_records",
    field: "shipping_line_name",
    en: "Maersk Container Shipping Line",
    ur: "میرسک کنٹینر شپنگ لائن",
    ar: "خط ميرسك لشحن الحاويات",
    fa: "خط کشتیرانی کانتینری مرسک",
    ps: "د مایرسک کانټینر لیږدونکې کرښه"
  },

  // 10. Expenses Bills
  {
    table: "expenses_bills",
    field: "bill_title",
    en: "Port Clearance & Customs Duty Fee Bill",
    ur: "پورٹ کلئیرنس اور کسٹم ڈیوٹی فیس بل",
    ar: "فاتورة التخليص الجمركي والرسوم",
    fa: "صورتحساب ترخیص گمرکی و عوارض",
    ps: "د ګمرکي تصفیې او مالیې بل"
  }
];

async function seed() {
  console.log("=======================================================================");
  console.log("  SEEDING DUMMY DATA ACROSS ALL BUSINESS TABLES & 5 LANGUAGE TABLES");
  console.log("  Database:", env.NEXT_PUBLIC_SUPABASE_URL || "Supabase Dev");
  console.log("=======================================================================\n");

  for (let i = 0; i < seedData.length; i++) {
    const item = seedData[i];
    const recordId = `f0000000-0000-0000-0000-${(i + 1).toString().padStart(12, "0")}`;

    console.log(`[${i + 1}/${seedData.length}] Seeding Table: "${item.table}" | Field: "${item.field}"`);
    console.log(`  🇬🇧 EN: ${item.en}`);

    // Call upsert_record_translation RPC to generate 5 dedicated table rows
    await sql`
      select public.upsert_record_translation(
        ${item.table}::text,
        ${recordId}::uuid,
        ${item.field}::text,
        ${item.en}::text,
        'en'::text,
        ${item.en}::text,
        ${item.ur}::text,
        ${item.ar}::text,
        ${item.fa}::text,
        ${item.ps}::text,
        '{}'::jsonb,
        'auto'::text
      );
    `;

    console.log(`  ✅ Inserted into 5 language tables (EN, UR, AR, FA, PS)\n`);
  }

  console.log("=======================================================================");
  console.log(" 📊 SUMMARY: ROWS CREATED ACROSS ALL 5 DEDICATED TABLES");
  console.log("=======================================================================\n");

  const tables = [
    { name: "translations_english", flag: "🇬🇧", lang: "English Table" },
    { name: "translations_urdu", flag: "🇵🇰", lang: "Urdu Table" },
    { name: "translations_arabic", flag: "🇸🇦", lang: "Arabic Table" },
    { name: "translations_persian", flag: "🇮🇷", lang: "Persian Table" },
    { name: "translations_pashto", flag: "🇦🇫", lang: "Pashto Table" }
  ];

  for (const t of tables) {
    const countRes = await sql.unsafe(`select count(*)::int as n from public.${t.name} where deleted_at is null`);
    console.log(`  ${t.flag} public.${t.name.padEnd(23)} : ${countRes[0].n} Total Active Rows`);
  }

  console.log("\n=======================================================================");
  console.log("  SEEDING COMPLETE! ALL TABLES POPULATED WITH 5-LANGUAGE DUMMY DATA.");
  console.log("=======================================================================");

  await sql.end();
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
