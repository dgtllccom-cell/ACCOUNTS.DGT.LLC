import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  console.log("=== ALL enterprise_accounts in UAE (country 935dd0b9) ===");
  const ea = await sql`SELECT id, scope, name, code, kind, currency, city_branch_id, country_branch_id, current_balance, customer_id
    FROM public.enterprise_accounts WHERE deleted_at IS NULL AND country_id='935dd0b9-8228-43b3-b53d-c06e9ae2882f' ORDER BY code`;
  for (const r of ea) console.log(`  [${r.scope}/${r.kind}/${r.currency}] "${r.name}" code=${r.code} bal=${r.current_balance} cb=${r.city_branch_id?'city':'-'} cust=${r.customer_id||'-'} id=${r.id}`);

  console.log("\n=== ledgers table: any 'purchase' / 'al ras' / UAE ===");
  const lc = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ledgers' ORDER BY ordinal_position`;
  console.log("ledgers cols:", lc.map(c=>c.column_name).join(", "));
  const lg = await sql`SELECT * FROM public.ledgers WHERE deleted_at IS NULL AND (
     ledger_name ILIKE ANY(ARRAY['%purchase%','%al ras%','%al raz%','%dalian%','%damman%','%walnut%']) )
     ORDER BY ledger_name LIMIT 40`.catch(e=>[{ERR:e.message}]);
  console.log(JSON.stringify(lg, null, 1).slice(0, 3000));

  console.log("\n=== customers DAMMAN / DALIAN ===");
  const cu = await sql`SELECT id, customer_name, company_name, contact_person, country_id, email, mobile, person_code
    FROM public.customers WHERE deleted_at IS NULL AND (
      customer_name ILIKE ANY(ARRAY['%damman%','%damaan%','%dalian%','%sunshine%','%general trading%'])
      OR company_name ILIKE ANY(ARRAY['%damman%','%damaan%','%dalian%','%sunshine%','%general trading%']))`;
  for (const r of cu) console.log(`  "${r.customer_name}" / co="${r.company_name}" contact=${r.contact_person} email=${r.email} mob=${r.mobile} id=${r.id}`);
});
