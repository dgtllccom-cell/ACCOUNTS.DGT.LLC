import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const ra = await sql`SELECT role, country_id IS NOT NULL has_co, country_branch_id IS NOT NULL has_cb, city_branch_id IS NOT NULL has_city, count(*) n
    FROM public.user_role_assignments WHERE deleted_at IS NULL AND is_active GROUP BY 1,2,3,4 ORDER BY role`;
  for (const r of ra) console.log(`${r.role.padEnd(22)} co=${r.has_co} cb=${r.has_cb} city=${r.has_city}  n=${r.n}`);
});
process.exit(0);
