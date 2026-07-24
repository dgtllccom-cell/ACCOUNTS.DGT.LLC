import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 15
});

const migrationPath = "supabase/migrations/0042_location_master_population.sql";

const countries = [
  {
    name: "Pakistan",
    iso2: "PK",
    iso3: "PAK",
    currency: "PKR",
    phone: "+92",
    states: [
      ["Punjab", "PK-PB", [["Lahore", "PK-PB-LHR", "54000", "042", ["Model Town", "Raiwind"]], ["Faisalabad", "PK-PB-FSD", "38000", "041", ["Jaranwala"]], ["Rawalpindi", "PK-PB-RWP", "46000", "051", ["Taxila"]]]],
      ["Sindh", "PK-SD", [["Karachi", "PK-SD-KHI", "74000", "021", ["Saddar", "Clifton"]], ["Hyderabad", "PK-SD-HYD", "71000", "022", []]]],
      ["Balochistan", "PK-BA", [["Quetta", "PK-BA-QTA", "87300", "081", []], ["Chaman", "PK-BA-CHM", "86000", "0826", ["Chaman Sadar"]]]],
      ["Khyber Pakhtunkhwa", "PK-KP", [["Peshawar", "PK-KP-PEW", "25000", "091", []]]],
      ["Islamabad Capital Territory", "PK-IS", [["Islamabad", "PK-IS-ISB", "44000", "051", []]]]
    ]
  },
  {
    name: "Afghanistan",
    iso2: "AF",
    iso3: "AFG",
    currency: "AFN",
    phone: "+93",
    states: [
      ["Kabul", "AF-KBL", [["Kabul", "AF-KBL-KBL", "1001", "020", ["District 1"]]]],
      ["Kandahar", "AF-KDH", [["Kandahar", "AF-KDH-KDH", "3801", "030", []]]],
      ["Herat", "AF-HRT", [["Herat", "AF-HRT-HRT", "3001", "040", []]]],
      ["Balkh", "AF-BAL", [["Mazar-i-Sharif", "AF-BAL-MZR", "1701", "050", []]]],
      ["Nangarhar", "AF-NGR", [["Jalalabad", "AF-NGR-JAA", "2601", "060", []]]]
    ]
  },
  {
    name: "India",
    iso2: "IN",
    iso3: "IND",
    currency: "INR",
    phone: "+91",
    states: [
      ["Maharashtra", "IN-MH", [["Mumbai", "IN-MH-MUM", "400001", "022", []], ["Pune", "IN-MH-PUN", "411001", "020", []]]],
      ["Delhi", "IN-DL", [["New Delhi", "IN-DL-NDL", "110001", "011", []]]],
      ["Gujarat", "IN-GJ", [["Ahmedabad", "IN-GJ-AMD", "380001", "079", []]]],
      ["Punjab", "IN-PB", [["Amritsar", "IN-PB-ATQ", "143001", "0183", []]]],
      ["Rajasthan", "IN-RJ", [["Jaipur", "IN-RJ-JAI", "302001", "0141", []]]]
    ]
  },
  {
    name: "Iran",
    iso2: "IR",
    iso3: "IRN",
    currency: "IRR",
    phone: "+98",
    states: [
      ["Tehran", "IR-THR", [["Tehran", "IR-THR-THR", "11369", "021", []]]],
      ["Razavi Khorasan", "IR-RKH", [["Mashhad", "IR-RKH-MHD", "91375", "051", []]]],
      ["Isfahan", "IR-ISF", [["Isfahan", "IR-ISF-ISF", "81464", "031", []]]],
      ["Fars", "IR-FRS", [["Shiraz", "IR-FRS-SYZ", "71345", "071", []]]],
      ["East Azerbaijan", "IR-EAZ", [["Tabriz", "IR-EAZ-TBZ", "51368", "041", []]]]
    ]
  },
  {
    name: "United Arab Emirates",
    aliases: ["UAE"],
    iso2: "AE",
    iso3: "ARE",
    currency: "AED",
    phone: "+971",
    states: [
      ["Dubai", "AE-DU", [["Dubai", "AE-DU-DXB", "00000", "04", ["Deira", "Bur Dubai", "Jumeirah", "Dubai Marina", "Business Bay"]]]],
      ["Abu Dhabi", "AE-AZ", [["Abu Dhabi City", "AE-AZ-AUH", "00000", "02", []], ["Al Ain", "AE-AZ-AAN", "00000", "03", []], ["Mussafah", "AE-AZ-MSF", "00000", "02", []]]],
      ["Sharjah", "AE-SH", [["Sharjah City", "AE-SH-SHJ", "00000", "06", ["Al Nahda", "Al Majaz"]]]],
      ["Ajman", "AE-AJ", [["Ajman City", "AE-AJ-AJM", "00000", "06", []]]],
      ["Ras Al Khaimah", "AE-RK", [["Ras Al Khaimah City", "AE-RK-RKT", "00000", "07", []]]],
      ["Fujairah", "AE-FU", [["Fujairah City", "AE-FU-FJR", "00000", "09", []]]],
      ["Umm Al Quwain", "AE-UQ", [["Umm Al Quwain City", "AE-UQ-UAQ", "00000", "06", []]]]
    ]
  }
];

async function getOrCreateCountry(country) {
  const rows = await sql`
    select id, name, iso2, iso3
    from countries
    where deleted_at is null
  `;
  const row = rows.find((item) => {
    const name = String(item.name ?? "").toLowerCase();
    return name === country.name.toLowerCase() || (country.aliases ?? []).map((x) => x.toLowerCase()).includes(name) || item.iso2 === country.iso2 || item.iso3 === country.iso3;
  });
  if (row?.id) {
    const [updated] = await sql`
      update countries
      set name = ${country.name},
          iso2 = ${country.iso2},
          iso3 = ${country.iso3},
          currency_code = ${country.currency},
          phone_code = ${country.phone},
          updated_at = now()
      where id = ${row.id}
      returning id
    `;
    return updated.id;
  }
  const [created] = await sql`
    insert into countries (name, iso2, iso3, currency_code, phone_code, default_language_code, official_email, admin_email)
    values (${country.name}, ${country.iso2}, ${country.iso3}, ${country.currency}, ${country.phone}, 'en', ${`official@dgt.${country.iso2.toLowerCase()}`}, ${`admin@dgt.${country.iso2.toLowerCase()}`})
    returning id
  `;
  return created.id;
}

async function getOrCreateState(countryId, stateName, stateCode) {
  const [existing] = await sql`
    select id from states_provinces
    where country_id = ${countryId}
      and lower(name) = lower(${stateName})
      and deleted_at is null
    limit 1
  `;
  if (existing?.id) {
    await sql`update states_provinces set code = ${stateCode}, updated_at = now() where id = ${existing.id}`;
    return existing.id;
  }
  const [created] = await sql`
    insert into states_provinces (country_id, name, code)
    values (${countryId}, ${stateName}, ${stateCode})
    returning id
  `;
  return created.id;
}

async function getOrCreateDistrict(countryId, stateId, name, code, postal, phone) {
  const [existing] = await sql`
    select id from districts
    where state_province_id = ${stateId}
      and lower(name) = lower(${name})
      and deleted_at is null
    limit 1
  `;
  if (existing?.id) {
    await sql`update districts set code = ${code}, postal_code = ${postal}, phone_area_code = ${phone}, updated_at = now() where id = ${existing.id}`;
    return existing.id;
  }
  const [created] = await sql`
    insert into districts (country_id, state_province_id, name, code, postal_code, phone_area_code)
    values (${countryId}, ${stateId}, ${name}, ${code}, ${postal}, ${phone})
    returning id
  `;
  return created.id;
}

async function getOrCreateCity(countryId, stateId, districtId, name, code, postal, phone) {
  const [existing] = await sql`
    select id from cities
    where country_id = ${countryId}
      and district_id = ${districtId}
      and lower(name) = lower(${name})
      and deleted_at is null
    limit 1
  `;
  if (existing?.id) {
    await sql`update cities set code = ${code}, zip_code = ${postal}, phone_area_code = ${phone}, updated_at = now() where id = ${existing.id}`;
    return existing.id;
  }
  const [created] = await sql`
    insert into cities (country_id, state_province_id, district_id, name, code, zip_code, phone_area_code)
    values (${countryId}, ${stateId}, ${districtId}, ${name}, ${code}, ${postal}, ${phone})
    returning id
  `;
  return created.id;
}

async function getOrCreateTehsil(countryId, stateId, districtId, cityId, name, code, postal, phone) {
  const [existing] = await sql`
    select id from areas_locations
    where city_id = ${cityId}
      and lower(name) = lower(${name})
      and deleted_at is null
    limit 1
  `;
  if (existing?.id) {
    await sql`update areas_locations set code = ${code}, postal_code = ${postal}, phone_area_code = ${phone}, updated_at = now() where id = ${existing.id}`;
    return existing.id;
  }
  const [created] = await sql`
    insert into areas_locations (country_id, state_province_id, district_id, city_id, name, code, postal_code, phone_area_code)
    values (${countryId}, ${stateId}, ${districtId}, ${cityId}, ${name}, ${code}, ${postal}, ${phone})
    returning id
  `;
  return created.id;
}

try {
  await sql`select now()`;
  await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;
  await sql.unsafe(fs.readFileSync(migrationPath, "utf8"));

  let states = 0;
  let districts = 0;
  let cities = 0;
  let tehsils = 0;

  for (const country of countries) {
    const countryId = await getOrCreateCountry(country);
    for (const [stateName, stateCode, districtRows] of country.states) {
      const stateId = await getOrCreateState(countryId, stateName, stateCode);
      states++;
      for (const [districtName, districtCode, postal, phone, tehsilNames] of districtRows) {
        const districtId = await getOrCreateDistrict(countryId, stateId, districtName, districtCode, postal, phone);
        districts++;
        const cityId = await getOrCreateCity(countryId, stateId, districtId, districtName, districtCode, postal, phone);
        cities++;
        for (const tehsilName of tehsilNames) {
          const suffix = tehsilName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 10);
          await getOrCreateTehsil(countryId, stateId, districtId, cityId, tehsilName, `${districtCode}-${suffix}`, postal, phone);
          tehsils++;
        }
      }
    }
  }

  const [counts] = await sql`
    select
      (select count(*)::int from countries where deleted_at is null and iso2 in ('PK','AF','IN','IR','AE')) as countries,
      (select count(*)::int from states_provinces where deleted_at is null) as states,
      (select count(*)::int from districts where deleted_at is null) as districts,
      (select count(*)::int from cities where deleted_at is null) as cities,
      (select count(*)::int from areas_locations where deleted_at is null) as tehsils
  `;

  const [sample] = await sql`
    select
      c.name as country,
      c.iso2,
      c.phone_code,
      s.name as state,
      s.code as state_code,
      d.name as district,
      d.code as district_code,
      city.name as city,
      city.code as city_code,
      city.zip_code,
      city.phone_area_code
    from countries c
    join states_provinces s on s.country_id = c.id and s.deleted_at is null
    join districts d on d.state_province_id = s.id and d.deleted_at is null
    join cities city on city.district_id = d.id and city.deleted_at is null
    where c.iso2 = 'PK' and city.code = 'PK-PB-LHR'
    limit 1
  `;

  console.log(JSON.stringify({ applied: "0042_location_master_population", seeded: { states, districts, cities, tehsils }, databaseCounts: counts, samplePakistanLahore: sample }, null, 2));
} catch (error) {
  console.error("location master data migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
