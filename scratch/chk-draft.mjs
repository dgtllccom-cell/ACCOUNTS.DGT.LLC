import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const j = await sql`SELECT status, match_status, matched_source_module, matched_source_id, draft_id, draft_reference, target_module FROM public.document_intake_jobs WHERE id = 'd11b3e89-b384-4bb0-8021-3bf8ac89c496'`;
  console.log("job:", JSON.stringify(j[0]));
  const dr = await sql`SELECT draft_no, target_module, link_mode, linked_source_id, status, draft_payload FROM public.document_intake_drafts WHERE job_id = 'd11b3e89-b384-4bb0-8021-3bf8ac89c496'`;
  console.log("draft:", JSON.stringify(dr[0]));
  const ev = await sql`SELECT action FROM public.document_intake_events WHERE job_id = 'd11b3e89-b384-4bb0-8021-3bf8ac89c496' ORDER BY created_at`;
  console.log("events:", ev.map(e=>e.action).join(" → "));
});
process.exit(0);
