import { withLocalPg } from "@/lib/db/local-postgres";
import fs from "node:fs";
await withLocalPg(async (sql) => {
  for (const fn of ['post_roznamcha_entry']) {
    const d = (await sql`SELECT pg_get_functiondef(oid) d, pg_get_function_identity_arguments(oid) a FROM pg_proc WHERE proname=${fn}`);
    for (const x of d) { fs.writeFileSync(`scratch/${fn}.sql`, x.d); console.log(`${fn}(${x.a})  -> ${x.d.length} bytes`); }
  }
  // base currency concept
  console.log("\ncountries currency:", JSON.stringify(await sql`SELECT name, iso2, currency_code FROM public.countries WHERE deleted_at IS NULL ORDER BY name`));
  // how many multi-currency POs exist historically
  const mc = await sql`SELECT count(*)::int total,
    count(*) FILTER (WHERE purchase_currency IS DISTINCT FROM currency_code)::int pur_ne_ccy,
    count(*) FILTER (WHERE exchange_rate <> 1)::int rate_ne_1,
    count(*) FILTER (WHERE payment_currency IS DISTINCT FROM purchase_currency)::int pay_ne_pur
    FROM public.purchase_orders WHERE deleted_at IS NULL`;
  console.log("PO currency spread:", JSON.stringify(mc[0]));
});
