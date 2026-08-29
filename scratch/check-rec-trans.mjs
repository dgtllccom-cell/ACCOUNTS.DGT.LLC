import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'record_translations'
      ORDER BY ordinal_position;
    `;
    console.table(cols);

    const count = await sql`SELECT count(*) FROM public.record_translations`;
    console.log("Total record_translations count:", count[0].count);

    const sample = await sql`SELECT * FROM public.record_translations LIMIT 5`;
    console.log("Sample:", sample);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
