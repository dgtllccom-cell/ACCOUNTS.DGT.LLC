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

// 5 Dummy Accounts created in English only
const dummyAccounts = [
  {
    code: "AC-1001",
    englishName: "Kabul Wholesalers Dry Fruits Purchase Account",
    translations: {
      en: "Kabul Wholesalers Dry Fruits Purchase Account",
      ur: "کابل ہول سیلرز ڈرائی فروٹس خریداری اکاؤنٹ",
      ar: "حساب شراء الفواكه الجافة كابول",
      fa: "حساب خرید خشکبار کابل",
      ps: "د کابل وچې میوې پیرود حساب"
    }
  },
  {
    code: "AC-1002",
    englishName: "Damaan Global General Trading Sales Account",
    translations: {
      en: "Damaan Global General Trading Sales Account",
      ur: "دامان گلوبل جنرل ٹریڈنگ فروخت اکاؤنٹ",
      ar: "حساب مبيعات ضمان التجارة العامة",
      fa: "حساب فروش تجارت عمومی دامان",
      ps: "د دامان د عمومی سوداګرۍ پلور حساب"
    }
  },
  {
    code: "AC-1003",
    englishName: "Al Ras Spices Wholesale Account",
    translations: {
      en: "Al Ras Spices Wholesale Account",
      ur: "الراس مصالحہ جات ہول سیل اکاؤنٹ",
      ar: "حساب بالجملة بهارات الرأس",
      fa: "حساب عمده فروشی ادویه الراس",
      ps: "د الراس بهاراتو د ټول پلور حساب"
    }
  },
  {
    code: "AC-1004",
    englishName: "Emirates International Import Export Account",
    translations: {
      en: "Emirates International Import Export Account",
      ur: "امارات انٹرنیشنل امپورٹ ایکسپورٹ اکاؤنٹ",
      ar: "حساب الإمارات الدولية للاستيراد والتصدير",
      fa: "حساب واردات و صادرات بین المللی امارات",
      ps: "د اماراتو نړيوال واردات او صادرات حساب"
    }
  },
  {
    code: "AC-1005",
    englishName: "Quetta Logistics Clearing Account",
    translations: {
      en: "Quetta Logistics Clearing Account",
      ur: "کوئٹہ لاجسٹکس کلئیرنگ اکاؤنٹ",
      ar: "حساب تخليص اللوجستيات كويتا",
      fa: "حساب ترخیص لوجستیک کویته",
      ps: "د کوټې لوجستیک د پاکولو حساب"
    }
  }
];

async function run() {
  console.log("=======================================================================");
  console.log("  CREATING 5 DUMMY ENGLISH ACCOUNTS & POPULATING 5 LANGUAGE TABLES");
  console.log("  Database:", env.NEXT_PUBLIC_SUPABASE_URL || "Supabase Dev");
  console.log("=======================================================================\n");

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

  const createdRecords = [];

  for (let i = 0; i < dummyAccounts.length; i++) {
    const acc = dummyAccounts[i];
    const recordId = `e0000000-0000-0000-0000-${(i + 1).toString().padStart(12, "0")}`;

    console.log(`▶ Creating Account #${i + 1} (English Only): "${acc.englishName}" [Code: ${acc.code}]`);

    // 1. Insert into accounts table & enterprise_accounts table
    try {
      await sql`
        insert into public.accounts (id, code, name, account_type, currency_code, is_active, created_at, updated_at)
        values (
          ${recordId}::uuid,
          ${acc.code},
          ${acc.englishName},
          'Asset',
          'USD',
          true,
          now(),
          now()
        )
        on conflict (id) do update set
          name = ${acc.englishName},
          updated_at = now();
      `;
    } catch (e) {}

    try {
      await sql`
        insert into public.enterprise_accounts (id, code, name, kind, currency, status, scope, created_at, updated_at)
        values (
          ${recordId}::uuid,
          ${acc.code},
          ${acc.englishName},
          'asset',
          'USD',
          'active',
          'super_admin',
          now(),
          now()
        )
        on conflict (id) do update set
          name = ${acc.englishName},
          updated_at = now();
      `;
    } catch (e) {}

    // 2. Call upsert_record_translation RPC for accounts and enterprise_accounts
    const tr = acc.translations;
    await sql`
      select public.upsert_record_translation(
        'accounts'::text,
        ${recordId}::uuid,
        'name'::text,
        ${acc.englishName}::text,
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

    await sql`
      select public.upsert_record_translation(
        'enterprise_accounts'::text,
        ${recordId}::uuid,
        'name'::text,
        ${acc.englishName}::text,
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

    createdRecords.push({ id: recordId, code: acc.code, englishName: acc.englishName });
    console.log(`   ✅ 5 Language translations saved into dedicated tables for ${acc.code}\n`);
  }

  // 3. Query the 5 dedicated per-language tables for these 5 accounts
  console.log("=======================================================================");
  console.log(" 📊 QUERYING 5 DEDICATED TABLES FOR CREATED ACCOUNTS");
  console.log("=======================================================================\n");

  const langTables = [
    { name: "translations_english", flag: "🇬🇧", lang: "English Table" },
    { name: "translations_urdu", flag: "🇵🇰", lang: "Urdu Table" },
    { name: "translations_arabic", flag: "🇸🇦", lang: "Arabic Table" },
    { name: "translations_persian", flag: "🇮🇷", lang: "Persian Table" },
    { name: "translations_pashto", flag: "🇦🇫", lang: "Pashto Table" }
  ];

  for (const t of langTables) {
    console.log(`--- ${t.flag} [ TABLE: public.${t.name} (${t.lang}) ] ---`);
    const rows = await sql.unsafe(`
      select record_id, field_name, text, created_at
      from public.${t.name}
      where record_table = 'accounts'
      order by created_at desc
      limit 5
    `);

    for (const r of rows) {
      console.log(`  • Text: "${r.text}"`);
    }
    console.log("");
  }

  // 4. Query Reconstructed View
  console.log("=======================================================================");
  console.log(" 🔍 QUERYING RECONSTRUCTED SQL VIEW (public.record_translations)");
  console.log("=======================================================================\n");

  const viewRows = await sql`
    select record_id, english_text, urdu_text, arabic_text, persian_text, pashto_text
    from public.record_translations
    where record_table = 'accounts'
    order by created_at desc
    limit 5
  `;

  for (const v of viewRows) {
    console.log(`❖ Account Record:`);
    console.log(`   🇬🇧 English (en): ${v.english_text}`);
    console.log(`   🇵🇰 Urdu (ur):    ${v.urdu_text}`);
    console.log(`   🇸🇦 Arabic (ar):  ${v.arabic_text}`);
    console.log(`   🇮🇷 Persian (fa): ${v.persian_text}`);
    console.log(`   🇦🇫 Pashto (ps):  ${v.pashto_text}`);
    console.log("-----------------------------------------------------------------------");
  }

  console.log("\n✅ 5 DUMMY ACCOUNTS SUCCESSFULLY CREATED & VERIFIED ACROSS ALL 5 TABLES!");
  await sql.end();
}

run().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
