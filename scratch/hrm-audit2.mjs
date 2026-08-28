import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  for (const t of ["hr_employee_leave_balances","hr_leave_types","hr_shifts","hr_attendance_corrections"]) {
    const c = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`;
    console.log(`\n=== ${t} ===\n`+c.map(x=>`${x.column_name}:${x.data_type}`).join(", "));
  }
  const att = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%attendance%'`;
  console.log("\nattendance tables:", att.map(t=>t.table_name).join(", "));
  const lv = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%leave%'`;
  console.log("leave tables:", lv.map(t=>t.table_name).join(", "));
});
process.exit(0);
