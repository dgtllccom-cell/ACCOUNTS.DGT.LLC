import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    const custs = await sql`
      SELECT id, customer_name, contact_person, mobile, email, original_language_code, deleted_at, is_active, notes, first_name, last_name, gender
      FROM public.customers
      ORDER BY created_at ASC;
    `;
    for (const c of custs) {
      console.log("-----------------------------------------");
      console.log(`ID: ${c.id}`);
      console.log(`Name: ${c.customer_name}`);
      console.log(`Contact Person: ${c.contact_person}`);
      console.log(`Mobile: ${c.mobile}`);
      console.log(`Email: ${c.email}`);
      console.log(`Language: ${c.original_language_code}`);
      console.log(`Deleted: ${c.deleted_at}`);
      console.log(`Active: ${c.is_active}`);
      console.log(`Notes: ${c.notes}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
