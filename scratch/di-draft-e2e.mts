import sharp from "sharp";
import { withLocalPg } from "../lib/db/local-postgres";
import { documentIntakeService } from "../lib/services/document-intake-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";

const globalScope: IntakeScope = {
  domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true,
};
const ACTOR = "00000000-0000-0000-0000-000000000000";

async function invoicePng(): Promise<Buffer> {
  const lines = [
    "COMMERCIAL INVOICE",
    "Invoice No: INV-2026-9001   Date: 03/08/2026",
    "Contract No: PC-DRAFT-77",
    "Supplier: Blue Horizon Trading LLC",
    "Currency: AED   Exchange Rate: 3.6725",
    "Subtotal: AED 40000.00",
    "Freight: AED 1500.00",
    "Grand Total: AED 41500.00",
    "Advance Paid: AED 12000.00",
    "Payment Terms: 30 days",
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${80 + lines.length * 44}">
    <rect width="100%" height="100%" fill="white"/>
    ${lines.map((l, i) => `<text x="40" y="${60 + i * 44}" font-family="DejaVu Sans, Arial" font-size="26" fill="black">${l}</text>`).join("")}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const png = await invoicePng();
  const created = await documentIntakeService.createJob(
    { operationalDomain: "business", contractReference: "PC-DRAFT-77", sourceModuleHint: "purchase_orders" },
    { buffer: png, declaredMime: "image/png", filename: "draft-e2e.png" },
    ACTOR, "Draft E2E", globalScope,
  );
  console.log("1) job", created.id);

  await documentIntakeService.processJob(created.id, ACTOR, "Draft E2E", globalScope);
  let detail = await documentIntakeService.get(created.id, globalScope);
  console.log("2) status", detail?.job.status, "target_module", detail?.job.target_module, "match", detail?.job.match_status);

  // resolve any red-unverified fields
  for (const f of detail?.fields ?? []) {
    if (f.validation_status === "red" && !f.verified) {
      await documentIntakeService.updateField(created.id, f.field_key, { verified: true }, ACTOR, "Draft E2E", globalScope);
      console.log("   verified red field:", f.field_key);
    }
  }

  // out_of_scope? force to review by clearing match for the test (no in-scope PO exists on DEV)
  await withLocalPg(async (sql) => {
    await sql`UPDATE public.document_intake_jobs SET status = 'review', match_status = 'none', qvc_reason = NULL WHERE id = ${created.id}`;
  });

  console.log("3) confirmDraft…");
  const cd = await documentIntakeService.confirmDraft(created.id, { linkMode: "new_record" }, ACTOR, "Draft E2E", globalScope);
  console.log("   draft:", JSON.stringify(cd));

  const drafts = await documentIntakeService.listDrafts(globalScope, { targetModule: "purchase_orders" });
  const mine = drafts.find((d: any) => d.job_id === created.id);
  console.log("4) listDrafts →", drafts.length, "| mine payload:", JSON.stringify(mine?.draft_payload), "| goods:", (mine?.line_items ?? []).length);

  const jobAfter = await documentIntakeService.get(created.id, globalScope);
  console.log("5) job status after confirm:", jobAfter?.job.status, "draft_ref:", jobAfter?.job.draft_reference);

  console.log("6) consumeDraft (simulate PO created)…");
  const fakePo = "11111111-2222-3333-4444-555555555555";
  const con = await documentIntakeService.consumeDraft(cd.draftId, "purchase_orders", fakePo, ACTOR, "Draft E2E", globalScope);
  console.log("   ", JSON.stringify(con));
  const jobFinal = await documentIntakeService.get(created.id, globalScope);
  console.log("   job status:", jobFinal?.job.status, "matched:", jobFinal?.job.matched_source_module, jobFinal?.job.matched_source_id);

  console.log("7) idempotent re-consume…");
  const con2 = await documentIntakeService.consumeDraft(cd.draftId, "purchase_orders", fakePo, ACTOR, "Draft E2E", globalScope);
  console.log("   ", JSON.stringify(con2));

  console.log("8) events:", (jobFinal?.events ?? []).map((e: any) => e.action).join(" → "));

  console.log("9) cleanup…");
  await withLocalPg(async (sql) => {
    await sql`DELETE FROM public.document_intake_drafts WHERE job_id = ${created.id}`;
    await sql`DELETE FROM public.document_intake_jobs WHERE id = ${created.id}`;
  });
  console.log("   done.");
  process.exit(0);
}
main().catch((e) => { console.error("DRAFT E2E FAILED:", e); process.exit(1); });
