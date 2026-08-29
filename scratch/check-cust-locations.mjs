import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const custs = await sql`
      SELECT c.id, c.customer_name, c.country_id, cnt.name as country_name, c.state_province_id, sp.name as state_name, c.city_id, ct.name as city_name, c.notes
      FROM public.customers c
      LEFT JOIN public.countries cnt ON c.country_id = cnt.id
      LEFT JOIN public.states_provinces sp ON c.state_province_id = sp.id
      LEFT JOIN public.cities ct ON c.city_id = ct.id
      WHERE c.deleted_at IS NULL;
    `;
    console.table(custs);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
