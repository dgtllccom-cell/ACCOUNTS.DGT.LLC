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

const locationsData = {
  countries: [
    { name: "Pakistan", iso2: "PK", iso3: "PAK", currency: "PKR", tr: { en: "Pakistan", ur: "پاکستان", ar: "باكستان", fa: "پاکستان", ps: "پاکستان" } },
    { name: "United Arab Emirates", iso2: "AE", iso3: "ARE", currency: "AED", tr: { en: "United Arab Emirates", ur: "متحدہ عرب امارات", ar: "الإمارات العربية المتحدة", fa: "امارات متحده عربی", ps: "د متحدو عربي اماراتو" } },
    { name: "Afghanistan", iso2: "AF", iso3: "AFG", currency: "AFN", tr: { en: "Afghanistan", ur: "افغانستان", ar: "أفغانستان", fa: "افغانستان", ps: "افغانستان" } },
    { name: "Saudi Arabia", iso2: "SA", iso3: "SAU", currency: "SAR", tr: { en: "Saudi Arabia", ur: "سعودی عرب", ar: "المملكة العربية السعودية", fa: "عربستان سعودی", ps: "سعودي عربستان" } },
    { name: "India", iso2: "IN", iso3: "IND", currency: "INR", tr: { en: "India", ur: "بھارت", ar: "الهند", fa: "هند", ps: "هند" } },
    { name: "Iran", iso2: "IR", iso3: "IRN", currency: "IRR", tr: { en: "Iran", ur: "ایران", ar: "إيران", fa: "ایران", ps: "ایران" } },
    { name: "Turkey", iso2: "TR", iso3: "TUR", currency: "TRY", tr: { en: "Turkey", ur: "ترکی", ar: "تركيا", fa: "ترکیه", ps: "ترکیه" } },
    { name: "China", iso2: "CN", iso3: "CHN", currency: "CNY", tr: { en: "China", ur: "چین", ar: "الصين", fa: "چین", ps: "چین" } },
    { name: "United Kingdom", iso2: "GB", iso3: "GBR", currency: "GBP", tr: { en: "United Kingdom", ur: "برطانیہ", ar: "المملكة المتحدة", fa: "بریتانیا", ps: "انګلستان" } },
    { name: "United States", iso2: "US", iso3: "USA", currency: "USD", tr: { en: "United States", ur: "امریکہ", ar: "الولايات المتحدة", fa: "ایالات متحده", ps: "امریکا" } }
  ],
  states: [
    { country: "PK", name: "Balochistan", code: "BAL", tr: { en: "Balochistan", ur: "بلوچستان", ar: "بلوشستان", fa: "بلوچستان", ps: "بلوچستان" } },
    { country: "PK", name: "Sindh", code: "SND", tr: { en: "Sindh", ur: "سندھ", ar: "السند", fa: "سند", ps: "سندھ" } },
    { country: "PK", name: "Punjab", code: "PJB", tr: { en: "Punjab", ur: "پنجاب", ar: "البنجاب", fa: "پنجاب", ps: "پنجاب" } },
    { country: "PK", name: "Khyber Pakhtunkhwa", code: "KPK", tr: { en: "Khyber Pakhtunkhwa", ur: "خیبر پختونخوا", ar: "خيبر بختونخوا", fa: "خیبر پختونخواه", ps: "خيبر پښتونخوا" } },
    { country: "AE", name: "Emirate of Dubai", code: "DXB", tr: { en: "Emirate of Dubai", ur: "امارت دبئی", ar: "إمارة دبي", fa: "امارت دبی", ps: "د دبی امارت" } },
    { country: "AE", name: "Emirate of Abu Dhabi", code: "AUH", tr: { en: "Emirate of Abu Dhabi", ur: "امارت ابوظہبی", ar: "إمارة أبوظبي", fa: "امارت ابوظبی", ps: "د ابوظبی امارت" } },
    { country: "AF", name: "Kabul Province", code: "KBL", tr: { en: "Kabul Province", ur: "صوبہ کابل", ar: "ولاية كابول", fa: "ولایت کابل", ps: "د کابل ولایت" } },
    { country: "AF", name: "Kandahar Province", code: "KDH", tr: { en: "Kandahar Province", ur: "صوبہ قندھار", ar: "ولاية قندهار", fa: "ولایت قندهار", ps: "د کندهار ولایت" } }
  ],
  districts: [
    { name: "Quetta District", code: "QTA-D", tr: { en: "Quetta District", ur: "ضلع کوئٹہ", ar: "منطقة كويتا", fa: "ضلع کویته", ps: "د کوټې ولسوالۍ" } },
    { name: "Chaman District", code: "CHM-D", tr: { en: "Chaman District", ur: "ضلع چمن", ar: "منطقة تشامان", fa: "ضلع چمن", ps: "د چمن ولسوالۍ" } },
    { name: "Karachi Central District", code: "KHI-D", tr: { en: "Karachi Central District", ur: "ضلع کراچی سینٹرل", ar: "منطقة كراتشي المركزية", fa: "ضلع مرکزی کرچی", ps: "د کراچۍ مرکزي ولسوالۍ" } },
    { name: "Lahore District", code: "LHR-D", tr: { en: "Lahore District", ur: "ضلع لاہور", ar: "منطقة لاهور", fa: "ضلع لاهور", ps: "د لاهور ولسوالۍ" } },
    { name: "Dubai Deira District", code: "DRA-D", tr: { en: "Dubai Deira District", ur: "ضلع دیرہ دبئی", ar: "منطقة ديرة دبي", fa: "ضلع دیره دبی", ps: "د دبي دیره ولسوالۍ" } }
  ],
  cities: [
    { name: "Quetta", code: "UET", country: "PK", tr: { en: "Quetta", ur: "کوئٹہ", ar: "كويتا", fa: "کویته", ps: "کوټه" } },
    { name: "Chaman", code: "CHM", country: "PK", tr: { en: "Chaman", ur: "چمن", ar: "تشامان", fa: "چمن", ps: "چمن" } },
    { name: "Karachi", code: "KHI", country: "PK", tr: { en: "Karachi", ur: "کراچی", ar: "كراتشي", fa: "کرچی", ps: "کراچۍ" } },
    { name: "Lahore", code: "LHR", country: "PK", tr: { en: "Lahore", ur: "لاہور", ar: "لاهور", fa: "لاهور", ps: "لاهور" } },
    { name: "Islamabad", code: "ISB", country: "PK", tr: { en: "Islamabad", ur: "اسلام آباد", ar: "إسلام أباد", fa: "اسلام آباد", ps: "اسلام اباد" } },
    { name: "Peshawar", code: "PEW", country: "PK", tr: { en: "Peshawar", ur: "پشاور", ar: "بيشاور", fa: "پیشاور", ps: "پېښور" } },
    { name: "Multan", code: "MUX", country: "PK", tr: { en: "Multan", ur: "ملتان", ar: "ملتان", fa: "ملتان", ps: "ملتان" } },
    { name: "Sialkot", code: "SKT", country: "PK", tr: { en: "Sialkot", ur: "سیالکوٹ", ar: "سيالكوت", fa: "سیالکوت", ps: "سیالکوټ" } },
    { name: "Dubai", code: "DXB", country: "AE", tr: { en: "Dubai", ur: "دبئی", ar: "دبي", fa: "دبی", ps: "دبي" } },
    { name: "Abu Dhabi", code: "AUH", country: "AE", tr: { en: "Abu Dhabi", ur: "ابوظہبی", ar: "أبوظبي", fa: "ابوظبی", ps: "ابوظبي" } },
    { name: "Sharjah", code: "SHJ", country: "AE", tr: { en: "Sharjah", ur: "شارجہ", ar: "الشارقة", fa: "شارجه", ps: "شارجه" } },
    { name: "Ajman", code: "AJM", country: "AE", tr: { en: "Ajman", ur: "عجمان", ar: "عجمان", fa: "عجمان", ps: "عجمان" } },
    { name: "Kabul", code: "KBL", country: "AF", tr: { en: "Kabul", ur: "کابل", ar: "كابول", fa: "کابل", ps: "کابل" } },
    { name: "Kandahar", code: "KDH", country: "AF", tr: { en: "Kandahar", ur: "قندھار", ar: "قندهار", fa: "قندهار", ps: "کندهار" } },
    { name: "Herat", code: "HEA", country: "AF", tr: { en: "Herat", ur: "ہرات", ar: "هرات", fa: "هرات", ps: "هرات" } },
    { name: "Mazar-i-Sharif", code: "MZR", country: "AF", tr: { en: "Mazar-i-Sharif", ur: "مزار شریف", ar: "مزار شريف", fa: "مزار شریف", ps: "مزار شریف" } },
    { name: "Riyadh", code: "RUH", country: "SA", tr: { en: "Riyadh", ur: "ریاض", ar: "الرياض", fa: "ریاض", ps: "ریاض" } },
    { name: "Jeddah", code: "JED", country: "SA", tr: { en: "Jeddah", ur: "جدہ", ar: "جدة", fa: "جده", ps: "جده" } },
    { name: "Mumbai", code: "BOM", country: "IN", tr: { en: "Mumbai", ur: "ممبئی", ar: "بومباي", fa: "بمبئی", ps: "بمبئی" } },
    { name: "New Delhi", code: "DEL", country: "IN", tr: { en: "New Delhi", ur: "نئی دہلی", ar: "نيودلهي", fa: "دهلی نو", ps: "نوی ډیلی" } },
    { name: "Tehran", code: "THR", country: "IR", tr: { en: "Tehran", ur: "تہران", ar: "طهران", fa: "تهران", ps: "تهران" } }
  ]
};

async function populateLocations() {
  console.log("=======================================================================");
  console.log("  POPULATING COUNTIES, STATES, DISTRICTS, CITIES & 5-LANGUAGE TRANSLATIONS");
  console.log("  Database:", env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  const countryMap = new Map();
  const stateMap = new Map();
  const districtMap = new Map();

  // 1. Insert Countries
  console.log("▶ 1. Seeding Countries & Translations...");
  for (const c of locationsData.countries) {
    const res = await sql`
      insert into public.countries (name, iso2, iso3, currency_code, default_language_code, official_email, admin_email)
      values (${c.name}, ${c.iso2}, ${c.iso3}, ${c.currency}, 'en', ${`official@dgt.${c.iso2.toLowerCase()}`}, ${`admin@dgt.${c.iso2.toLowerCase()}`})
      on conflict (id) do nothing
      returning id;
    `;

    let countryId = res[0]?.id;
    if (!countryId) {
      const existing = await sql`select id from public.countries where iso2 = ${c.iso2} limit 1`;
      countryId = existing[0]?.id;
    }

    if (countryId) {
      countryMap.set(c.iso2, countryId);

      // Save 5-language translations for country name
      const t = c.tr;
      await sql`
        select public.upsert_record_translation(
          'countries'::text,
          ${countryId}::uuid,
          'name'::text,
          ${c.name}::text,
          'en'::text,
          ${t.en}::text, ${t.ur}::text, ${t.ar}::text, ${t.fa}::text, ${t.ps}::text,
          '{}'::jsonb, 'auto'::text
        );
      `;
    }
  }
  console.log(`  ✅ ${locationsData.countries.length} Countries inserted and translated!\n`);

  // 2. Insert States / Provinces
  console.log("▶ 2. Seeding States / Provinces & Translations...");
  for (const st of locationsData.states) {
    const cId = countryMap.get(st.country) || null;
    const res = await sql`
      insert into public.states_provinces (country_id, name, code)
      values (${cId}, ${st.name}, ${st.code})
      returning id;
    `;
    const stateId = res[0]?.id;
    if (stateId) {
      stateMap.set(st.name, stateId);

      const t = st.tr;
      await sql`
        select public.upsert_record_translation(
          'states_provinces'::text,
          ${stateId}::uuid,
          'name'::text,
          ${st.name}::text,
          'en'::text,
          ${t.en}::text, ${t.ur}::text, ${t.ar}::text, ${t.fa}::text, ${t.ps}::text,
          '{}'::jsonb, 'auto'::text
        );
      `;
    }
  }
  console.log(`  ✅ ${locationsData.states.length} States / Provinces inserted and translated!\n`);

  // 3. Insert Districts
  console.log("▶ 3. Seeding Districts & Translations...");
  for (const d of locationsData.districts) {
    const res = await sql`
      insert into public.districts (name, code)
      values (${d.name}, ${d.code})
      returning id;
    `;
    const districtId = res[0]?.id;
    if (districtId) {
      districtMap.set(d.name, districtId);

      const t = d.tr;
      await sql`
        select public.upsert_record_translation(
          'districts'::text,
          ${districtId}::uuid,
          'name'::text,
          ${d.name}::text,
          'en'::text,
          ${t.en}::text, ${t.ur}::text, ${t.ar}::text, ${t.fa}::text, ${t.ps}::text,
          '{}'::jsonb, 'auto'::text
        );
      `;
    }
  }
  console.log(`  ✅ ${locationsData.districts.length} Districts inserted and translated!\n`);

  // 4. Insert Cities
  console.log("▶ 4. Seeding Cities & Translations...");
  for (const ct of locationsData.cities) {
    const cId = countryMap.get(ct.country) || null;
    let stId = null;
    if (ct.country === "PK") stId = stateMap.get("Balochistan") || stateMap.get("Punjab") || stateMap.get("Sindh");
    else if (ct.country === "AE") stId = stateMap.get("Emirate of Dubai") || stateMap.get("Emirate of Abu Dhabi");
    else if (ct.country === "AF") stId = stateMap.get("Kabul Province") || stateMap.get("Kandahar Province");

    const res = await sql`
      insert into public.cities (country_id, state_id, state_province_id, name, code)
      values (${cId}, ${stId}, ${stId}, ${ct.name}, ${ct.code})
      returning id;
    `;
    const cityId = res[0]?.id;
    if (cityId) {
      const t = ct.tr;
      await sql`
        select public.upsert_record_translation(
          'cities'::text,
          ${cityId}::uuid,
          'name'::text,
          ${ct.name}::text,
          'en'::text,
          ${t.en}::text, ${t.ur}::text, ${t.ar}::text, ${t.fa}::text, ${t.ps}::text,
          '{}'::jsonb, 'auto'::text
        );
      `;
    }
  }
  console.log(`  ✅ ${locationsData.cities.length} Cities inserted and translated!\n`);

  console.log("=======================================================================");
  console.log("  🎉 ALL COUNTRIES, STATES, DISTRICTS & CITIES POPULATED & TRANSLATED!");
  console.log("=======================================================================");

  await sql.end();
}

populateLocations().catch((err) => {
  console.error("Population error:", err);
  process.exit(1);
});
