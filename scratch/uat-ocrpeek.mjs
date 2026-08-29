import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const j = (await sql`SELECT id, job_no, contract_reference, document_reference, extraction_summary, country_id, country_branch_id, city_branch_id, operational_domain FROM public.document_intake_jobs WHERE id='56c876c0-aef5-4247-820d-e7be022aa22f'`)[0];
  console.log("job refs:", j.contract_reference, "|", j.document_reference);
  console.log("summary:", JSON.stringify(j.extraction_summary));
  const ev = await sql`SELECT event_type, payload, created_at FROM public.document_intake_events WHERE job_id=${j.id} ORDER BY created_at`;
  for (const e of ev) console.log(" evt", e.event_type, JSON.stringify(e.payload).slice(0,160));
});
