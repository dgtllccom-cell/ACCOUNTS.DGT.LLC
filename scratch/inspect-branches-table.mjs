import postgres from 'postgres';

import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
const devUrl = resolveDbUrl("dev");
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    const branches = await sql`
      SELECT id, name, code, country_id FROM public.branches LIMIT 5;
    `;
    console.log("Branches sample:\n", branches);

    const cityBranches = await sql`
      SELECT id, name, code, country_id FROM public.city_branches LIMIT 5;
    `;
    console.log("City Branches sample:\n", cityBranches);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

main();
