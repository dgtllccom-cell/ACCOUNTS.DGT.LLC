import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from 'postgres';
import fs from 'fs';

const dbUrl = resolveDbUrl("dev");
const sql = postgres(dbUrl, { ssl: 'require' });

async function main() {
  try {
    console.log("Checking columns of public.customers...");
    const customerCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'customers'
      ORDER BY ordinal_position;
    `;
    console.log("Customer columns:", customerCols.map(c => c.column_name).join(", "));

    console.log("\nChecking count in customers...");
    const custCount = await sql`SELECT count(*) FROM public.customers WHERE deleted_at IS NULL`;
    console.log("Total active customers:", custCount[0].count);

    console.log("\nChecking rows in customers...");
    const custs = await sql`SELECT id, customer_name, father_name, person_code, mobile, email, created_at FROM public.customers WHERE deleted_at IS NULL LIMIT 10`;
    console.table(custs);

    console.log("\nChecking employees...");
    const emps = await sql`
      SELECT e.id, e.employee_code, e.person_master_id, e.category, e.designation, e.department, e.created_at
      FROM public.employees e
      WHERE e.deleted_at IS NULL
      LIMIT 15;
    `;
    console.table(emps);

  } catch (err) {
    console.error("Diagnostic error:", err);
  } finally {
    await sql.end();
  }
}

main();
