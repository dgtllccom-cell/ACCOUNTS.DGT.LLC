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
const sql = postgres(dbUrl);

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

async function syncTranslations(tableName, recordId, fieldName, nameMap) {
  for (const lang of LANGUAGES) {
    const text = nameMap[lang] || nameMap["en"] || "";
    const transTable = `${tableName}_${lang}`;
    try {
      await sql`DELETE FROM ${sql(transTable)} WHERE record_id = ${recordId} AND field_name = ${fieldName};`;
      await sql`
        INSERT INTO ${sql(transTable)} (
          record_id, field_name, translated_text, original_text, original_language_code, source, translation_status, translated_by_engine, created_at, updated_at
        )
        VALUES (
          ${recordId}, ${fieldName}, ${text}, ${nameMap["en"]}, 'en', 'human_verified', 'completed', 'manual_seed', NOW(), NOW()
        );
      `;
    } catch (e) {
      // ignore
    }
  }
}

async function run() {
  console.log("=== Starting 5-Country & Branch Standardization ===");

  // 1. Soft-delete / deactivate all non-5 countries
  await sql`
    UPDATE countries 
    SET deleted_at = NOW(), is_active = false
    WHERE upper(iso2) NOT IN ('AE', 'PK', 'AF', 'IN', 'IR') OR iso2 IS NULL;
  `;

  await sql`
    UPDATE countries 
    SET deleted_at = NULL, is_active = true
    WHERE upper(iso2) IN ('AE', 'PK', 'AF', 'IN', 'IR');
  `;

  const countries = await sql`SELECT id, name, iso2 FROM countries WHERE deleted_at IS NULL;`;
  console.log("Active Countries:", countries.map(c => `${c.name} (${c.iso2})`));

  const countryMap = {};
  for (const c of countries) {
    countryMap[c.iso2.toUpperCase()] = c.id;
    if (TRANSLATIONS.countries[c.name]) {
      await syncTranslations("countries", c.id, "name", TRANSLATIONS.countries[c.name]);
    }
  }

  // 2. Main Country Branches
  const DESIRED_MAIN_BRANCHES = [
    { countryIso: 'AE', name: 'United Arab Emirates Main Branch', code: 'ARE-MAIN-001', currency: 'AED' },
    { countryIso: 'PK', name: 'Pakistan Main Branch', code: 'PAK-MAIN-001', currency: 'PKR' },
    { countryIso: 'AF', name: 'Afghanistan Main Branch', code: 'AFG-MAIN-001', currency: 'AFN' },
    { countryIso: 'IN', name: 'India Main Branch', code: 'IND-MAIN-001', currency: 'INR' },
    { countryIso: 'IR', name: 'Iran Main Branch', code: 'IRN-MAIN-001', currency: 'IRR' }
  ];

  const countryBranchMap = {};

  for (const mb of DESIRED_MAIN_BRANCHES) {
    const cId = countryMap[mb.countryIso];
    if (!cId) continue;

    let [existing] = await sql`
      SELECT id FROM country_branches 
      WHERE country_id = ${cId}
      ORDER BY (CASE WHEN upper(code) = ${mb.code} THEN 1 WHEN is_main = true THEN 2 ELSE 3 END)
      LIMIT 1;
    `;

    if (existing) {
      await sql`
        UPDATE country_branches 
        SET country_id = ${cId}, name = ${mb.name}, code = ${mb.code}, local_currency = ${mb.currency}, is_main = true, deleted_at = NULL, status = 'active', updated_at = NOW()
        WHERE id = ${existing.id};
      `;
      countryBranchMap[mb.countryIso] = existing.id;
    } else {
      const [inserted] = await sql`
        INSERT INTO country_branches (country_id, name, code, local_currency, is_main, status, created_at, updated_at)
        VALUES (${cId}, ${mb.name}, ${mb.code}, ${mb.currency}, true, 'active', NOW(), NOW())
        RETURNING id;
      `;
      countryBranchMap[mb.countryIso] = inserted.id;
    }

    if (TRANSLATIONS.country_branches[mb.name]) {
      await syncTranslations("country_branches", countryBranchMap[mb.countryIso], "name", TRANSLATIONS.country_branches[mb.name]);
    }
  }

  // Soft-delete extra country branches
  const validCountryBranchIds = Object.values(countryBranchMap);
  await sql`
    UPDATE country_branches 
    SET deleted_at = NOW(), status = 'inactive'
    WHERE id NOT IN ${sql(validCountryBranchIds)};
  `;

  console.log("Country Main Branches configured:", countryBranchMap);

  // 3. City (Business) Branches
  // UAE: 1 (Dubai)
  // Pakistan: 2 (Quetta, Chaman)
  // Afghanistan: 1 (Kabul)
  // Iran: 1 (Tehran)
  // India: 1 (Mumbai / Vashi Mandi)
  const DESIRED_CITY_BRANCHES = [
    { countryIso: 'AE', name: 'Deira Dubai City Branch', code: 'UAE-DEI-001', cityName: 'Dubai', currency: 'AED' },
    { countryIso: 'PK', name: 'Quetta City Branch', code: 'PAK-QUE-001', cityName: 'Quetta', currency: 'PKR' },
    { countryIso: 'PK', name: 'Chaman City Branch', code: 'PAK-CHM-001', cityName: 'Chaman', currency: 'PKR' },
    { countryIso: 'AF', name: 'Kabul City Branch', code: 'AFG-KBL-001', cityName: 'Kabul', currency: 'AFN' },
    { countryIso: 'IR', name: 'Tehran City Branch', code: 'IRN-THR-001', cityName: 'Tehran', currency: 'IRR' },
    { countryIso: 'IN', name: 'Mumbai Vashi Mandi Branch', code: 'IND-BOM-001', cityName: 'Mumbai', currency: 'INR' }
  ];

  const cityBranchMap = {};

  for (const cb of DESIRED_CITY_BRANCHES) {
    const cId = countryMap[cb.countryIso];
    const cbId = countryBranchMap[cb.countryIso];
    if (!cId || !cbId) continue;

    // First find any existing branch in this country that matches either code or cityName
    let [existing] = await sql`
      SELECT id FROM city_branches 
      WHERE country_id = ${cId} AND (upper(code) = ${cb.code} OR upper(city_name) = ${cb.cityName.toUpperCase()})
      LIMIT 1;
    `;

    if (!existing) {
      // Try global code match
      [existing] = await sql`
        SELECT id FROM city_branches 
        WHERE upper(code) = ${cb.code}
        LIMIT 1;
      `;
    }

    if (existing) {
      await sql`
        UPDATE city_branches 
        SET country_id = ${cId}, country_branch_id = ${cbId}, name = ${cb.name}, code = ${cb.code}, city_name = ${cb.cityName}, local_currency = ${cb.currency}, deleted_at = NULL, status = 'active', updated_at = NOW()
        WHERE id = ${existing.id};
      `;
      cityBranchMap[cb.code] = existing.id;
    } else {
      const [inserted] = await sql`
        INSERT INTO city_branches (country_id, country_branch_id, name, code, city_name, local_currency, status, created_at, updated_at)
        VALUES (${cId}, ${cbId}, ${cb.name}, ${cb.code}, ${cb.cityName}, ${cb.currency}, 'active', NOW(), NOW())
        RETURNING id;
      `;
      cityBranchMap[cb.code] = inserted.id;
    }

    if (TRANSLATIONS.city_branches[cb.name]) {
      await syncTranslations("city_branches", cityBranchMap[cb.code], "name", TRANSLATIONS.city_branches[cb.name]);
    }
  }

  // Soft delete all other city branches
  const validCityBranchIds = Object.values(cityBranchMap);
  await sql`
    UPDATE city_branches 
    SET deleted_at = NOW(), status = 'inactive'
    WHERE id NOT IN ${sql(validCityBranchIds)};
  `;

  console.log("City (Business) Branches configured:", cityBranchMap);

  // 4. Clearing Agent & Clearing Agent Branches
  let [primaryAgent] = await sql`
    SELECT id FROM clearing_agents 
    WHERE name ILIKE '%DGT CLEARING%' OR name ILIKE '%CLEARING%'
    LIMIT 1;
  `;

  if (!primaryAgent) {
    const [insertedAgent] = await sql`
      INSERT INTO clearing_agents (name, code, head_office_country_id, status, created_at, updated_at)
      VALUES ('DGT CLEARING & FORWARDING SERVICES', 'CA-DGT-001', ${countryMap['AE']}, 'active', NOW(), NOW())
      RETURNING id;
    `;
    primaryAgent = insertedAgent;
  }

  const DESIRED_CA_BRANCHES = [
    {
      countryIso: 'AE',
      name: 'Dubai Port Clearing Agent Branch',
      code: 'CA-AE-DXB-01',
      cityBranchCode: 'UAE-DEI-001',
      level: 'city_branch'
    },
    {
      countryIso: 'PK',
      name: 'Chaman Clearing Agent Branch',
      code: 'CA-PK-CHM-01',
      cityBranchCode: 'PAK-CHM-001',
      level: 'city_branch'
    },
    {
      countryIso: 'AF',
      name: 'Nimruz Clearing Agent Branch',
      code: 'CA-AF-NMR-01',
      cityBranchCode: 'AFG-KBL-001',
      level: 'country_branch'
    },
    {
      countryIso: 'IR',
      name: 'Bandar Abbas Clearing Agent Branch',
      code: 'CA-IR-BND-01',
      cityBranchCode: 'IRN-THR-001',
      level: 'country_branch'
    }
  ];

  const caBranchMap = {};

  for (const cab of DESIRED_CA_BRANCHES) {
    const cId = countryMap[cab.countryIso];
    const cbId = countryBranchMap[cab.countryIso];
    const cityBId = cityBranchMap[cab.cityBranchCode];

    let [existing] = await sql`
      SELECT id FROM clearing_agent_branches 
      WHERE upper(code) = ${cab.code} OR (country_id = ${cId} AND upper(name) = ${cab.name.toUpperCase()})
      LIMIT 1;
    `;

    if (existing) {
      await sql`
        UPDATE clearing_agent_branches 
        SET clearing_agent_id = ${primaryAgent.id}, name = ${cab.name}, code = ${cab.code}, branch_level = ${cab.level}, country_id = ${cId}, country_branch_id = ${cbId}, city_branch_id = ${cab.level === 'city_branch' ? cityBId : null}, status = 'active', deleted_at = NULL, updated_at = NOW()
        WHERE id = ${existing.id};
      `;
      caBranchMap[cab.code] = existing.id;
    } else {
      const [inserted] = await sql`
        INSERT INTO clearing_agent_branches (clearing_agent_id, name, code, branch_level, country_id, country_branch_id, city_branch_id, status, created_at, updated_at)
        VALUES (${primaryAgent.id}, ${cab.name}, ${cab.code}, ${cab.level}, ${cId}, ${cbId}, ${cab.level === 'city_branch' ? cityBId : null}, 'active', NOW(), NOW())
        RETURNING id;
      `;
      caBranchMap[cab.code] = inserted.id;
    }

    if (TRANSLATIONS.clearing_agent_branches[cab.name]) {
      await syncTranslations("clearing_agent_branches", caBranchMap[cab.code], "name", TRANSLATIONS.clearing_agent_branches[cab.name]);
    }
  }

  const validCaBranchIds = Object.values(caBranchMap);
  await sql`
    UPDATE clearing_agent_branches 
    SET deleted_at = NOW(), status = 'inactive'
    WHERE id NOT IN ${sql(validCaBranchIds)} AND branch_level != 'head_office';
  `;

  console.log("Clearing Agent Branches configured:", caBranchMap);

  // Print final active verification
  const finalCountries = await sql`SELECT id, name, iso2 FROM countries WHERE deleted_at IS NULL ORDER BY name;`;
  console.log("=== FINAL ACTIVE COUNTRIES ===", finalCountries);

  const finalMain = await sql`SELECT id, name, code, country_id FROM country_branches WHERE deleted_at IS NULL ORDER BY name;`;
  console.log("=== FINAL ACTIVE COUNTRY MAIN BRANCHES ===", finalMain);

  const finalCities = await sql`SELECT id, name, code, city_name, country_id FROM city_branches WHERE deleted_at IS NULL ORDER BY name;`;
  console.log("=== FINAL ACTIVE CITY BRANCHES ===", finalCities);

  const finalCAs = await sql`SELECT id, name, code, country_id, city_branch_id, branch_level FROM clearing_agent_branches WHERE deleted_at IS NULL ORDER BY name;`;
  console.log("=== FINAL ACTIVE CLEARING AGENT BRANCHES ===", finalCAs);

  await sql.end();
}

run().catch(console.error);
