import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const j = await sql`SELECT job_no, status, doc_type_code, doc_type_confidence, ocr_engine, ocr_ms, error, match_status, qvc_reason FROM public.document_intake_jobs WHERE id = '403b34ae-2890-489f-b983-8969ab23468b'`;
  console.log(JSON.stringify(j[0]));
  const f = await sql`SELECT field_key, normalized_value, validation_status FROM public.document_intake_fields WHERE job_id='403b34ae-2890-489f-b983-8969ab23468b' ORDER BY field_key`;
  console.log("fields:", f.length, JSON.stringify(f.map(x=>x.field_key)));
});
process.exit(0);
