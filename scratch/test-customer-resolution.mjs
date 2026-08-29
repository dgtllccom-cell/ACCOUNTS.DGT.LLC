import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("=== TESTING CUSTOMER DATA & RESOLUTION ===");
    const rows = await sql`
      SELECT 
        c.id, c.person_code, c.customer_name, c.father_name, c.mobile, c.email,
        cnt.name as country_name,
        rt.pashto_text, rt.urdu_text, rt.arabic_text
      FROM public.customers c
      LEFT JOIN public.countries cnt ON c.country_id = cnt.id
      LEFT JOIN public.record_translations rt ON rt.record_table = 'customers' AND rt.record_id = c.id AND rt.field_name = 'customer_name'
      WHERE c.deleted_at IS NULL
      ORDER BY c.person_code ASC;
    `;
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
