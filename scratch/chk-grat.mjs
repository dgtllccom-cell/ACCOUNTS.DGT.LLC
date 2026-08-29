import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='hr_gratuity_settlements' ORDER BY ordinal_position`;
  const s = await sql`SELECT * FROM public.hr_gratuity_settlements WHERE id='fa60791d-d5d3-4193-9cac-d532605e0357'`;
  const row = s[0];
  console.log("settlement:", JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k,v])=>v!==null && !['id','created_at','updated_at','created_by'].includes(k)))));
});
process.exit(0);
