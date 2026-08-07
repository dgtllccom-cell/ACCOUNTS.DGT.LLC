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

const branchData = [
  // ── UNITED ARAB EMIRATES ──
  {
    countryIso: "AE",
    countryBranchName: "Dubai Main Branch",
    code: "DXB-MB-01",
    tr: { en: "Dubai Main Branch", ur: "دبئی مین برانچ", ar: "فرع دبي الرئيسي", fa: "شعبه اصلی دبی", ps: "د دبي مرکزي څانګه" },
    cityBranches: [
      { name: "Deira Market City Branch", code: "DXB-CB-01", city: "Dubai", tr: { en: "Deira Market City Branch", ur: "دیرہ مارکیٹ سٹی برانچ", ar: "فرع سوق ديرة دبي", fa: "شعبه بازار دیره دبی", ps: "د دیره مارکیټ څانګه" } },
      { name: "Jebel Ali Free Zone Branch", code: "DXB-CB-02", city: "Dubai", tr: { en: "Jebel Ali Free Zone Branch", ur: "جبل علی فری زون برانچ", ar: "فرع المنطقة الحرة جبل علي", fa: "شعبه منطقه آزاد جبل علی", ps: "د جبل علي سیمې څانګه" } }
    ]
  },
  {
    countryIso: "AE",
    countryBranchName: "Abu Dhabi Central Branch",
    code: "AUH-MB-01",
    tr: { en: "Abu Dhabi Central Branch", ur: "ابوظہبی سینٹرل برانچ", ar: "فرع أبوظبي المركزي", fa: "شعبه مرکزی ابوظبی", ps: "د ابوظبي مرکزي څانګه" },
    cityBranches: [
      { name: "Abu Dhabi Port City Branch", code: "AUH-CB-01", city: "Abu Dhabi", tr: { en: "Abu Dhabi Port City Branch", ur: "ابوظہبی پورٹ سٹی برانچ", ar: "فرع ميناء أبوظبي", fa: "شعبه بندر ابوظبی", ps: "د ابوظبي بندر څانګه" } }
    ]
  },

  // ── PAKISTAN ──
  {
    countryIso: "PK",
    countryBranchName: "Quetta Regional Branch",
    code: "UET-MB-01",
    tr: { en: "Quetta Regional Branch", ur: "کوئٹہ ریجنل برانچ", ar: "فرع كويتا الإقليمي", fa: "شعبه منطقه‌ای کویته", ps: "د کوټې سیمه ایزه څانګه" },
    cityBranches: [
      { name: "Chaman Border Post Branch", code: "CHM-CB-01", city: "Chaman", tr: { en: "Chaman Border Post Branch", ur: "چمن بارڈر پوسٹ برانچ", ar: "فرع منفذ تشامان الحدودي", fa: "شعبه مرزی چمن", ps: "د چمن پولې څانګه" } },
      { name: "Quetta City Center Branch", code: "UET-CB-01", city: "Quetta", tr: { en: "Quetta City Center Branch", ur: "کوئٹہ سٹی سینٹر برانچ", ar: "فرع وسط مدينة كويتا", fa: "شعبه مرکز شهر کویته", ps: "د کوټې ښار مرکزي څانګه" } }
    ]
  },
  {
    countryIso: "PK",
    countryBranchName: "Karachi Port Main Branch",
    code: "KHI-MB-01",
    tr: { en: "Karachi Port Main Branch", ur: "کراچی پورٹ مین برانچ", ar: "فرع ميناء كراتشي الرئيسي", fa: "شعبه اصلی بندر کرچی", ps: "د کراچۍ بندر مرکزي څانګه" },
    cityBranches: [
      { name: "Port Qasim Logistics Branch", code: "KHI-CB-01", city: "Karachi", tr: { en: "Port Qasim Logistics Branch", ur: "پورٹ قاسم لاجسٹکس برانچ", ar: "فرع ميناء قاسم اللوجستي", fa: "شعبه لوجستیک بندر قاسم", ps: "د پورټ قاسم لوجستیک څانګه" } }
    ]
  },

  // ── AFGHANISTAN ──
  {
    countryIso: "AF",
    countryBranchName: "Kabul Central Branch",
    code: "KBL-MB-01",
    tr: { en: "Kabul Central Branch", ur: "کابل سینٹرل برانچ", ar: "فرع كابول المركزي", fa: "شعبه مرکزی کابل", ps: "د کابل مرکزي څانګه" },
    cityBranches: [
      { name: "Kabul Dry Fruits Market Branch", code: "KBL-CB-01", city: "Kabul", tr: { en: "Kabul Dry Fruits Market Branch", ur: "کابل ڈرائی فروٹس مارکیٹ برانچ", ar: "فرع سوق الفواكه الجافة كابول", fa: "شعبه بازار خشکبار کابل", ps: "د کابل وچې میوو مارکیټ څانګه" } }
    ]
  }
];

async function seedBranches() {
  console.log("=======================================================================");
  console.log("  SEEDING COUNTRY BRANCHES & CITY BRANCHES WITH 5-LANGUAGE TRANSLATIONS");
  console.log("  Database:", env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  const countryMap = new Map();
  const countries = await sql`select id, iso2, name from public.countries`;
  for (const c of countries) {
    if (c.iso2) countryMap.set(c.iso2.toUpperCase(), c.id);
  }

  let totalCountryBranches = 0;
  let totalCityBranches = 0;

  for (const item of branchData) {
    const countryId = countryMap.get(item.countryIso);
    if (!countryId) {
      console.log(`⚠️ Country ISO "${item.countryIso}" not found. Skipping "${item.countryBranchName}".`);
      continue;
    }

    // 1. Insert into public.country_branches
    const res = await sql`
      insert into public.country_branches (country_id, name, code, owner_name)
      values (${countryId}, ${item.countryBranchName}, ${item.code}, 'Damaan Management')
      on conflict (id) do update set name = ${item.countryBranchName}
      returning id;
    `;

    const countryBranchId = res[0]?.id;
    if (countryBranchId) {
      totalCountryBranches++;

      // Save 5-language translation for Country Branch
      const t = item.tr;
      await sql`
        select public.upsert_record_translation(
          'country_branches'::text,
          ${countryBranchId}::uuid,
          'name'::text,
          ${item.countryBranchName}::text,
          'en'::text,
          ${t.en}::text, ${t.ur}::text, ${t.ar}::text, ${t.fa}::text, ${t.ps}::text,
          '{}'::jsonb, 'auto'::text
        );
      `;

      // 2. Insert into public.city_branches
      for (const cb of item.cityBranches) {
        const cbRes = await sql`
          insert into public.city_branches (country_id, country_branch_id, name, code, city_name)
          values (${countryId}, ${countryBranchId}, ${cb.name}, ${cb.code}, ${cb.city})
          on conflict (id) do update set name = ${cb.name}
          returning id;
        `;

        const cityBranchId = cbRes[0]?.id;
        if (cityBranchId) {
          totalCityBranches++;

          const cbTr = cb.tr;
          await sql`
            select public.upsert_record_translation(
              'city_branches'::text,
              ${cityBranchId}::uuid,
              'name'::text,
              ${cb.name}::text,
              'en'::text,
              ${cbTr.en}::text, ${cbTr.ur}::text, ${cbTr.ar}::text, ${cbTr.fa}::text, ${cbTr.ps}::text,
              '{}'::jsonb, 'auto'::text
            );
          `;
        }
      }
    }
  }

  console.log(`  ✅ Successfully seeded ${totalCountryBranches} Country Branches!`);
  console.log(`  ✅ Successfully seeded ${totalCityBranches} City Branches!`);

  console.log("\n=======================================================================");
  console.log("  🎉 BRANCHES SEEDED & TRANSLATED SUCCESSFULLY!");
  console.log("=======================================================================");

  await sql.end();
}

seedBranches().catch((err) => {
  console.error("Branch seed error:", err);
  process.exit(1);
});
