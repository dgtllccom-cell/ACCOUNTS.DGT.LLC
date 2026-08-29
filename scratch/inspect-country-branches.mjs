import postgres from 'postgres';

import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
const devUrl = resolveDbUrl("dev");
const sql = postgres(devUrl, { ssl: 'require' });

async function main() {
  try {
    const cb = await sql`
      SELECT id, name, code, country_id FROM public.country_branches LIMIT 5;
    `;
    console.log("country_branches sample:\n", cb);

    const cityb = await sql`
      SELECT id, name, code, country_id, country_branch_id FROM public.city_branches LIMIT 5;
    `;
    console.log("city_branches sample:\n", cityb);
  } finally {
    await sql.end();
  }
}

main();
