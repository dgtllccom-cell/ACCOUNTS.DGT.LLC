import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const t = await sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type ty ON ty.oid=e.enumtypid WHERE ty.typname='roznamcha_type'`;
  console.log("roznamcha_type:", t.map(x=>x.enumlabel).join(", "));
  const st = await sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type ty ON ty.oid=e.enumtypid WHERE ty.typname LIKE '%roznamcha%status%' OR ty.typname='roznamcha_status'`;
  console.log("status enum:", st.map(x=>x.enumlabel).join(", "));
  const pt = await sql`SELECT DISTINCT payment_entry_type::text FROM public.roznamcha_lines LIMIT 5`.catch(e=>e.message);
  console.log("payment_entry_type sample:", JSON.stringify(pt));
});
process.exit(0);
