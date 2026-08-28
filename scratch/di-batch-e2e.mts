import { withLocalPg } from "../lib/db/local-postgres";
import { documentIntakeService } from "../lib/services/document-intake-service";
import { purchaseLoadingBatchService, type LoadingScope } from "../lib/services/purchase-loading-batch-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";
import sharp from "sharp";

const gIntake: IntakeScope = { domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true };
const gLoad: LoadingScope = { countryIds: null, countryBranchIds: null, cityBranchIds: null, isSuperAdmin: true };
const ACTOR = "00000000-0000-0000-0000-000000000000";

async function png(text: string[]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${80 + text.length * 44}"><rect width="100%" height="100%" fill="white"/>${text.map((l, i) => `<text x="30" y="${55 + i * 44}" font-family="DejaVu Sans" font-size="24" fill="black">${l}</text>`).join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const po = await withLocalPg(async (sql) => (await sql`
    SELECT id, country_id, country_branch_id, city_branch_id, purchase_order_no
    FROM public.purchase_orders WHERE deleted_at IS NULL AND country_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`)?.[0]);
  console.log("using PO", po.purchase_order_no, po.id);

  const buf = await png([
    "PACKING LIST",
    `PO: ${po.purchase_order_no}`,
    "Container Numbers: MSCU1112223, TGHU4445556",
  ]);
  const job = await documentIntakeService.createJob(
    { operationalDomain: "business", sourceModuleHint: "purchase_loading_records", purchaseOrderId: po.id },
    { buffer: buf, declaredMime: "image/png", filename: "batch-e2e.png" }, ACTOR, "Batch E2E", gIntake,
  );
  console.log("job", job.id);

  await withLocalPg(async (sql) => {
    await sql`UPDATE public.document_intake_jobs SET
      country_id = ${po.country_id}, country_branch_id = ${po.country_branch_id}, city_branch_id = ${po.city_branch_id},
      match_status = 'user', matched_source_module = 'purchase_orders', matched_source_id = ${po.id},
      status = 'review', doc_type_code = 'packing_list', target_module = 'purchase_loading_records',
      container_reference = 'MSCU1112223, TGHU4445556'
      WHERE id = ${job.id}`;
    await sql`INSERT INTO public.document_intake_fields (job_id, field_key, field_label, raw_value, normalized_value, confidence, validation_status)
      VALUES (${job.id}, 'container_numbers', 'Container Numbers', 'MSCU1112223, TGHU4445556', 'MSCU1112223, TGHU4445556', 0.9, 'green')`;
  });

  console.log("\n1) propose batch…");
  const b1 = await purchaseLoadingBatchService.proposeBatchFromJob(job.id, gLoad, ACTOR, "Batch E2E");
  console.log("   ", b1.batchNo, JSON.stringify(b1.containers));

  console.log("2) propose again (should reject — already batched)…");
  try { await purchaseLoadingBatchService.proposeBatchFromJob(job.id, gLoad, ACTOR, "Batch E2E"); console.log("   !!! unexpectedly succeeded"); }
  catch (e) { console.log("   rejected:", (e as Error).message); }

  console.log("3) progress for order…");
  const prog = await purchaseLoadingBatchService.progressForOrder(po.id, gLoad);
  console.log("   ", JSON.stringify(prog?.progress), "batches:", prog?.batches.length);

  console.log("4) confirm batch…");
  const c = await purchaseLoadingBatchService.confirmBatch(b1.batch.id, gLoad, ACTOR, "Batch E2E");
  console.log("   ", JSON.stringify(c));

  console.log("5) events on job:", (await documentIntakeService.get(job.id, gIntake))?.events.map((e: any) => e.action).join(" → "));

  console.log("\n6) cleanup…");
  await withLocalPg(async (sql) => {
    await sql`DELETE FROM public.purchase_loading_batches WHERE source_intake_job_id = ${job.id}`;
    await sql`DELETE FROM public.document_intake_jobs WHERE id = ${job.id}`;
  });
  console.log("   done.");
  process.exit(0);
}
main().catch((e) => { console.error("BATCH E2E FAILED:", e); process.exit(1); });
