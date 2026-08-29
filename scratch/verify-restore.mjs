import { withLocalPg } from "../lib/db/local-postgres.ts";
import { hrReportsService } from "../lib/services/hr-reports-service";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT e.employee_code, public.hr_employee_currency(e.id) cur, e.country_id IS NOT NULL has_co
    FROM public.employees e WHERE e.id IN ('11fba42f-1404-459b-ba39-9baeaddac7e7','e19368fb-c6a8-4158-b19c-b4020d5e1bdb')`;
  console.log("currency after restore:", JSON.stringify(r));
});
const d = await hrReportsService.run("employee_directory", {}, { countryIds: null, countryBranchIds: null, cityBranchIds: null });
const dubai = d.rows.filter(x => (x.employee_code||'').includes('DUBAI'));
console.log("directory Dubai rows:", dubai.length, "| sample:", JSON.stringify(dubai[0]));
process.exit(0);
