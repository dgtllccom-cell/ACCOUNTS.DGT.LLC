import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  console.log("=== ALL UAE city_branches ===");
  const ae = (await sql`SELECT id,name FROM public.countries WHERE iso2='AE' AND deleted_at IS NULL`)[0];
  console.log("UAE country id:", ae?.id);
  const cbs = await sql`SELECT id, name, code, country_branch_id FROM public.city_branches WHERE deleted_at IS NULL AND country_id=${ae.id} ORDER BY name`;
  for (const r of cbs) console.log(`  ${r.id}  "${r.name}" (${r.code})`);

  console.log("\n=== city_branch 79b31aba-45f1-4aba-9068-fb3eb2102a81 ? ===");
  console.log(JSON.stringify(await sql`SELECT id,name,code,country_id,country_branch_id FROM public.city_branches WHERE id='79b31aba-45f1-4aba-9068-fb3eb2102a81'`));

  console.log("\n=== enterprise_accounts under city_branch 79b31aba (the DALIAN SUNSHINE branch) ===");
  const sib = await sql`SELECT id, name, code, kind, currency, scope, current_balance, customer_id, parent_id
    FROM public.enterprise_accounts WHERE deleted_at IS NULL AND city_branch_id='79b31aba-45f1-4aba-9068-fb3eb2102a81' ORDER BY code`;
  for (const r of sib) console.log(`  [${r.kind}/${r.currency}] "${r.name}" code=${r.code} bal=${r.current_balance} cust=${r.customer_id||'-'} parent=${r.parent_id||'-'} id=${r.id}`);

  console.log("\n=== customers columns ===");
  const cc = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' ORDER BY ordinal_position`;
  console.log(cc.map(c=>c.column_name).join(", "));

  console.log("\n=== customers DAMMAN/DALIAN ===");
  const cu = await sql`SELECT id, customer_name, company_name, customer_code, country_id, email, mobile
    FROM public.customers WHERE deleted_at IS NULL AND (
      customer_name ILIKE ANY(ARRAY['%damman%','%damaan%','%dalian%','%sunshine%'])
      OR company_name ILIKE ANY(ARRAY['%damman%','%damaan%','%dalian%','%sunshine%']))`;
  for (const r of cu) console.log(`  "${r.customer_name}" / "${r.company_name}" code=${r.customer_code} email=${r.email} id=${r.id}`);
});
