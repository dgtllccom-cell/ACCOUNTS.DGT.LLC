import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  // create a Salary Expense ledger master for UAE (config, like the new-ledger form)
  const existing = await sql`SELECT id FROM public.ledgers WHERE code='UAE-SALARY-EXPENSE' AND deleted_at IS NULL`;
  let expId;
  if (existing.length) { expId = existing[0].id; console.log("expense ledger exists", expId); }
  else {
    const [r] = await sql`INSERT INTO public.ledgers (scope, country_id, country_branch_id, city_branch_id, code, name, currency, normal_balance, is_active, created_by)
      VALUES ('country', '935dd0b9-8228-43b3-b53d-c06e9ae2882f', NULL, NULL, 'UAE-SALARY-EXPENSE', 'UAE Salary & Wages Expense', 'AED', 'debit', true, (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1)) RETURNING id`;
    expId = r.id; console.log("created salary expense ledger", expId);
  }
  console.log("PAYABLE_LEDGER=61ab54d8-9e6a-4e2f-9604-9922a9598d53");
  console.log("EXPENSE_LEDGER=" + expId);
});
process.exit(0);
