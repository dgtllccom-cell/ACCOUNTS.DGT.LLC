import { withLocalPg } from "@/lib/db/local-postgres";
import fs from "node:fs";
await withLocalPg(async (sql) => {
  const d = (await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='post_purchase_order_payment'`)[0].d;
  fs.writeFileSync("scratch/post_purchase_order_payment.sql", d + "\n");
  console.log("bytes", d.length);
  // show the exact lines around the case
  const i = d.indexOf("case\n      when v_currency");
  console.log(d.slice(i-200, i+260));
});
