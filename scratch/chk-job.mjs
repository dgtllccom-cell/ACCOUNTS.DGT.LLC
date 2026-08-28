import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const j = await sql`SELECT job_no, status, doc_type_code, doc_type_confidence, match_status, qvc_reason, ocr_engine, ocr_ms FROM public.document_intake_jobs WHERE id = 'd11b3e89-b384-4bb0-8021-3bf8ac89c496'`;
  console.log("job:", JSON.stringify(j[0]));
  const f = await sql`SELECT field_key, normalized_value, raw_value, validation_status, confidence FROM public.document_intake_fields WHERE job_id = 'd11b3e89-b384-4bb0-8021-3bf8ac89c496' ORDER BY field_key`;
  console.log("fields:", JSON.stringify(f));
});
process.exit(0);
