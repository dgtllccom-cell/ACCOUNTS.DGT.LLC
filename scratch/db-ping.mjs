import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => { const r = await sql`SELECT count(*)::int n FROM public.employees WHERE deleted_at IS NULL`; console.log("employees:", r[0].n); });
process.exit(0);
