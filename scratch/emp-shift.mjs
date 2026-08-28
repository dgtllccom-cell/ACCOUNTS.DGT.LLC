import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const e = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND (column_name ILIKE '%shift%' OR column_name ILIKE '%department%' OR column_name ILIKE '%branch%' OR column_name ILIKE '%country%')`;
  console.log("employees shift/scope cols:", e.map(x=>x.column_name).join(", "));
  const s = await sql`SELECT count(*)::int n FROM public.hr_shifts WHERE deleted_at IS NULL`;
  console.log("shifts:", s[0].n);
  const h = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hr_holidays' ORDER BY ordinal_position`;
  console.log("hr_holidays:", h.map(x=>x.column_name).join(", "));
  const prl = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hr_payroll_run_lines' ORDER BY ordinal_position`;
  console.log("\nhr_payroll_run_lines:", prl.map(x=>x.column_name).join(", "));
  const pr = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hr_payroll_runs' ORDER BY ordinal_position`;
  console.log("\nhr_payroll_runs:", pr.map(x=>x.column_name).join(", "));
});
process.exit(0);
