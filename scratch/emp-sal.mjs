import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const e = await sql`SELECT count(*) FILTER (WHERE status='Active') active, count(*) FILTER (WHERE COALESCE(basic_salary,monthly_salary,0)>0) with_salary, count(*) total FROM public.employees WHERE deleted_at IS NULL`;
  console.log("employees:", JSON.stringify(e[0]));
  const s = await sql`SELECT employee_code, status, basic_salary, monthly_salary, allowance, country_id, city_branch_id FROM public.employees WHERE deleted_at IS NULL AND status='Active' AND COALESCE(basic_salary,monthly_salary,0)>0 LIMIT 3`;
  console.log("sample with salary:", JSON.stringify(s));
  // any with a country that has a branch?
  const cb = await sql`SELECT e.country_id, e.city_branch_id, count(*) n FROM public.employees e WHERE e.deleted_at IS NULL AND e.status='Active' GROUP BY 1,2 ORDER BY n DESC LIMIT 3`;
  console.log("by scope:", JSON.stringify(cb));
});
process.exit(0);
