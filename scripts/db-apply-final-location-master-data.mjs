import postgres from "postgres";
import fs from "fs";
import path from "path";

// 1. Load DATABASE_URL from .env.local
let dbUrl = "";
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    if (line.trim().startsWith("DATABASE_URL=")) {
      dbUrl = line.trim().substring("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

if (!dbUrl) {
  console.error("❌ DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 5 });

async function main() {
  console.log("================================================================================");
  console.log("🌍 LOCATION MANAGEMENT MASTER DATA DEPLOYMENT (SA, UZ, TJ, IR)");
  console.log("================================================================================\n");

  // Verify connected DB
  const [dbInfo] = await sql`SELECT current_database() as db, current_user as usr, inet_server_addr() as host`;
  console.log(`Connected Database: ${dbInfo.db} (User: ${dbInfo.usr}, Host: ${dbInfo.host})\n`);

  // ---------------------------------------------------------------------------
  // STEP 1: UPSERT & MERGE COUNTRIES (Preserving UUIDs & Relationships)
  // ---------------------------------------------------------------------------
  console.log("▶ [Step 1/5] Checking and Standardizing Countries...");

  const targetCountries = [
    {
      name: "Saudi Arabia",
      iso2: "SA",
      iso3: "SAU",
      currency_code: "SAR",
      phone_code: "+966",
      default_language_code: "ar",
      official_email: "official@dgt.sa",
      admin_email: "admin@dgt.sa",
    },
    {
      name: "Uzbekistan",
      iso2: "UZ",
      iso3: "UZB",
      currency_code: "UZS",
      phone_code: "+998",
      default_language_code: "en",
      official_email: "official@dgt.uz",
      admin_email: "admin@dgt.uz",
    },
    {
      name: "Tajikistan",
      iso2: "TJ",
      iso3: "TJK",
      currency_code: "TJS",
      phone_code: "+992",
      default_language_code: "en",
      official_email: "official@dgt.tj",
      admin_email: "admin@dgt.tj",
    },
    {
      name: "Iran",
      iso2: "IR",
      iso3: "IRN",
      currency_code: "IRR",
      phone_code: "+98",
      default_language_code: "fa",
      official_email: "official@dgt.ir",
      admin_email: "admin@dgt.ir",
    },
  ];

  const countryMap = new Map();

  for (const c of targetCountries) {
    const [existing] = await sql`
      SELECT id, name, iso2, iso3, phone_code FROM public.countries
      WHERE iso2 = ${c.iso2} OR iso3 = ${c.iso3} OR name ILIKE ${c.name}
      LIMIT 1;
    `;

    let countryId;
    if (existing) {
      countryId = existing.id;
      await sql`
        UPDATE public.countries
        SET name = ${c.name},
            iso2 = ${c.iso2},
            iso3 = ${c.iso3},
            currency_code = ${c.currency_code},
            phone_code = ${c.phone_code},
            default_language_code = ${c.default_language_code},
            is_active = true,
            deleted_at = NULL,
            updated_at = NOW()
        WHERE id = ${countryId};
      `;
      console.log(`   ✓ Updated Country: ${c.name} (${c.iso2}) [ID: ${countryId}, Phone: ${c.phone_code}]`);
    } else {
      const [inserted] = await sql`
        INSERT INTO public.countries (
          name, iso2, iso3, currency_code, phone_code, default_language_code,
          is_active, official_email, admin_email, created_at, updated_at
        ) VALUES (
          ${c.name}, ${c.iso2}, ${c.iso3}, ${c.currency_code}, ${c.phone_code}, ${c.default_language_code},
          true, ${c.official_email}, ${c.admin_email}, NOW(), NOW()
        ) RETURNING id;
      `;
      countryId = inserted.id;
      console.log(`   ✓ Inserted Country: ${c.name} (${c.iso2}) [ID: ${countryId}, Phone: ${c.phone_code}]`);
    }
    countryMap.set(c.iso2, countryId);
  }

  // ---------------------------------------------------------------------------
  // STEP 2: UPSERT & MERGE STATES / PROVINCES / REGIONS
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Step 2/5] Standardizing States / Provinces / Regions...");

  const targetStates = [
    // Saudi Arabia
    {
      countryIso: "SA",
      name: "Riyadh Region",
      code: "SA-01",
      aliases: ["Riyadh Province", "Riyadh", "SA-01"],
    },
    {
      countryIso: "SA",
      name: "Makkah Region",
      code: "SA-02",
      aliases: ["Makkah Province", "Mecca Province", "Makkah", "SA-02"],
    },

    // Uzbekistan
    {
      countryIso: "UZ",
      name: "Samarqand Region",
      code: "UZ-SA",
      aliases: ["Samarkand Region", "Samarqand", "UZ-SA"],
    },
    {
      countryIso: "UZ",
      name: "Tashkent City / Capital Territory",
      code: "UZ-TK",
      aliases: ["Tashkent Region", "Tashkent City", "Tashkent", "UZ-TO", "UZ-TK"],
    },

    // Tajikistan
    {
      countryIso: "TJ",
      name: "Dushanbe",
      code: "TJ-DU",
      aliases: ["Dushanbe City", "TJ-DU"],
    },
    {
      countryIso: "TJ",
      name: "Sughd",
      code: "TJ-SU",
      aliases: ["Sughd Region", "TJ-SU"],
    },
    {
      countryIso: "TJ",
      name: "Khatlon",
      code: "TJ-KT",
      aliases: ["Khatlon Region", "TJ-KT"],
    },
    {
      countryIso: "TJ",
      name: "Gorno-Badakhshan",
      code: "TJ-GB",
      aliases: ["Gorno-Badakhshan Autonomous Region", "GBAO", "TJ-GB"],
    },
    {
      countryIso: "TJ",
      name: "Districts of Republican Subordination",
      code: "TJ-RA",
      aliases: ["Nohiyahoi Tobei Jumhuri", "TJ-RA"],
    },

    // Iran
    {
      countryIso: "IR",
      name: "Tehran Province",
      code: "IR-23",
      aliases: ["Tehran", "IR-THR", "GN:IR:26", "IR-23"],
    },
    {
      countryIso: "IR",
      name: "Razavi Khorasan Province",
      code: "IR-09",
      aliases: ["Razavi Khorasan", "IR-RKH", "GN:IR:42", "IR-09"],
    },
    {
      countryIso: "IR",
      name: "Hormozgan Province",
      code: "IR-22",
      aliases: ["Hormozgan", "GN:IR:11", "IR-22"],
    },
  ];

  const stateMap = new Map(); // key: `${countryIso}:${code}` -> stateId

  for (const s of targetStates) {
    const countryId = countryMap.get(s.countryIso);
    if (!countryId) continue;

    const [existing] = await sql`
      SELECT id, name, code FROM public.states_provinces
      WHERE country_id = ${countryId}
        AND (
          code = ${s.code}
          OR code = ANY(${s.aliases})
          OR name ILIKE ${s.name}
          OR name = ANY(${s.aliases})
        )
      ORDER BY (code = ${s.code}) DESC, (name = ${s.name}) DESC
      LIMIT 1;
    `;

    let stateId;
    if (existing) {
      stateId = existing.id;
      await sql`
        UPDATE public.states_provinces
        SET name = ${s.name},
            code = ${s.code},
            is_active = true,
            deleted_at = NULL,
            updated_at = NOW()
        WHERE id = ${stateId};
      `;
      console.log(`   ✓ Updated State: ${s.name} (${s.code}) [ID: ${stateId}]`);
    } else {
      const [inserted] = await sql`
        INSERT INTO public.states_provinces (
          country_id, name, code, is_active, created_at, updated_at
        ) VALUES (
          ${countryId}, ${s.name}, ${s.code}, true, NOW(), NOW()
        ) RETURNING id;
      `;
      stateId = inserted.id;
      console.log(`   ✓ Inserted State: ${s.name} (${s.code}) [ID: ${stateId}]`);
    }
    stateMap.set(`${s.countryIso}:${s.code}`, stateId);
  }

  // ---------------------------------------------------------------------------
  // STEP 3: UPSERT CITIES (Tier 3 -> table public.districts)
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Step 3/5] Standardizing Cities (Tier 3: public.districts)...");

  const targetCities = [
    // Saudi Arabia
    { countryIso: "SA", stateCode: "SA-01", name: "Riyadh", code: "SA-01-RUH" },
    { countryIso: "SA", stateCode: "SA-02", name: "Jeddah", code: "SA-02-JED" },

    // Uzbekistan
    { countryIso: "UZ", stateCode: "UZ-SA", name: "Samarkand", code: "UZ-SA-SKD" },
    { countryIso: "UZ", stateCode: "UZ-TK", name: "Tashkent", code: "UZ-TK-TAS" },

    // Tajikistan
    { countryIso: "TJ", stateCode: "TJ-DU", name: "Dushanbe", code: "TJ-DU-DYU" },
    { countryIso: "TJ", stateCode: "TJ-SU", name: "Khujand", code: "TJ-SU-KHJ" },
    { countryIso: "TJ", stateCode: "TJ-KT", name: "Bokhtar", code: "TJ-KT-BOK" },
    { countryIso: "TJ", stateCode: "TJ-GB", name: "Khorugh", code: "TJ-GB-KHO" },
    { countryIso: "TJ", stateCode: "TJ-RA", name: "Vahdat", code: "TJ-RA-VAH" },

    // Iran
    { countryIso: "IR", stateCode: "IR-23", name: "Tehran", code: "IR-23-THR" },
    { countryIso: "IR", stateCode: "IR-09", name: "Mashhad", code: "IR-09-MHD" },
    { countryIso: "IR", stateCode: "IR-22", name: "Bandar Abbas", code: "IR-22-BND" },
  ];

  const cityMap = new Map(); // key: `${countryIso}:${stateCode}:${name}` -> cityDistrictId

  for (const c of targetCities) {
    const countryId = countryMap.get(c.countryIso);
    const stateId = stateMap.get(`${c.countryIso}:${c.stateCode}`);
    if (!countryId || !stateId) continue;

    const [existing] = await sql`
      SELECT id, name, code FROM public.districts
      WHERE country_id = ${countryId}
        AND (state_province_id = ${stateId} OR state_province_id IS NULL)
        AND (name ILIKE ${c.name} OR code = ${c.code})
      LIMIT 1;
    `;

    let cityDistrictId;
    if (existing) {
      cityDistrictId = existing.id;
      await sql`
        UPDATE public.districts
        SET state_province_id = ${stateId},
            country_id = ${countryId},
            name = ${c.name},
            code = ${c.code},
            is_active = true,
            deleted_at = NULL,
            updated_at = NOW()
        WHERE id = ${cityDistrictId};
      `;
      console.log(`   ✓ Updated City: ${c.name} (${c.code}) under state ${c.stateCode}`);
    } else {
      const [inserted] = await sql`
        INSERT INTO public.districts (
          country_id, state_province_id, name, code, is_active, created_at, updated_at
        ) VALUES (
          ${countryId}, ${stateId}, ${c.name}, ${c.code}, true, NOW(), NOW()
        ) RETURNING id;
      `;
      cityDistrictId = inserted.id;
      console.log(`   ✓ Inserted City: ${c.name} (${c.code}) under state ${c.stateCode}`);
    }
    cityMap.set(`${c.countryIso}:${c.stateCode}:${c.name}`, cityDistrictId);
  }

  // ---------------------------------------------------------------------------
  // STEP 4: UPSERT LOWER-LEVEL DISTRICTS / TEHSILS & MARKETS & PORTS (Tier 4 -> table public.cities)
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Step 4/5] Adding Wholesale Markets, Port & Lower-Level Districts (Tier 4: public.cities)...");

  const targetTehsils = [
    // Saudi Arabia - Wholesale Markets
    {
      countryIso: "SA",
      stateCode: "SA-01",
      cityName: "Riyadh",
      name: "Al-Batha Commercial Wholesale Market",
      code: "SA-01-RUH-BAT",
      zip_code: "12631",
    },
    {
      countryIso: "SA",
      stateCode: "SA-02",
      cityName: "Jeddah",
      name: "Central Fruit & Dry-Fruit Wholesale Market (Halagat Al-Khudar)",
      code: "SA-02-JED-CFM",
      zip_code: "22338",
    },

    // Uzbekistan - Commercial Districts
    {
      countryIso: "UZ",
      stateCode: "UZ-SA",
      cityName: "Samarkand",
      name: "Samarkand Central Commercial District",
      code: "UZ-SA-SKD-CEN",
      zip_code: "140100",
    },
    {
      countryIso: "UZ",
      stateCode: "UZ-TK",
      cityName: "Tashkent",
      name: "Tashkent Central Trade District (Chilanzar)",
      code: "UZ-TK-TAS-CHL",
      zip_code: "100096",
    },

    // Tajikistan - Districts
    {
      countryIso: "TJ",
      stateCode: "TJ-DU",
      cityName: "Dushanbe",
      name: "Ismoili Somoni Central District",
      code: "TJ-DU-DYU-CEN",
      zip_code: "734000",
    },
    {
      countryIso: "TJ",
      stateCode: "TJ-SU",
      cityName: "Khujand",
      name: "Panjshanbe Wholesale Market District",
      code: "TJ-SU-KHJ-PAN",
      zip_code: "735700",
    },
    {
      countryIso: "TJ",
      stateCode: "TJ-KT",
      cityName: "Bokhtar",
      name: "Bokhtar Central Commercial District",
      code: "TJ-KT-BOK-CEN",
      zip_code: "735140",
    },
    {
      countryIso: "TJ",
      stateCode: "TJ-GB",
      cityName: "Khorugh",
      name: "Khorugh Central District",
      code: "TJ-GB-KHO-CEN",
      zip_code: "736000",
    },
    {
      countryIso: "TJ",
      stateCode: "TJ-RA",
      cityName: "Vahdat",
      name: "Vahdat Commercial District",
      code: "TJ-RA-VAH-CEN",
      zip_code: "735400",
    },

    // Iran - Wholesale District & Bandar Abbas Port
    {
      countryIso: "IR",
      stateCode: "IR-23",
      cityName: "Tehran",
      name: "Tehran Grand Bazaar & Wholesale District",
      code: "IR-23-THR-BAZ",
      zip_code: "11616",
    },
    {
      countryIso: "IR",
      stateCode: "IR-09",
      cityName: "Mashhad",
      name: "Mashhad Central Wholesale & Trade District",
      code: "IR-09-MHD-CEN",
      zip_code: "91336",
    },
    {
      countryIso: "IR",
      stateCode: "IR-22",
      cityName: "Bandar Abbas",
      name: "Bandar Abbas Port (Shahid Rajaee Commercial Port & Customs Zone)",
      code: "IR-22-BND-PRT",
      zip_code: "79177",
    },
  ];

  for (const t of targetTehsils) {
    const countryId = countryMap.get(t.countryIso);
    const stateId = stateMap.get(`${t.countryIso}:${t.stateCode}`);
    const cityDistrictId = cityMap.get(`${t.countryIso}:${t.stateCode}:${t.cityName}`);

    if (!countryId || !stateId || !cityDistrictId) {
      console.warn(`   ⚠️ Missing parent for tehsil: ${t.name}`);
      continue;
    }

    const [existing] = await sql`
      SELECT id, name, code FROM public.cities
      WHERE country_id = ${countryId}
        AND (district_id = ${cityDistrictId} OR code = ${t.code} OR name ILIKE ${t.name})
      LIMIT 1;
    `;

    if (existing) {
      await sql`
        UPDATE public.cities
        SET district_id = ${cityDistrictId},
            state_province_id = ${stateId},
            country_id = ${countryId},
            name = ${t.name},
            code = ${t.code},
            zip_code = ${t.zip_code},
            is_active = true,
            deleted_at = NULL,
            updated_at = NOW()
        WHERE id = ${existing.id};
      `;
      console.log(`   ✓ Updated District/Tehsil: ${t.name} (${t.code})`);
    } else {
      await sql`
        INSERT INTO public.cities (
          country_id, state_province_id, district_id, name, code, zip_code, is_active, created_at, updated_at
        ) VALUES (
          ${countryId}, ${stateId}, ${cityDistrictId}, ${t.name}, ${t.code}, ${t.zip_code}, true, NOW(), NOW()
        );
      `;
      console.log(`   ✓ Inserted District/Tehsil: ${t.name} (${t.code})`);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 5: POPULATE COUNTRY CONTACT CALLING CODE RULES
  // ---------------------------------------------------------------------------
  console.log("\n▶ [Step 5/5] Registering Country Calling Code Rules in Database...");

  const allActiveCountries = await sql`
    SELECT id, name, iso2, phone_code FROM public.countries
    WHERE deleted_at IS NULL AND phone_code IS NOT NULL
    ORDER BY name ASC;
  `;

  const contactTypes = await sql`
    SELECT id, key FROM public.contact_types WHERE deleted_at IS NULL;
  `;

  let rulesCreated = 0;
  for (const c of allActiveCountries) {
    const rawCode = c.phone_code.trim();
    const formattedCode = rawCode.startsWith("+") ? rawCode : `+${rawCode}`;

    for (const ct of contactTypes) {
      const [existingRule] = await sql`
        SELECT id FROM public.country_contact_type_rules
        WHERE country_id = ${c.id} AND contact_type_id = ${ct.id}
        LIMIT 1;
      `;

      if (existingRule) {
        await sql`
          UPDATE public.country_contact_type_rules
          SET calling_code = ${formattedCode},
              is_active = true,
              deleted_at = NULL,
              updated_at = NOW()
          WHERE id = ${existingRule.id};
        `;
      } else {
        await sql`
          INSERT INTO public.country_contact_type_rules (
            country_id, contact_type_id, calling_code, is_active, created_at, updated_at
          ) VALUES (
            ${c.id}, ${ct.id}, ${formattedCode}, true, NOW(), NOW()
          );
        `;
      }
      rulesCreated++;
    }
  }
  console.log(`   ✓ Ensured ${rulesCreated} country contact rules across ${allActiveCountries.length} countries.`);

  // ---------------------------------------------------------------------------
  // VERIFICATION SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("📊 VERIFYING 4-TIER HIERARCHY SUMMARY FOR TARGET COUNTRIES");
  console.log("================================================================================");

  for (const [iso, cId] of countryMap.entries()) {
    const [c] = await sql`SELECT name, iso2, phone_code FROM public.countries WHERE id = ${cId}`;
    const states = await sql`SELECT id, name, code FROM public.states_provinces WHERE country_id = ${cId} AND deleted_at IS NULL ORDER BY name`;
    const sIds = states.map(s => s.id);
    const districts = sIds.length > 0 ? await sql`SELECT id, name, code, state_province_id FROM public.districts WHERE state_province_id IN ${sql(sIds)} AND deleted_at IS NULL ORDER BY name` : [];
    const dIds = districts.map(d => d.id);
    const tehsils = dIds.length > 0 ? await sql`SELECT id, name, code, district_id FROM public.cities WHERE district_id IN ${sql(dIds)} AND deleted_at IS NULL ORDER BY name` : [];

    console.log(`\n• ${c.name} (${c.iso2}) | Calling Code: ${c.phone_code}`);
    console.log(`  States (${states.length}): ${states.map(s => `${s.name} [${s.code}]`).join(", ")}`);
    console.log(`  Cities (${districts.length}): ${districts.map(d => `${d.name} [${d.code}]`).join(", ")}`);
    console.log(`  Districts/Tehsils (${tehsils.length}): ${tehsils.map(t => `${t.name} [${t.code}]`).join(", ")}`);
  }

  await sql.end();
  console.log("\n✅ Master data deployment completed successfully!");
}

main().catch((err) => {
  console.error("❌ Execution Error:", err);
  process.exit(1);
});
