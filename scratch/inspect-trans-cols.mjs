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

async function inspectTranslationCols() {
  const transTables = [
    'countries_en', 'countries_ur', 'countries_ar', 'countries_fa', 'countries_ps',
    'country_branches_en', 'country_branches_ur', 'country_branches_ar', 'country_branches_fa', 'country_branches_ps',
    'city_branches_en', 'city_branches_ur', 'city_branches_ar', 'city_branches_fa', 'city_branches_ps',
    'clearing_agent_branches_en', 'clearing_agent_branches_ur', 'clearing_agent_branches_ar', 'clearing_agent_branches_fa', 'clearing_agent_branches_ps'
  ];

  for (const t of ['countries_en', 'country_branches_en', 'city_branches_en', 'clearing_agent_branches_en']) {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${t};`;
    console.log(`=== ${t} columns ===`, cols.map(c => c.column_name));
  }

  await sql.end();
}

inspectTranslationCols().catch(console.error);
