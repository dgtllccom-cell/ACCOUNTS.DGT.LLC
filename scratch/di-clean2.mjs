import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  await sql`DELETE FROM public.document_intake_drafts WHERE job_id IN (SELECT id FROM public.document_intake_jobs WHERE original_filename IN ('http-uat.png','uat-invoice.png'))`;
  const r = await sql`DELETE FROM public.document_intake_jobs WHERE original_filename IN ('http-uat.png','uat-invoice.png')`;
  console.log("deleted DI test jobs:", r.count);
  const rem = await sql`SELECT count(*)::int n FROM public.document_intake_jobs WHERE deleted_at IS NULL`;
  console.log("remaining jobs:", rem[0].n);
});
process.exit(0);
