import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchase_orders' ORDER BY ordinal_position`;
  console.log("purchase_orders columns:\n", cols.map(c=>`${c.column_name}:${c.data_type}`).join("\n "));
  console.log("\n=== sample recent purchase_orders (UAE or any) ===");
  const po = await sql`SELECT id, purchase_order_no, purchase_contract_no, supplier_name, purchase_currency, currency_code, exchange_rate, order_total, status, country_id, city_branch_id, created_at
    FROM public.purchase_orders WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`;
  for (const r of po) console.log(JSON.stringify(r));
});
