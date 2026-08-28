import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const s = await sql`SELECT id, code, name, country_id, city_branch_id, start_time, end_time, break_minutes, grace_minutes, is_active FROM public.hr_shifts WHERE deleted_at IS NULL`;
  console.log("shifts:", JSON.stringify(s));
  const e = await sql`SELECT id, country_id, city_branch_id, working_shift FROM public.employees WHERE id = 'e187f4c6-42d3-4182-8dc3-e94a74411768'`;
  console.log("emp:", JSON.stringify(e[0]));
  const match = await sql`
    SELECT s.id, s.name, s.start_time, s.end_time, s.break_minutes, s.grace_minutes
    FROM public.hr_shifts s
    JOIN public.employees e ON e.id = ${e[0].id}
    WHERE s.deleted_at IS NULL AND s.is_active
      AND (s.country_id IS NULL OR s.country_id = e.country_id)
      AND (s.city_branch_id IS NULL OR s.city_branch_id = e.city_branch_id)
      AND (lower(s.name) = lower(coalesce(e.working_shift,'')) OR lower(s.code) = lower(coalesce(e.working_shift,'')) OR e.working_shift IS NULL)
    ORDER BY (lower(s.name) = lower(coalesce(e.working_shift,''))) DESC, s.city_branch_id NULLS LAST, s.country_id NULLS LAST
    LIMIT 1`;
  console.log("fallback match:", JSON.stringify(match));
});
process.exit(0);
