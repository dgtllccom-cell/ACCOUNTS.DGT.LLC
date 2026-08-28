import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const co = await sql`SELECT id, name FROM public.countries WHERE deleted_at IS NULL AND name IN ('United Arab Emirates','Afghanistan','Pakistan') ORDER BY name`;
  console.log(JSON.stringify(co));
  // the UAT job's country
  const j = await sql`SELECT country_id FROM public.document_intake_jobs WHERE id = 'd11b3e89-b384-4bb0-8021-3bf8ac89c496'`;
  console.log("UAT job country:", j[0].country_id);
  // handover country
  const h = await sql`SELECT handover_no, country_id FROM public.business_shipping_handovers ORDER BY created_at DESC LIMIT 1`;
  console.log("handover:", JSON.stringify(h[0]));
});
process.exit(0);
