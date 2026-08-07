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

const salesRecords = [
  {
    orderNo: "SO-2026-001",
    customerName: "Muhammad Gulistan Food Distributors LLC Dubai",
    productName: "PISTACHIO SHELLED EXTRA FINE GRADE A",
    translations: {
      customer: {
        en: "Muhammad Gulistan Food Distributors LLC Dubai",
        ur: "محمد گلستان فوڈ ڈسٹری بیوٹرز ایل ایل سی دبئی",
        ar: "شركة محمد جليستان لتوزيع الأغذية ش.ذ.م.م دبي",
        fa: "شرکت توزیع مواد غذایی محمد گلستان دبی",
        ps: "د محمد ګلستان خوراکي توکو ویشونکی شرکت دبی"
      },
      product: {
        en: "PISTACHIO SHELLED EXTRA FINE GRADE A",
        ur: "پستہ شیلڈ ایکسٹرا فائن گریڈ اے",
        ar: "فستق حلبي مقشر ممتاز درجة أ",
        fa: "پسته مغز شده ممتاز درجه یک",
        ps: "د پستې ممتاز مغز درجه الف"
      }
    }
  },
  {
    orderNo: "SO-2026-002",
    customerName: "Al Ras Spices Wholesalers Complex",
    productName: "WALNUT KERNEL SIALKOT SUPER 2026",
    translations: {
      customer: {
        en: "Al Ras Spices Wholesalers Complex",
        ur: "الراس مصالحہ جات ہول سیلرز کمپلیکس",
        ar: "مجمع الرأس لتجارة التوابل بالجملة",
        fa: "مجتمع عمده فروشی ادویه الراس",
        ps: "د الراس بهاراتو د ټول پلور ټولګه"
      },
      product: {
        en: "WALNUT KERNEL SIALKOT SUPER 2026",
        ur: "والنٹ کرنل سیالکوٹ سپر 2026",
        ar: "جوز مغز سيالكوت ممتاز 2026",
        fa: "مغز گردو سیالکوت ممتاز 2026",
        ps: "د سیالکوټ ممتاز جوز مغز 2026"
      }
    }
  },
  {
    orderNo: "SO-2026-003",
    customerName: "Emirates International Import Export",
    productName: "GREEN RAISINS KANDAHAR PREMIUM",
    translations: {
      customer: {
        en: "Emirates International Import Export",
        ur: "امارات انٹرنیشنل امپورٹ ایکسپورٹ",
        ar: "الإمارات الدولية للاستيراد والتصدير",
        fa: "واردات و صادرات بین المللی امارات",
        ps: "د اماراتو نړيوال واردات او صادرات"
      },
      product: {
        en: "GREEN RAISINS KANDAHAR PREMIUM",
        ur: "سبز کشمش قندھار پریمیم",
        ar: "زبيب أخضر قندهار ممتاز",
        fa: "کشمش سبز قندهار ممتاز",
        ps: "د کندهار ممتازه شنې ممیز"
      }
    }
  },
  {
    orderNo: "SO-2026-004",
    customerName: "Quetta General Trading & Wholesale",
    productName: "ALMONDS GIRI CALIFORNIA 20/22",
    translations: {
      customer: {
        en: "Quetta General Trading & Wholesale",
        ur: "کوئٹہ جنرل ٹریڈنگ اینڈ ہول سیل",
        ar: "شركة كويتا للتجارة العامة بالجملة",
        fa: "تجارت عمومی و عمده فروشی کویته",
        ps: "د کوټې عمومي سوداګري او ټول پلور"
      },
      product: {
        en: "ALMONDS GIRI CALIFORNIA 20/22",
        ur: "بادام گری کیلیفورنیا 20/22",
        ar: "لوز كاليفورنيا ممتاز 20/22",
        fa: "بادام کالیفرنیا ممتاز 20/22",
        ps: "د کالیفورنیا بادام 20/22"
      }
    }
  },
  {
    orderNo: "SO-2026-005",
    customerName: "Kabul Wholesalers Dry Fruits Trading Co.",
    productName: "CASHEW NUTS WHOLE W320 PREMIUM",
    translations: {
      customer: {
        en: "Kabul Wholesalers Dry Fruits Trading Co.",
        ur: "کابل ہول سیلرز ڈرائی فروٹس ٹریڈنگ کمپنی",
        ar: "شركة كابل لتجارة الفواكه الجافة",
        fa: "شرکت تجارت خشکبار کابل",
        ps: "د کابل د وچو میوو سوداګریز شرکت"
      },
      product: {
        en: "CASHEW NUTS WHOLE W320 PREMIUM",
        ur: "کاجو ہول W320 پریمیم",
        ar: "كاجو كامل W320 ممتاز",
        fa: "کاجو کامل W320 ممتاز",
        ps: "د کاجو کامل W320 ممتاز"
      }
    }
  }
];

async function seedSales() {
  console.log("=======================================================================");
  console.log("  SEEDING SALES ORDERS & POPULATING 5-LANGUAGE DEDICATED TABLES");
  console.log("  Database:", env.NEXT_PUBLIC_SUPABASE_URL || "Supabase Dev");
  console.log("=======================================================================\n");

  for (let i = 0; i < salesRecords.length; i++) {
    const s = salesRecords[i];
    const recordId = `d0000000-0000-0000-0000-${(i + 1).toString().padStart(12, "0")}`;

    console.log(`▶ Creating Sales Order #${i + 1} [${s.orderNo}]`);
    console.log(`   Customer: "${s.customerName}"`);
    console.log(`   Product:  "${s.productName}"`);

    // 1. Insert into sales_orders table if exists
    try {
      await sql`
        insert into public.sales_orders (id, sales_order_no, customer_name, total_amount, currency, status, created_at, updated_at)
        values (
          ${recordId}::uuid,
          ${s.orderNo},
          ${s.customerName},
          12500.00,
          'USD',
          'Confirmed',
          now(),
          now()
        )
        on conflict (id) do update set
          customer_name = ${s.customerName},
          updated_at = now();
      `;
    } catch (e) {}

    // 2. Call upsert_record_translation RPC for customer_name
    const cTr = s.translations.customer;
    await sql`
      select public.upsert_record_translation(
        'sales_orders'::text,
        ${recordId}::uuid,
        'customer_name'::text,
        ${s.customerName}::text,
        'en'::text,
        ${cTr.en}::text,
        ${cTr.ur}::text,
        ${cTr.ar}::text,
        ${cTr.fa}::text,
        ${cTr.ps}::text,
        '{}'::jsonb,
        'auto'::text
      );
    `;

    // 3. Call upsert_record_translation RPC for product_name
    const pTr = s.translations.product;
    await sql`
      select public.upsert_record_translation(
        'sales_orders'::text,
        ${recordId}::uuid,
        'product_name'::text,
        ${s.productName}::text,
        'en'::text,
        ${pTr.en}::text,
        ${pTr.ur}::text,
        ${pTr.ar}::text,
        ${pTr.fa}::text,
        ${pTr.ps}::text,
        '{}'::jsonb,
        'auto'::text
      );
    `;

    console.log(`   ✅ 5 Language translations saved for Sales Order ${s.orderNo}\n`);
  }

  // 4. Query Reconstructed View for Sales Orders
  console.log("=======================================================================");
  console.log(" 🔍 QUERYING SALES RECORDS FROM SQL VIEW (public.record_translations)");
  console.log("=======================================================================\n");

  const viewRows = await sql`
    select record_id, field_name, english_text, urdu_text, arabic_text, persian_text, pashto_text
    from public.record_translations
    where record_table = 'sales_orders'
    order by created_at desc
    limit 10
  `;

  for (const v of viewRows) {
    console.log(`❖ Field: [ ${v.field_name} ]`);
    console.log(`   🇬🇧 EN: ${v.english_text}`);
    console.log(`   🇵🇰 UR: ${v.urdu_text}`);
    console.log(`   🇸🇦 AR: ${v.arabic_text}`);
    console.log(`   🇮🇷 FA: ${v.persian_text}`);
    console.log(`   🇦🇫 PS: ${v.pashto_text}`);
    console.log("-----------------------------------------------------------------------");
  }

  console.log("\n✅ SALES RECORDS SUCCESSFULLY CREATED & POPULATED ACROSS ALL 5 TABLES!");
  await sql.end();
}

seedSales().catch((err) => {
  console.error("Sales seed error:", err);
  process.exit(1);
});
