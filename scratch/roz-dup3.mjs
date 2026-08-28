import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const src = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='post_roznamcha_entry'`;
  const d = src[0].d;
  const i = d.indexOf('debit_total <> ');
  const j = d.search(/voucher_no|reference_no|existing|duplicate|unique/i);
  console.log("--- section with voucher/dup check ---");
  console.log(d.slice(2600, 4200));
});
process.exit(0);
