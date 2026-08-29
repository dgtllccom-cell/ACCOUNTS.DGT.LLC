import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const p = await sql`SELECT id, full_name FROM public.profiles WHERE deleted_at IS NULL ORDER BY created_at LIMIT 5`;
  console.log(JSON.stringify(p));
});
