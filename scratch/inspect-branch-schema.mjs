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
  const cityCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'city_branches';`;
  console.log("=== city_branches columns ===", cityCols.map(c => `${c.column_name} (${c.data_type})`));

  const countryCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'country_branches';`;
  console.log("=== country_branches columns ===", countryCols.map(c => `${c.column_name} (${c.data_type})`));

  const caCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clearing_agents';`;
  console.log("=== clearing_agents columns ===", caCols.map(c => `${c.column_name} (${c.data_type})`));

  const allTables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%branch%' OR table_name LIKE '%clearing%');`;
  console.log("=== branch & clearing tables ===", allTables.map(t => t.table_name));

  await sql.end();
}

run().catch(console.error);
