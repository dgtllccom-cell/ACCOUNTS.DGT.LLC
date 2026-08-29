import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  console.log("ledger_direction:", (await sql`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ledger_direction'`).map(r=>r.enumlabel).join(","));
  const d = (await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='assert_financial_period_open'`);
  console.log(d[0]?.d?.slice(0, 1400) || "(not found)");
  // countries table required cols
  const cc = (await sql`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='countries' AND is_nullable='NO'`).map(r=>r.column_name);
  console.log("\ncountries NOT NULL:", cc.join(","));
  const cbc = (await sql`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='country_branches' AND is_nullable='NO'`).map(r=>r.column_name);
  console.log("country_branches NOT NULL:", cbc.join(","));
  const cibc = (await sql`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='city_branches' AND is_nullable='NO'`).map(r=>r.column_name);
  console.log("city_branches NOT NULL:", cibc.join(","));
});
