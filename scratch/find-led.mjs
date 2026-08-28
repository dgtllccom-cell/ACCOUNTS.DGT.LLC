import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const l = await sql`SELECT id, name, code, scope, city_branch_id, normal_balance, currency FROM public.ledgers
    WHERE deleted_at IS NULL AND country_id='935dd0b9-8228-43b3-b53d-c06e9ae2882f'
      AND (name ILIKE '%salary%' OR name ILIKE '%payroll%' OR name ILIKE '%payable%' OR name ILIKE '%expense%' OR name ILIKE '%wage%')`;
  console.log("salary-ish ledgers:", JSON.stringify(l));
  // any ledger at the dubai city branch 6867d9b1?
  const b = await sql`SELECT id, name, normal_balance FROM public.ledgers WHERE deleted_at IS NULL AND city_branch_id='6867d9b1-d6c0-4aed-aff9-e924d04ef202' LIMIT 5`;
  console.log("dubai-branch ledgers:", JSON.stringify(b));
  const cnt = await sql`SELECT scope, count(*) n FROM public.ledgers WHERE deleted_at IS NULL AND country_id='935dd0b9-8228-43b3-b53d-c06e9ae2882f' GROUP BY 1`;
  console.log("UAE ledger scopes:", JSON.stringify(cnt));
});
process.exit(0);
