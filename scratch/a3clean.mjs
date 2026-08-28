import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => { await sql`DELETE FROM public.hr_payroll_run_lines WHERE run_id IN (SELECT id FROM public.hr_payroll_runs WHERE run_no LIKE 'RECON-TEST%')`; const r = await sql`DELETE FROM public.hr_payroll_runs WHERE run_no LIKE 'RECON-TEST%'`; console.log("deleted runs", r.count); });
process.exit(0);
