import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='employee_salaries_due' ORDER BY ordinal_position`;
  console.log(c.map(x=>`${x.column_name}:${x.data_type}`).join(", "));
});
process.exit(0);
