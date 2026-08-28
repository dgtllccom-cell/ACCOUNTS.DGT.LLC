import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT country_id, count(*)::int n FROM public.employees WHERE deleted_at IS NULL AND country_id IS NOT NULL GROUP BY country_id`;
  console.log("countries with employees:", JSON.stringify(c));
  // manually run the seed insert
  const r = await sql`
    INSERT INTO public.hr_shifts (code, name, country_id, start_time, end_time, break_minutes, grace_minutes, working_days, is_night_shift, is_active)
    SELECT 'DAY', 'Day Shift', c.country_id, time '09:00', time '17:00', 60, 15, 'Mon-Fri', false, true
    FROM (SELECT DISTINCT country_id FROM public.employees WHERE deleted_at IS NULL AND country_id IS NOT NULL) c
    WHERE NOT EXISTS (SELECT 1 FROM public.hr_shifts s WHERE s.country_id = c.country_id AND s.deleted_at IS NULL)
    RETURNING id, country_id`;
  console.log("inserted:", JSON.stringify(r));
});
process.exit(0);
