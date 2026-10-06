import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

if (!env.DATABASE_URL.includes("csesvyxxjivnkkozgopt")) {
  console.error("FATAL: Target DB is NOT csesvyxxjivnkkozgopt (testing). Aborting!");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { ssl: "require" });

const COUNTRIES_SEED = [
  {
    name: "Saudi Arabia",
    iso2: "SA",
    iso3: "SAU",
    currency: "SAR",
    phone: "+966",
    lang: "ar",
    officialEmail: "official@dgt.sa",
    adminEmail: "admin@dgt.sa",
    states: [
      {
        name: "Riyadh Province",
        code: "SA-01",
        cities: [
          { name: "Riyadh", code: "RUH", zip: "11564", phone: "011" },
          { name: "Al Kharj", code: "AKH", zip: "11942", phone: "011" }
        ]
      },
      {
        name: "Makkah Province",
        code: "SA-02",
        cities: [
          { name: "Jeddah", code: "JED", zip: "21577", phone: "012" },
          { name: "Makkah", code: "MAK", zip: "24231", phone: "012" },
          { name: "Taif", code: "TIF", zip: "26513", phone: "012" }
        ]
      },
      {
        name: "Eastern Province",
        code: "SA-04",
        cities: [
          { name: "Dammam", code: "DMM", zip: "31411", phone: "013" },
          { name: "Al Khobar", code: "KHB", zip: "31952", phone: "013" },
          { name: "Jubail", code: "JBL", zip: "31951", phone: "013" }
        ]
      },
      {
        name: "Madinah Province",
        code: "SA-03",
        cities: [
          { name: "Madinah", code: "MED", zip: "42311", phone: "014" },
          { name: "Yanbu", code: "YNB", zip: "46411", phone: "014" }
        ]
      }
    ]
  },
  {
    name: "China",
    iso2: "CN",
    iso3: "CHN",
    currency: "CNY",
    phone: "+86",
    lang: "en",
    officialEmail: "official@dgt.cn",
    adminEmail: "admin@dgt.cn",
    states: [
      {
        name: "Guangdong",
        code: "CN-GD",
        cities: [
          { name: "Guangzhou", code: "CAN", zip: "510000", phone: "020" },
          { name: "Shenzhen", code: "SZX", zip: "518000", phone: "0755" },
          { name: "Foshan", code: "FOS", zip: "528000", phone: "0757" },
          { name: "Dongguan", code: "DGG", zip: "523000", phone: "0769" }
        ]
      },
      {
        name: "Zhejiang",
        code: "CN-ZJ",
        cities: [
          { name: "Yiwu", code: "YIW", zip: "322000", phone: "0579" },
          { name: "Hangzhou", code: "HGH", zip: "310000", phone: "0571" },
          { name: "Ningbo", code: "NGB", zip: "315000", phone: "0574" }
        ]
      },
      {
        name: "Beijing",
        code: "CN-BJ",
        cities: [
          { name: "Beijing", code: "BJS", zip: "100000", phone: "010" }
        ]
      },
      {
        name: "Shanghai",
        code: "CN-SH",
        cities: [
          { name: "Shanghai", code: "SHA", zip: "200000", phone: "021" }
        ]
      },
      {
        name: "Shandong",
        code: "CN-SD",
        cities: [
          { name: "Qingdao", code: "TAO", zip: "266000", phone: "0532" },
          { name: "Jinan", code: "TNA", zip: "250000", phone: "0531" }
        ]
      },
      {
        name: "Fujian",
        code: "CN-FJ",
        cities: [
          { name: "Xiamen", code: "XMN", zip: "361000", phone: "0592" },
          { name: "Fuzhou", code: "FOC", zip: "350000", phone: "0591" }
        ]
      },
      {
        name: "Xinjiang",
        code: "CN-XJ",
        cities: [
          { name: "Urumqi", code: "URC", zip: "830000", phone: "0991" },
          { name: "Kashgar", code: "KHG", zip: "844000", phone: "0998" }
        ]
      },
      {
        name: "Liaoning",
        code: "CN-LN",
        cities: [
          { name: "Dalian", code: "DLC", zip: "116000", phone: "0411" },
          { name: "Shenyang", code: "SHE", zip: "110000", phone: "024" }
        ]
      }
    ]
  },
  {
    name: "Turkiye",
    iso2: "TR",
    iso3: "TUR",
    currency: "TRY",
    phone: "+90",
    lang: "en",
    officialEmail: "official@dgt.tr",
    adminEmail: "admin@dgt.tr",
    states: [
      {
        name: "Istanbul",
        code: "TR-34",
        cities: [
          { name: "Istanbul", code: "IST", zip: "34000", phone: "0212" }
        ]
      },
      {
        name: "Ankara",
        code: "TR-06",
        cities: [
          { name: "Ankara", code: "ANK", zip: "06000", phone: "0312" }
        ]
      },
      {
        name: "Izmir",
        code: "TR-35",
        cities: [
          { name: "Izmir", code: "IZM", zip: "35000", phone: "0232" }
        ]
      },
      {
        name: "Bursa",
        code: "TR-16",
        cities: [
          { name: "Bursa", code: "BUR", zip: "16000", phone: "0224" }
        ]
      },
      {
        name: "Antalya",
        code: "TR-07",
        cities: [
          { name: "Antalya", code: "AYT", zip: "07000", phone: "0242" }
        ]
      },
      {
        name: "Gaziantep",
        code: "TR-27",
        cities: [
          { name: "Gaziantep", code: "GZT", zip: "27000", phone: "0342" }
        ]
      }
    ]
  },
  {
    name: "Uzbekistan",
    iso2: "UZ",
    iso3: "UZB",
    currency: "UZS",
    phone: "+998",
    lang: "en",
    officialEmail: "official@dgt.uz",
    adminEmail: "admin@dgt.uz",
    states: [
      {
        name: "Tashkent Region",
        code: "UZ-TO",
        cities: [
          { name: "Tashkent", code: "TAS", zip: "100000", phone: "71" }
        ]
      },
      {
        name: "Samarkand Region",
        code: "UZ-SA",
        cities: [
          { name: "Samarkand", code: "SKD", zip: "140100", phone: "66" }
        ]
      },
      {
        name: "Bukhara Region",
        code: "UZ-BU",
        cities: [
          { name: "Bukhara", code: "BHK", zip: "200100", phone: "65" }
        ]
      },
      {
        name: "Fergana Region",
        code: "UZ-FA",
        cities: [
          { name: "Fergana", code: "FEG", zip: "150100", phone: "73" }
        ]
      }
    ]
  },
  {
    name: "Kazakhstan",
    iso2: "KZ",
    iso3: "KAZ",
    currency: "KZT",
    phone: "+7",
    lang: "en",
    officialEmail: "official@dgt.kz",
    adminEmail: "admin@dgt.kz",
    states: [
      {
        name: "Almaty Region",
        code: "KZ-ALA",
        cities: [
          { name: "Almaty", code: "ALA", zip: "050000", phone: "727" }
        ]
      },
      {
        name: "Astana City",
        code: "KZ-AST",
        cities: [
          { name: "Astana", code: "NQZ", zip: "010000", phone: "7172" }
        ]
      },
      {
        name: "Shymkent City",
        code: "KZ-SHY",
        cities: [
          { name: "Shymkent", code: "CIT", zip: "160000", phone: "7252" }
        ]
      }
    ]
  },
  {
    name: "Tajikistan",
    iso2: "TJ",
    iso3: "TJK",
    currency: "TJS",
    phone: "+992",
    lang: "fa",
    officialEmail: "official@dgt.tj",
    adminEmail: "admin@dgt.tj",
    states: [
      {
        name: "Dushanbe City",
        code: "TJ-DU",
        cities: [
          { name: "Dushanbe", code: "DYU", zip: "734000", phone: "37" }
        ]
      },
      {
        name: "Sughd Region",
        code: "TJ-SU",
        cities: [
          { name: "Khujand", code: "LBD", zip: "735700", phone: "3422" }
        ]
      },
      {
        name: "Khatlon Region",
        code: "TJ-KT",
        cities: [
          { name: "Bokhtar", code: "KQT", zip: "735140", phone: "3222" }
        ]
      }
    ]
  },
  {
    name: "Turkmenistan",
    iso2: "TM",
    iso3: "TKM",
    currency: "TMT",
    phone: "+993",
    lang: "en",
    officialEmail: "official@dgt.tm",
    adminEmail: "admin@dgt.tm",
    states: [
      {
        name: "Ashgabat City",
        code: "TM-S",
        cities: [
          { name: "Ashgabat", code: "ASB", zip: "744000", phone: "12" }
        ]
      },
      {
        name: "Balkan Region",
        code: "TM-B",
        cities: [
          { name: "Turkmenbashi", code: "KRW", zip: "745000", phone: "243" }
        ]
      },
      {
        name: "Mary Region",
        code: "TM-M",
        cities: [
          { name: "Mary", code: "MYP", zip: "745400", phone: "522" }
        ]
      }
    ]
  },
  {
    name: "Russia",
    iso2: "RU",
    iso3: "RUS",
    currency: "RUB",
    phone: "+7",
    lang: "en",
    officialEmail: "official@dgt.ru",
    adminEmail: "admin@dgt.ru",
    states: [
      {
        name: "Moscow City",
        code: "RU-MOW",
        cities: [
          { name: "Moscow", code: "MOW", zip: "101000", phone: "495" }
        ]
      },
      {
        name: "Saint Petersburg",
        code: "RU-SPE",
        cities: [
          { name: "Saint Petersburg", code: "LED", zip: "190000", phone: "812" }
        ]
      },
      {
        name: "Tatarstan Republic",
        code: "RU-TA",
        cities: [
          { name: "Kazan", code: "KZN", zip: "420000", phone: "843" }
        ]
      },
      {
        name: "Novosibirsk Oblast",
        code: "RU-NVS",
        cities: [
          { name: "Novosibirsk", code: "OVB", zip: "630000", phone: "383" }
        ]
      }
    ]
  },
  {
    name: "Oman",
    iso2: "OM",
    iso3: "OMN",
    currency: "OMR",
    phone: "+968",
    lang: "ar",
    officialEmail: "official@dgt.om",
    adminEmail: "admin@dgt.om",
    states: [
      {
        name: "Muscat Governorate",
        code: "OM-MA",
        cities: [
          { name: "Muscat", code: "MCT", zip: "100", phone: "24" }
        ]
      },
      {
        name: "Dhofar Governorate",
        code: "OM-ZU",
        cities: [
          { name: "Salalah", code: "SLL", zip: "211", phone: "23" }
        ]
      },
      {
        name: "Al Batinah North",
        code: "OM-BN",
        cities: [
          { name: "Sohar", code: "OHS", zip: "311", phone: "26" }
        ]
      }
    ]
  },
  {
    name: "Qatar",
    iso2: "QA",
    iso3: "QAT",
    currency: "QAR",
    phone: "+974",
    lang: "ar",
    officialEmail: "official@dgt.qa",
    adminEmail: "admin@dgt.qa",
    states: [
      {
        name: "Doha Municipality",
        code: "QA-DA",
        cities: [
          { name: "Doha", code: "DOH", zip: "00000", phone: "44" }
        ]
      },
      {
        name: "Al Rayyan",
        code: "QA-RA",
        cities: [
          { name: "Al Rayyan", code: "RAY", zip: "00000", phone: "44" }
        ]
      },
      {
        name: "Al Wakrah",
        code: "QA-WA",
        cities: [
          { name: "Al Wakrah", code: "WAK", zip: "00000", phone: "44" }
        ]
      }
    ]
  },
  {
    name: "Kuwait",
    iso2: "KW",
    iso3: "KWT",
    currency: "KWD",
    phone: "+965",
    lang: "ar",
    officialEmail: "official@dgt.kw",
    adminEmail: "admin@dgt.kw",
    states: [
      {
        name: "Al Asimah Governorate",
        code: "KW-KU",
        cities: [
          { name: "Kuwait City", code: "KWI", zip: "13001", phone: "22" }
        ]
      },
      {
        name: "Hawalli Governorate",
        code: "KW-HA",
        cities: [
          { name: "Hawalli", code: "HWL", zip: "32000", phone: "25" }
        ]
      },
      {
        name: "Al Ahmadi Governorate",
        code: "KW-AH",
        cities: [
          { name: "Ahmadi", code: "AHM", zip: "61000", phone: "23" }
        ]
      }
    ]
  },
  {
    name: "Bahrain",
    iso2: "BH",
    iso3: "BHR",
    currency: "BHD",
    phone: "+973",
    lang: "ar",
    officialEmail: "official@dgt.bh",
    adminEmail: "admin@dgt.bh",
    states: [
      {
        name: "Capital Governorate",
        code: "BH-13",
        cities: [
          { name: "Manama", code: "BAH", zip: "301", phone: "17" }
        ]
      },
      {
        name: "Muharraq Governorate",
        code: "BH-15",
        cities: [
          { name: "Muharraq", code: "MUH", zip: "202", phone: "17" }
        ]
      },
      {
        name: "Southern Governorate",
        code: "BH-14",
        cities: [
          { name: "Riffa", code: "RIF", zip: "901", phone: "17" }
        ]
      }
    ]
  }
];

async function main() {
  console.log("=== Step 1: Reactivate Core Existing Countries in Testing DB ===");
  const reactivated = await sql`
    UPDATE public.countries 
    SET is_active = true, deleted_at = NULL, updated_at = NOW()
    WHERE upper(iso2) IN ('AF', 'IN', 'IR', 'CN', 'TJ', 'TM', 'TR', 'UZ', 'RU', 'KZ', 'PK', 'AE')
    RETURNING id, name, iso2, is_active, deleted_at
  `;
  console.log(`Reactivated ${reactivated.length} core countries:`, reactivated.map(c => `${c.name} (${c.iso2})`).join(', '));

  console.log("=== Step 2: Delete Junk Test QA Rows ===");
  await sql`
    DELETE FROM public.countries 
    WHERE name LIKE 'QA Country Location%' OR iso2 IS NULL;
  `;

  console.log("=== Step 3: Seed / Ensure Master Countries, States, Cities ===");
  for (const cData of COUNTRIES_SEED) {
    // 1. Upsert country
    const [existing] = await sql`
      SELECT id FROM public.countries 
      WHERE upper(iso2) = ${cData.iso2.toUpperCase()}
      LIMIT 1
    `;

    let countryId = existing?.id;
    if (existing) {
      await sql`
        UPDATE public.countries 
        SET 
          name = ${cData.name},
          iso3 = ${cData.iso3},
          currency_code = ${cData.currency},
          phone_code = ${cData.phone},
          default_language_code = ${cData.lang},
          official_email = ${cData.officialEmail},
          admin_email = ${cData.adminEmail},
          is_active = true,
          deleted_at = NULL,
          updated_at = NOW()
        WHERE id = ${countryId}
      `;
      console.log(`Updated country: ${cData.name} (${cData.iso2})`);
    } else {
      const [inserted] = await sql`
        INSERT INTO public.countries (
          name, iso2, iso3, currency_code, default_language_code, 
          phone_code, official_email, admin_email, is_active, created_at, updated_at
        ) VALUES (
          ${cData.name}, ${cData.iso2}, ${cData.iso3}, ${cData.currency}, ${cData.lang},
          ${cData.phone}, ${cData.officialEmail}, ${cData.adminEmail}, true, NOW(), NOW()
        ) RETURNING id
      `;
      countryId = inserted.id;
      console.log(`Inserted country: ${cData.name} (${cData.iso2})`);
    }

    // 2. States & Cities
    for (const sData of cData.states) {
      let [existingState] = await sql`
        SELECT id FROM public.states_provinces 
        WHERE country_id = ${countryId} AND (upper(code) = ${sData.code.toUpperCase()} OR lower(name) = ${sData.name.toLowerCase()})
        LIMIT 1
      `;

      let stateId = existingState?.id;
      if (existingState) {
        await sql`
          UPDATE public.states_provinces 
          SET name = ${sData.name}, code = ${sData.code}, is_active = true, deleted_at = NULL, updated_at = NOW()
          WHERE id = ${stateId}
        `;
      } else {
        const [insertedState] = await sql`
          INSERT INTO public.states_provinces (country_id, name, code, is_active, created_at, updated_at)
          VALUES (${countryId}, ${sData.name}, ${sData.code}, true, NOW(), NOW())
          RETURNING id
        `;
        stateId = insertedState.id;
      }

      // 3. Cities
      for (const ctData of sData.cities) {
        const [existingCity] = await sql`
          SELECT id FROM public.cities 
          WHERE country_id = ${countryId} AND lower(name) = ${ctData.name.toLowerCase()}
          LIMIT 1
        `;

        if (existingCity) {
          await sql`
            UPDATE public.cities 
            SET 
              state_province_id = ${stateId},
              code = ${ctData.code},
              zip_code = ${ctData.zip},
              phone_area_code = ${ctData.phone},
              is_active = true,
              deleted_at = NULL,
              updated_at = NOW()
            WHERE id = ${existingCity.id}
          `;
        } else {
          await sql`
            INSERT INTO public.cities (
              country_id, state_province_id, name, code, zip_code, phone_area_code, is_active, created_at, updated_at
            ) VALUES (
              ${countryId}, ${stateId}, ${ctData.name}, ${ctData.code}, ${ctData.zip}, ${ctData.phone}, true, NOW(), NOW()
            )
          `;
        }
      }
    }
  }

  console.log("\n=== Step 4: Final Verification ===");
  const allActiveCountries = await sql`
    SELECT id, name, iso2, iso3, currency_code, phone_code 
    FROM public.countries 
    WHERE deleted_at IS NULL AND is_active = true
    ORDER BY name ASC
  `;
  console.log(`Total active countries: ${allActiveCountries.length}`);
  for (const c of allActiveCountries) {
    const [sc] = await sql`SELECT count(*)::int as c FROM public.states_provinces WHERE country_id = ${c.id} AND deleted_at IS NULL`;
    const [cc] = await sql`SELECT count(*)::int as c FROM public.cities WHERE country_id = ${c.id} AND deleted_at IS NULL`;
    console.log(`- ${c.name} (${c.iso2}/${c.iso3}): Currency=${c.currency_code}, Phone=${c.phone_code}, States=${sc.c}, Cities=${cc.c}`);
  }

  await sql.end();
  console.log("\nFinished successfully!");
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
