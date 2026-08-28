import sharp from "sharp";
import { withLocalPg } from "../lib/db/local-postgres";
import { documentIntakeService } from "../lib/services/document-intake-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";

const globalScope: IntakeScope = {
  domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true,
};

async function makeInvoicePng(): Promise<Buffer> {
  const lines = [
    "COMMERCIAL INVOICE",
    "Invoice No: INV-2026-0453   Date: 12/07/2026",
    "Contract No: CON-1001",
    "Supplier: Golden Rice Trading LLC",
    "Currency: AED   Exchange Rate: 3.6725",
    "B/L No: MEDUXY123456",
    "Container Numbers: MSCU1234567, TGHU7654321",
    "Grand Total: AED 69700.00",
    "Advance Paid: AED 20000.00",
    "Balance Due: AED 49700.00",
    "HS Code: 1006.30.00",
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${80 + lines.length * 44}">
    <rect width="100%" height="100%" fill="white"/>
    ${lines.map((l, i) => `<text x="40" y="${60 + i * 44}" font-family="DejaVu Sans, Arial" font-size="26" fill="black">${l}</text>`).join("")}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const png = await makeInvoicePng();
  console.log("1) createJob (business / no country)…");
  const created = await documentIntakeService.createJob(
    { operationalDomain: "business", contractReference: "CON-1001", sourceModuleHint: "purchase_orders" },
    { buffer: png, declaredMime: "image/png", filename: "invoice-e2e.png" },
    "00000000-0000-0000-0000-000000000000", "E2E Tester", globalScope,
  );
  console.log("   job:", JSON.stringify(created));

  console.log("2) processJob (OCR → classify → extract → match)…");
  const proc = await documentIntakeService.processJob(created.id, "00000000-0000-0000-0000-000000000000", "E2E Tester", globalScope);
  console.log("   result:", JSON.stringify(proc));

  const detail = await documentIntakeService.get(created.id, globalScope);
  console.log("\n3) JOB STATUS:", detail?.job.status, "| doc type:", detail?.job.doc_type_code, "@", detail?.job.doc_type_confidence,
    "| match:", detail?.job.match_status, "| qvc:", detail?.job.qvc_reason);
  console.log("   FIELDS:");
  for (const f of detail?.fields ?? []) console.log(`     [${f.validation_status}] ${f.field_key} = ${JSON.stringify(f.normalized_value ?? f.raw_value)}`);
  console.log("   MATCHES:", (detail?.matches ?? []).length, "candidate(s)");
  console.log("   EVENTS:", (detail?.events ?? []).map((e: any) => e.action).join(" → "));

  console.log("\n4) field correction + verify…");
  await documentIntakeService.updateField(created.id, "grand_total", { correctedValue: "69700.00", verified: true }, "00000000-0000-0000-0000-000000000000", "E2E Tester", globalScope);
  const d2 = await documentIntakeService.get(created.id, globalScope);
  const gt = d2?.fields.find((f: any) => f.field_key === "grand_total");
  console.log("   grand_total now:", gt?.corrected_value, "verified:", gt?.verified, "status:", gt?.validation_status);

  console.log("\n5) send to QVC…");
  const qvc = await documentIntakeService.sendToQvc(created.id, "E2E manual QVC test", "00000000-0000-0000-0000-000000000000", "E2E Tester", globalScope);
  console.log("   qvcItemId:", JSON.stringify(qvc));
  const crm = await withLocalPg(async (sql) => sql`SELECT item_type, status, notes FROM public.crm_action_items WHERE source_id = ${created.id}::text AND module = 'document_intake'`);
  console.log("   CRM action item:", JSON.stringify(crm));

  console.log("\n6) cleanup…");
  await withLocalPg(async (sql) => {
    await sql`DELETE FROM public.crm_action_items WHERE source_id = ${created.id}::text AND module = 'document_intake'`;
    await sql`DELETE FROM public.document_intake_jobs WHERE id = ${created.id}`;
  });
  console.log("   done.");
  process.exit(0);
}

main().catch((e) => { console.error("E2E FAILED:", e); process.exit(1); });
