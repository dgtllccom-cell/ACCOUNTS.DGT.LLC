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

async function run() {
  const countries = await sql`SELECT id, name, iso2, iso3 FROM countries ORDER BY name;`;
  console.log("=== COUNTRIES ===", countries);

  const countryBranches = await sql`SELECT id, country_id, name, code, is_main FROM country_branches ORDER BY name;`;
  console.log("=== COUNTRY BRANCHES ===", countryBranches);

  const cityBranches = await sql`SELECT id, country_id, country_branch_id, name, code, city_name FROM city_branches ORDER BY name;`;
  console.log("=== CITY BRANCHES ===", cityBranches);

  const clearingAgents = await sql`SELECT id, name, contact_person, phone, email, head_office_country_id FROM clearing_agents ORDER BY name;`;
  console.log("=== CLEARING AGENTS ===", clearingAgents);

  await sql.end();
}

run().catch(console.error);
