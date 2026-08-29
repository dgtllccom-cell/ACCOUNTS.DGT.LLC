import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  console.log("=== ledgers linked to DALIAN SUNSHINE (44c0308d) or UAE purchase ===");
  const lg = await sql`SELECT id, code, name, currency, enterprise_account_id, account_id, normal_balance, current_balance, country_id, city_branch_id
    FROM public.ledgers WHERE deleted_at IS NULL AND (
      enterprise_account_id IN ('44c0308d-5c4e-4497-b9b8-0af7c02e7276','2511508e-3df0-4468-a284-0b68693949f0')
      OR name ILIKE ANY(ARRAY['%dalian%','%purchase%','%payable%']) AND country_id='935dd0b9-8228-43b3-b53d-c06e9ae2882f'
    ) ORDER BY name`;
  for (const r of lg) console.log(`  "${r.name}" code=${r.code} cur=${r.currency} ea=${r.enterprise_account_id||'-'} nb=${r.normal_balance} bal=${r.current_balance} id=${r.id}`);

  console.log("\n=== ALL UAE ledgers ===");
  const all = await sql`SELECT id, code, name, currency, enterprise_account_id, normal_balance FROM public.ledgers WHERE deleted_at IS NULL AND country_id='935dd0b9-8228-43b3-b53d-c06e9ae2882f' ORDER BY name`;
  for (const r of all) console.log(`  "${r.name}" code=${r.code} cur=${r.currency} ea=${r.enterprise_account_id?'Y':'-'} nb=${r.normal_balance} id=${r.id}`);

  console.log("\n=== post_purchase_booking_transfer proc ===");
  const p = await sql`SELECT pg_get_function_identity_arguments(oid) args FROM pg_proc WHERE proname='post_purchase_booking_transfer'`;
  console.log(p.map(x=>x.args).join("\n"));
});
