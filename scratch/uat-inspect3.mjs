import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  for (const t of ["enterprise_accounts","ledgers"]) {
    const cols = await sql`SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`;
    console.log(`\n### ${t}: ${cols.map(c=>c.column_name).join(", ")}`);
  }

  console.log("\n=== enterprise_accounts matching Al Ras/Raz/DAMMAN/DALIAN/Purchase ===");
  const ea = await sql`SELECT * FROM public.enterprise_accounts
    WHERE deleted_at IS NULL AND (
      name ILIKE ANY(ARRAY['%al ras%','%al raz%','%alras%','%damman%','%damaan%','%dalian%','%sunshine%','%purchase%','%walnut%'])
      OR account_number ILIKE ANY(ARRAY['%alras%','%alraz%','%damman%','%purchase%'])
    ) ORDER BY name LIMIT 40`.catch(async e => {
      console.log("(name col missing:", e.message, "- trying generic)");
      return sql`SELECT * FROM public.enterprise_accounts WHERE deleted_at IS NULL LIMIT 3`;
    });
  console.log(JSON.stringify(ea, null, 1));
});
