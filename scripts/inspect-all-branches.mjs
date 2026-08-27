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

async function inspectBranches() {
  const countries = await sql`SELECT id, name, iso2 FROM countries;`;
  console.log("COUNTRIES:", countries);

  const countryBranches = await sql`SELECT id, country_id, name, code FROM country_branches;`;
  console.log("COUNTRY BRANCHES:", countryBranches);

  const cityBranches = await sql`SELECT id, country_id, country_branch_id, name, code FROM city_branches;`;
  console.log("CITY BRANCHES:", cityBranches);

  await sql.end();
}

inspectBranches().catch(console.error);
