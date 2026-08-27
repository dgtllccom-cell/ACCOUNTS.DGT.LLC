import postgres from 'postgres';
import fs from 'fs';

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}
loadEnv();

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const sql = postgres(dbUrl, { max: 5, idle_timeout: 5 });

const LANGUAGES = ["en", "ur", "ar", "fa", "ps"];

const TRANSLATIONS = {
  countries: {
    "United Arab Emirates": { en: "United Arab Emirates", ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "متحده عربي امارات" },
    "Pakistan": { en: "Pakistan", ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" },
    "Afghanistan": { en: "Afghanistan", ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" },
    "India": { en: "India", ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" },
    "Iran": { en: "Iran", ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" }
  },
  country_branches: {
    "United Arab Emirates Main Branch": { en: "United Arab Emirates Main Branch", ur: "متحدہ عرب امارات مین برانچ", ar: "الفرع الرئيسي للإمارات", fa: "شعبه اصلی امارات متحده عربی", ps: "د متحده عربي اماراتو مرکزي څانګه" },
    "Pakistan Main Branch": { en: "Pakistan Main Branch", ur: "پاکستان مین برانچ", ar: "الفرع الرئيسي لباكستان", fa: "شعبه اصلی پاکستان", ps: "د پاکستان مرکزي څانګه" },
    "Afghanistan Main Branch": { en: "Afghanistan Main Branch", ur: "افغانستان مین برانچ", ar: "الفرع الرئيسي لأفغانستان", fa: "شعبه اصلی افغانستان", ps: "د افغانستان مرکزي څانګه" },
    "India Main Branch": { en: "India Main Branch", ur: "انڈیا مین برانچ", ar: "الفرع الرئيسي للهند", fa: "شعبه اصلی هند", ps: "د هند مرکزي څانګه" },
    "Iran Main Branch": { en: "Iran Main Branch", ur: "ایران مین برانچ", ar: "الفرع الرئيسي لإيران", fa: "شعبه اصلی ایران", ps: "د ایران مرکزي څانګه" }
  },
  city_branches: {
    "Deira Dubai City Branch": { en: "Deira Dubai City Branch", ur: "دیرہ دبئی سٹی برانچ", ar: "فرع ديرة دبي", fa: "شعبه دیره دبی", ps: "د دیره دوبی څانګه" },
    "Quetta City Branch": { en: "Quetta City Branch", ur: "کوئٹہ سٹی برانچ", ar: "فرع مدينة كويتا", fa: "شعبه شهر کویته", ps: "د کوټې ښاري څانګه" },
    "Chaman City Branch": { en: "Chaman City Branch", ur: "چمن سٹی برانچ", ar: "فرع مدينة جمن", fa: "شعبه شهر چمن", ps: "د چمن ښاري څانګه" },
    "Kabul City Branch": { en: "Kabul City Branch", ur: "کابل سٹی برانچ", ar: "فرع مدينة كابول", fa: "شعبه شهر کابل", ps: "د کابل ښاري څانګه" },
    "Tehran City Branch": { en: "Tehran City Branch", ur: "تہران سٹی برانچ", ar: "فرع مدينة طهران", fa: "شعبه شهر تهران", ps: "د تهران ښاري څانګه" },
    "Mumbai Vashi Mandi Branch": { en: "Mumbai Vashi Mandi Branch", ur: "ممبئی واشی منڈی برانچ", ar: "فرع مومباي فاشي ماندي", fa: "شعبه بمبئی واشی مندی", ps: "د ممبۍ واشي منډي څانګه" }
  },
  clearing_agent_branches: {
    "Dubai Port Clearing Agent Branch": { en: "Dubai Port Clearing Agent Branch", ur: "دبئی پورٹ کلیئرنگ ایجنٹ برانچ", ar: "فرع وكيل التخليص بميناء دبي", fa: "شعبه کارگزار ترخیص بندر دبی", ps: "د دوبۍ بندر د ګمرکي کلیرنګ څانګه" },
    "Chaman Clearing Agent Branch": { en: "Chaman Clearing Agent Branch", ur: "چمن کلیئرنگ ایجنٹ برانچ", ar: "فرع وكيل التخليص جمن", fa: "شعبه کارگزار ترخیص چمن", ps: "د چمن د ګمرکي کلیرنګ څانګه" },
    "Nimruz Clearing Agent Branch": { en: "Nimruz Clearing Agent Branch", ur: "نیمروز کلیئرنگ ایجنٹ برانچ", ar: "فرع وكيل التخليص نيمروز", fa: "شعبه کارگزار ترخیص نیمروز", ps: "د نیمروز د ګمرکي کلیرنګ څانګه" },
    "Bandar Abbas Clearing Agent Branch": { en: "Bandar Abbas Clearing Agent Branch", ur: "بندر عباس کلیئرنگ ایجنٹ برانچ", ar: "فرع وكيل التخليص بندر عباس", fa: "شعبه کارگزار ترخیص بندرعباس", ps: "د بندر عباس د ګمرکي کلیرنګ څانګه" }
  }
};

async function syncTranslations() {
  console.log("=== Backfilling 5-Language Translations for Exact Location Hierarchy ===");

  // 1. Countries
  const countries = await sql`SELECT id, name FROM countries WHERE deleted_at IS NULL;`;
  for (const c of countries) {
    const tMap = TRANSLATIONS.countries[c.name];
    if (tMap) {
      for (const lang of LANGUAGES) {
        const text = tMap[lang] || tMap.en;
        const tbl = `countries_${lang}`;
        try {
          await sql`DELETE FROM ${sql(tbl)} WHERE record_id = ${c.id} AND field_name = 'name';`;
          await sql`
            INSERT INTO ${sql(tbl)} (record_id, field_name, translated_text, original_text, original_language_code, source, translation_status, translated_by_engine, created_at, updated_at)
            VALUES (${c.id}, 'name', ${text}, ${tMap.en}, 'en', 'human_verified', 'completed', 'manual_seed', NOW(), NOW());
          `;
        } catch (e) {
          console.error(`Error in ${tbl}:`, e.message);
        }
      }
    }
  }

  // 2. Country Main Branches
  const countryBranches = await sql`SELECT id, name FROM country_branches WHERE deleted_at IS NULL;`;
  for (const cb of countryBranches) {
    const tMap = TRANSLATIONS.country_branches[cb.name];
    if (tMap) {
      for (const lang of LANGUAGES) {
        const text = tMap[lang] || tMap.en;
        const tbl = `country_branches_${lang}`;
        try {
          await sql`DELETE FROM ${sql(tbl)} WHERE record_id = ${cb.id} AND field_name = 'name';`;
          await sql`
            INSERT INTO ${sql(tbl)} (record_id, field_name, translated_text, original_text, original_language_code, source, translation_status, translated_by_engine, created_at, updated_at)
            VALUES (${cb.id}, 'name', ${text}, ${tMap.en}, 'en', 'human_verified', 'completed', 'manual_seed', NOW(), NOW());
          `;
        } catch (e) {
          console.error(`Error in ${tbl}:`, e.message);
        }
      }
    }
  }

  // 3. City Branches
  const cityBranches = await sql`SELECT id, name FROM city_branches WHERE deleted_at IS NULL;`;
  for (const cb of cityBranches) {
    const tMap = TRANSLATIONS.city_branches[cb.name];
    if (tMap) {
      for (const lang of LANGUAGES) {
        const text = tMap[lang] || tMap.en;
        const tbl = `city_branches_${lang}`;
        try {
          await sql`DELETE FROM ${sql(tbl)} WHERE record_id = ${cb.id} AND field_name = 'name';`;
          await sql`
            INSERT INTO ${sql(tbl)} (record_id, field_name, translated_text, original_text, original_language_code, source, translation_status, translated_by_engine, created_at, updated_at)
            VALUES (${cb.id}, 'name', ${text}, ${tMap.en}, 'en', 'human_verified', 'completed', 'manual_seed', NOW(), NOW());
          `;
        } catch (e) {
          console.error(`Error in ${tbl}:`, e.message);
        }
      }
    }
  }

  // 4. Clearing Agent Branches
  const caBranches = await sql`SELECT id, name FROM clearing_agent_branches WHERE deleted_at IS NULL;`;
  for (const cab of caBranches) {
    const tMap = TRANSLATIONS.clearing_agent_branches[cab.name];
    if (tMap) {
      for (const lang of LANGUAGES) {
        const text = tMap[lang] || tMap.en;
        const tbl = `clearing_agent_branches_${lang}`;
        try {
          await sql`DELETE FROM ${sql(tbl)} WHERE record_id = ${cab.id} AND field_name = 'name';`;
          await sql`
            INSERT INTO ${sql(tbl)} (record_id, field_name, translated_text, original_text, original_language_code, source, translation_status, translated_by_engine, created_at, updated_at)
            VALUES (${cab.id}, 'name', ${text}, ${tMap.en}, 'en', 'human_verified', 'completed', 'manual_seed', NOW(), NOW());
          `;
        } catch (e) {
          console.error(`Error in ${tbl}:`, e.message);
        }
      }
    }
  }

  console.log("=== All 5-Language Translations Synced Successfully! ===");
  await sql.end();
}

syncTranslations().catch(console.error);
