import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const f = await sql`SELECT pg_get_function_arguments(oid) args, pg_get_function_result(oid) ret FROM pg_proc WHERE proname = 'hr_payroll_tax_for'`;
  console.log("hr_payroll_tax_for:", JSON.stringify(f));
  const c = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='hr_payroll_tax_config' AND column_name='effective_from'`;
  console.log("effective_from:", JSON.stringify(c));
});
process.exit(0);
