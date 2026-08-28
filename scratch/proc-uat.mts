import { documentIntakeService } from "../lib/services/document-intake-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";
const g: IntakeScope = { domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true };
const ID = "d11b3e89-b384-4bb0-8021-3bf8ac89c496";
// reset stuck status
import { withLocalPg } from "../lib/db/local-postgres";
await withLocalPg(async (sql) => { await sql`UPDATE public.document_intake_jobs SET status='uploaded', error=NULL WHERE id=${ID}`; });
const r = await documentIntakeService.processJob(ID, "00000000-0000-0000-0000-000000000000", "UAT", g);
console.log("processed:", JSON.stringify(r));
const d = await documentIntakeService.get(ID, g);
console.log("status:", d?.job.status, "| docType:", d?.job.doc_type_code, "@", d?.job.doc_type_confidence, "| match:", d?.job.match_status, "| qvc:", d?.job.qvc_reason);
console.log("engine:", d?.job.ocr_engine, d?.job.ocr_ms + "ms");
for (const f of d?.fields ?? []) console.log(`  [${f.validation_status}] ${f.field_key} = ${JSON.stringify(f.normalized_value ?? f.raw_value)} (${Math.round((f.confidence||0)*100)}%)`);
process.exit(0);
