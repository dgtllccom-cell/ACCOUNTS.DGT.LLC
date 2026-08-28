import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT count(*) FILTER (WHERE salary_expense_account_id IS NOT NULL AND employee_payable_account_id IS NOT NULL) mapped, count(*) total FROM public.employees WHERE deleted_at IS NULL AND status='Active' AND city_branch_id='6867d9b1-d6c0-4aed-aff9-e924d04ef202'`;
  console.log(JSON.stringify(r[0]));
});
process.exit(0);
