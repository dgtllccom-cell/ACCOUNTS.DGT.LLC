import postgres from 'postgres';

import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
const devUrl = resolveDbUrl("dev");
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name ILIKE '%branch%';
    `;
    console.log("Branch tables:\n", tables);

    // Also check enterprise_branches, country_branches etc.
    const res = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    console.log("All tables:\n", res.map(r => r.table_name).sort());
  } finally {
    await sql.end();
  }
}

main();
