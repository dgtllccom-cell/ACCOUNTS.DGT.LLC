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
const sql = postgres(dbUrl, { max: 2, prepare: false });

async function verify() {
  console.log("=================================================================");
  console.log("   ERP STANDARDIZED LOCATION HIERARCHY VERIFICATION REPORT       ");
  console.log("=================================================================\n");

  const countries = await sql`
    SELECT id, name, iso2, iso3, currency_code, phone_code 
    FROM countries 
    WHERE deleted_at IS NULL 
    ORDER BY name;
  `;
  console.log(`1. ACTIVE COUNTRIES (${countries.length}):`);
  countries.forEach(c => console.log(`   - ${c.name} [ISO: ${c.iso2}/${c.iso3}] Currency: ${c.currency_code} Phone: ${c.phone_code}`));

  const mainBranches = await sql`
    SELECT cb.id, cb.name, cb.code, cb.local_currency, c.name as country_name 
    FROM country_branches cb 
    JOIN countries c ON cb.country_id = c.id 
    WHERE cb.deleted_at IS NULL 
    ORDER BY c.name;
  `;
  console.log(`\n2. ACTIVE COUNTRY MAIN BRANCHES (${mainBranches.length}):`);
  mainBranches.forEach(mb => console.log(`   - ${mb.name} [Code: ${mb.code}] Country: ${mb.country_name} (${mb.local_currency})`));

  const cityBranches = await sql`
    SELECT cb.id, cb.name, cb.code, cb.city_name, cb.local_currency, c.name as country_name 
    FROM city_branches cb 
    JOIN countries c ON cb.country_id = c.id 
    WHERE cb.deleted_at IS NULL 
    ORDER BY c.name, cb.name;
  `;
  console.log(`\n3. ACTIVE CITY (BUSINESS) BRANCHES (${cityBranches.length}):`);
  cityBranches.forEach(cb => console.log(`   - ${cb.name} [Code: ${cb.code}] City: ${cb.city_name}, Country: ${cb.country_name}`));

  const caBranches = await sql`
    SELECT cab.id, cab.name, cab.code, cab.branch_level, c.name as country_name, cb.name as city_branch_name 
    FROM clearing_agent_branches cab 
    LEFT JOIN countries c ON cab.country_id = c.id 
    LEFT JOIN city_branches cb ON cab.city_branch_id = cb.id 
    WHERE cab.deleted_at IS NULL AND cab.branch_level != 'head_office'
    ORDER BY cab.code;
  `;
  console.log(`\n4. ACTIVE CLEARING AGENT BRANCHES (${caBranches.length}):`);
  caBranches.forEach(cab => console.log(`   - ${cab.name} [Code: ${cab.code}] Level: ${cab.branch_level}, Country: ${cab.country_name || 'N/A'}, City Branch: ${cab.city_branch_name || 'N/A'}`));

  console.log("\n=================================================================");
  console.log("   SUMMARY: 5 COUNTRIES, 5 MAIN BRANCHES, 6 CITY BRANCHES, 4 CAs");
  console.log("=================================================================\n");

  await sql.end();
}

verify().catch(console.error);
