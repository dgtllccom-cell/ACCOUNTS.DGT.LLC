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

async function run() {
  console.log("=== Step 1: Configure Exact 5 Countries ===");
  // Deactivate all non-5 countries
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

  const countries = await sql`SELECT id, name, iso2 FROM countries WHERE deleted_at IS NULL ORDER BY name;`;
  console.log("Active Countries:", countries.map(c => `${c.name} (${c.iso2})`));

  const countryMap = {};
  for (const c of countries) {
    countryMap[c.iso2.toUpperCase()] = c.id;
  }

  console.log("=== Step 2: Configure Exact 5 Country Main Branches ===");
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

    const [existing] = await sql`
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
  }

  const validCountryBranchIds = Object.values(countryBranchMap);
  await sql`
    UPDATE country_branches 
    SET deleted_at = NOW(), status = 'inactive'
    WHERE id NOT IN ${sql(validCountryBranchIds)};
  `;
  console.log("Country Main Branches configured:", countryBranchMap);

  console.log("=== Step 3: Configure Exact City (Business) Branches ===");
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

    let [existing] = await sql`
      SELECT id FROM city_branches 
      WHERE upper(code) = ${cb.code}
      LIMIT 1;
    `;

    if (!existing) {
      [existing] = await sql`
        SELECT id FROM city_branches 
        WHERE country_id = ${cId} AND upper(name) = ${cb.name.toUpperCase()}
        LIMIT 1;
      `;
    }

    if (existing) {
      await sql`
        UPDATE city_branches 
        SET country_id = ${cId}, country_branch_id = ${cbId}, name = ${cb.name}, code = ${cb.code}, city_name = ${cb.cityName}, local_currency = ${cb.currency},
            email = COALESCE(email, ${cb.cityName.toLowerCase().replace(/\s+/g, '') + '@dgt.llc'}),
            phone = COALESCE(phone, '+971 4 123 4567'),
            address = COALESCE(address, ${cb.cityName + ', ' + cb.name}),
            deleted_at = NULL, status = 'active', updated_at = NOW()
        WHERE id = ${existing.id};
      `;
      cityBranchMap[cb.code] = existing.id;
    } else {
      const branchEmail = `${cb.cityName.toLowerCase().replace(/\s+/g, '')}@dgt.llc`;
      const branchPhone = '+971 4 123 4567';
      const branchAddress = `${cb.cityName}, ${cb.name}`;
      const [inserted] = await sql`
        INSERT INTO city_branches (country_id, country_branch_id, name, code, city_name, local_currency, email, phone, address, status, created_at, updated_at)
        VALUES (${cId}, ${cbId}, ${cb.name}, ${cb.code}, ${cb.cityName}, ${cb.currency}, ${branchEmail}, ${branchPhone}, ${branchAddress}, 'active', NOW(), NOW())
        RETURNING id;
      `;
      cityBranchMap[cb.code] = inserted.id;
    }
  }

  const validCityBranchIds = Object.values(cityBranchMap);
  await sql`
    UPDATE city_branches 
    SET deleted_at = NOW(), status = 'inactive'
    WHERE id NOT IN ${sql(validCityBranchIds)};
  `;
  console.log("City (Business) Branches configured:", cityBranchMap);

  console.log("=== Step 4: Configure Exact Clearing Agent Branches ===");
  // Primary clearing agent
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

  // 1. UAE: Dubai Port
  // 2. Pakistan: Chaman
  // 3. Afghanistan: Nimruz
  // 4. Iran: Bandar Abbas
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
  }

  const validCaBranchIds = Object.values(caBranchMap);
  await sql`
    UPDATE clearing_agent_branches 
    SET deleted_at = NOW(), status = 'inactive'
    WHERE id NOT IN ${sql(validCaBranchIds)} AND branch_level != 'head_office';
  `;
  console.log("Clearing Agent Branches configured:", caBranchMap);

  console.log("=== FINAL VERIFICATION ===");
  const finalCountries = await sql`SELECT id, name, iso2 FROM countries WHERE deleted_at IS NULL ORDER BY name;`;
  console.log("ACTIVE COUNTRIES (Count:", finalCountries.length, "):", finalCountries);

  const finalMain = await sql`SELECT cb.id, cb.name, cb.code, c.name as country_name FROM country_branches cb JOIN countries c ON cb.country_id = c.id WHERE cb.deleted_at IS NULL ORDER BY c.name;`;
  console.log("ACTIVE COUNTRY MAIN BRANCHES (Count:", finalMain.length, "):", finalMain);

  const finalCities = await sql`SELECT cb.id, cb.name, cb.code, cb.city_name, c.name as country_name FROM city_branches cb JOIN countries c ON cb.country_id = c.id WHERE cb.deleted_at IS NULL ORDER BY c.name, cb.name;`;
  console.log("ACTIVE CITY (BUSINESS) BRANCHES (Count:", finalCities.length, "):", finalCities);

  const finalCAs = await sql`SELECT cab.id, cab.name, cab.code, cab.branch_level, c.name as country_name FROM clearing_agent_branches cab LEFT JOIN countries c ON cab.country_id = c.id WHERE cab.deleted_at IS NULL ORDER BY cab.code;`;
  console.log("ACTIVE CLEARING AGENT BRANCHES (Count:", finalCAs.length, "):", finalCAs);

  await sql.end();
}

run().catch(console.error);
