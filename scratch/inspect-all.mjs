import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';

const prodUrl = resolveDbUrl("prod");
const sql = postgres(prodUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("=== PROD ALL CUSTOMERS ===");
    const custs = await sql`
      SELECT id, customer_name, company_name, contact_person, mobile, email, deleted_at, is_active, original_language_code, notes
      FROM public.customers
      ORDER BY created_at ASC;
    `;
    console.table(custs);

    console.log("\n=== PROD ALL EMPLOYEES ===");
    const emps = await sql`
      SELECT e.id, e.employee_code, e.person_master_id, e.category, e.designation, e.department, e.status, e.deleted_at
      FROM public.employees e
      ORDER BY e.employee_code ASC;
    `;
    console.table(emps);

  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
