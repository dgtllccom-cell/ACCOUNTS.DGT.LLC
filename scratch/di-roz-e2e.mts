import sharp from "sharp";
import { withLocalPg } from "../lib/db/local-postgres";
import { documentIntakeService } from "../lib/services/document-intake-service";
import { roznamchaIntakePreviewService } from "../lib/services/roznamcha-intake-preview-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";

const g: IntakeScope = { domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true };
const ACTOR = "00000000-0000-0000-0000-000000000000";

async function png(lines: string[]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${80 + lines.length * 42}"><rect width="100%" height="100%" fill="white"/>${lines.map((l, i) => `<text x="30" y="${52 + i * 42}" font-family="DejaVu Sans" font-size="23" fill="black">${l}</text>`).join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const buf = await png([
    "BANK TRANSFER ADVICE",
    "Transfer Advice No: TT-2026-5521   Date: 15/08/2026",
    "Value Date: 16/08/2026",
    "Beneficiary: Falcon Exports LLC",
    "Currency: AED   Amount: 41,500.00",
    "Payment Method: Bank Transfer",
    "Reference: PC-ROZ-31",
  ]);
  const job = await documentIntakeService.createJob(
    { operationalDomain: "business", contractReference: "PC-ROZ-31" },
    { buffer: buf, declaredMime: "image/png", filename: "roz-e2e.png" }, ACTOR, "Roz E2E", g,
  );
  console.log("job", job.id);
  await documentIntakeService.processJob(job.id, ACTOR, "Roz E2E", g);
  const d = await documentIntakeService.get(job.id, g);
  console.log("status", d?.job.status, "doc_type", d?.job.doc_type_code, "target_module", d?.job.target_module);
  console.log("fields:", (d?.fields ?? []).map((f: any) => `${f.field_key}=${f.normalized_value ?? f.raw_value}`).join(" | "));

  console.log("\n1) roznamcha pre-post preview…");
  const pv = await roznamchaIntakePreviewService.previewFromJob(job.id, g);
  console.log(JSON.stringify(pv?.preview, null, 1));
  console.log("checks:", JSON.stringify(pv?.checks));

  console.log("\n2) cleanup…");
  await withLocalPg(async (sql) => { await sql`DELETE FROM public.document_intake_jobs WHERE id = ${job.id}`; });
  console.log("   done.");
  process.exit(0);
}
main().catch((e) => { console.error("ROZ E2E FAILED:", e); process.exit(1); });
