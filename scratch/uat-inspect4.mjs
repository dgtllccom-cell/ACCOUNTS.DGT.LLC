import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  console.log("=== enterprise_accounts: Al Ras / Al Raz / Purchase / DAMMAN / DALIAN ===");
  const ea = await sql`SELECT id, scope, name, code, kind, currency, parent_id, country_id, country_branch_id, city_branch_id, current_balance, customer_id, status
    FROM public.enterprise_accounts
    WHERE deleted_at IS NULL AND (
      name ILIKE ANY(ARRAY['%al ras%','%al raz%','%alras%','%al-ras%','%damman%','%damaan%','%dalian%','%sunshine%','%walnut%'])
      OR name ILIKE '%purchase%'
    ) ORDER BY name`;
  for (const r of ea) console.log(`- [${r.scope}/${r.kind}/${r.currency}] "${r.name}" code=${r.code} bal=${r.current_balance} parent=${r.parent_id||'-'} city_branch=${r.city_branch_id||'-'} cust=${r.customer_id||'-'} id=${r.id}`);

  console.log("\n=== city_branches (looking for Al Ras / Dubai) ===");
  const cb = await sql`SELECT id, name, code, country_id, country_branch_id FROM public.city_branches
    WHERE deleted_at IS NULL AND (name ILIKE ANY(ARRAY['%ras%','%dubai%','%raz%'])) ORDER BY name`;
  for (const r of cb) console.log(`- "${r.name}" code=${r.code} id=${r.id} country=${r.country_id}`);

  console.log("\n=== customers: DAMMAN / DAMAAN / DALIAN / SUNSHINE ===");
  const cu = await sql`SELECT id, customer_name, company_name, customer_type, customer_code, country_id, email, mobile
    FROM public.customers WHERE deleted_at IS NULL AND (
      customer_name ILIKE ANY(ARRAY['%damman%','%damaan%','%dalian%','%sunshine%'])
      OR company_name ILIKE ANY(ARRAY['%damman%','%damaan%','%dalian%','%sunshine%']))
    ORDER BY customer_name`;
  for (const r of cu) console.log(`- "${r.customer_name}" / "${r.company_name}" type=${r.customer_type} code=${r.customer_code} email=${r.email} id=${r.id}`);

  console.log("\n=== countries (UAE id) ===");
  console.log(JSON.stringify(await sql`SELECT id, name, iso2 FROM public.countries WHERE deleted_at IS NULL AND (name ILIKE '%emirat%' OR iso2='AE')`));
});
