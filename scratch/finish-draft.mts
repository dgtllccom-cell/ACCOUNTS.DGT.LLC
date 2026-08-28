import { documentIntakeService } from "../lib/services/document-intake-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";
const g: IntakeScope = { domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true };
const JOB = "d11b3e89-b384-4bb0-8021-3bf8ac89c496";
const A = "00000000-0000-0000-0000-000000000000";
const d0 = await documentIntakeService.get(JOB, g);
for (const f of d0?.fields ?? []) {
  if (!f.verified) await documentIntakeService.updateField(JOB, f.field_key, { verified: true }, A, "UAT", g);
}
const cd = await documentIntakeService.confirmDraft(JOB, { linkMode: "append_existing" }, A, "UAT", g);
console.log("confirmDraft:", JSON.stringify(cd));
const d1 = await documentIntakeService.get(JOB, g);
console.log("job status:", d1?.job.status, "| draft_ref:", d1?.job.draft_reference);
const drafts = await documentIntakeService.listDrafts(g, { targetModule: "purchase_orders" });
const mine = drafts.find((x:any)=>x.job_id===JOB);
console.log("draft payload:", JSON.stringify(mine?.draft_payload));
console.log("link_mode:", mine?.link_mode, "linked_source_id:", mine?.linked_source_id);
process.exit(0);
