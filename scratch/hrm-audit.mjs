import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const tabs = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE 'hr_%' OR table_name ILIKE 'employee%') ORDER BY table_name`;
  console.log("HR tables:", tabs.map(t=>t.table_name).join(", "));
  // leave
  const lb = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hr_leave_balances' ORDER BY ordinal_position`;
  console.log("\nhr_leave_balances:", lb.map(c=>c.column_name).join(", ") || "(none)");
  const lr = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hr_leave_requests' ORDER BY ordinal_position`;
  console.log("hr_leave_requests:", lr.map(c=>c.column_name).join(", ") || "(none)");
  // attendance
  const at = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hr_attendance' ORDER BY ordinal_position`;
  console.log("hr_attendance:", at.map(c=>c.column_name).join(", ") || "(none)");
  // employees user link
  const em = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND (column_name ILIKE '%user%' OR column_name ILIKE '%person%')`;
  console.log("\nemployees person/user cols:", em.map(c=>c.column_name).join(", ") || "(none)");
  const fns = await sql`SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND (routine_name ILIKE '%leave%' OR routine_name ILIKE '%attendance%' OR routine_name ILIKE '%payroll%' OR routine_name ILIKE 'hr_%')`;
  console.log("\nHR functions:", fns.map(f=>f.routine_name).join(", "));
});
process.exit(0);
