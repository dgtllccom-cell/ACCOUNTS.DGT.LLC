import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  for (const t of ["office_attendance","office_leave_requests"]) {
    const c = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`;
    console.log(`\n=== ${t} ===\n`+c.map(x=>`${x.column_name}:${x.data_type}`).join(", "));
    const n = await sql.unsafe(`SELECT count(*)::int n FROM public.${t} WHERE deleted_at IS NULL`);
    console.log("rows:", n[0].n);
  }
  const lb = await sql`SELECT count(*)::int n FROM public.hr_employee_leave_balances WHERE deleted_at IS NULL`;
  console.log("\nleave balances rows:", lb[0].n);
  const pr = await sql`SELECT count(*)::int n FROM public.hr_payroll_runs WHERE deleted_at IS NULL`;
  console.log("payroll runs:", pr[0].n);
});
process.exit(0);
