import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT table_name FROM information_schema.columns WHERE column_name='country_id' AND table_name IN ('customers','employees','office_attendance','office_leave_requests')`;
  console.log(c.map(x=>x.table_name));
});
process.exit(0);
