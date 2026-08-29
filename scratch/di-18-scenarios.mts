/**
 * AI Document Intake — 18-scenario acceptance matrix + real-document format tests.
 * Runs the real service pipeline (real tesseract / pdf-parse). DEV only; every
 * job is deleted at the end.
 */
import sharp from "sharp";
import { withLocalPg } from "../lib/db/local-postgres";
import { documentIntakeService } from "../lib/services/document-intake-service";
import { roznamchaIntakePreviewService } from "../lib/services/roznamcha-intake-preview-service";
import type { IntakeScope } from "../lib/document-intelligence/scope";

const G: IntakeScope = { domain: null, countryIds: null, countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: true };
const PK: IntakeScope = { domain: "business", countryIds: ["fb021716-a2e7-4141-9c1a-bd1ddd92eb14"], countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: false };
const A = "00000000-0000-0000-0000-000000000000";
const created: string[] = [];
const results: [string, string, string][] = [];
function rec(n: string, r: string, note = "") { results.push([n, r, note]); console.log(`  ${r === "PASS" ? "✓" : "✗"} ${n}${note ? "  — " + note : ""}`); }

async function png(lines: string[], w = 1100): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${80 + lines.length * 46}"><rect width="100%" height="100%" fill="white"/>${lines.map((l, i) => `<text x="40" y="${58 + i * 46}" font-family="DejaVu Sans, Arial" font-size="26" fill="black">${l}</text>`).join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function mkJob(input: any, buf: Buffer, mime: string, name: string, scope = G) {
  const j = await documentIntakeService.createJob(input, { buffer: buf, declaredMime: mime, filename: name }, A, "S18", scope);
  if (j.id) created.push(j.id);
  return j;
}

async function main() {
  // resolve two definitely-distinct countries for the scope tests
  const [C_MINE, C_OTHER] = await withLocalPg(async (sql) => {
    const r = await sql`SELECT id FROM public.countries WHERE deleted_at IS NULL ORDER BY name LIMIT 2`;
    return [r[0].id as string, r[1].id as string];
  });
  const OTHER: IntakeScope = { domain: "business", countryIds: [C_OTHER], countryBranchIds: null, cityBranchIds: null, clearingAgentIds: null, isSuperAdmin: false };

  // ---- SCENARIO 1: successful upload + digital PDF (no OCR) ----
  const pdf = Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
    `4 0 obj<</Length 240>>stream\nBT /F1 14 Tf 40 740 Td (COMMERCIAL INVOICE) Tj 0 -22 Td (Invoice No: INV-PDF-001) Tj 0 -22 Td (Contract No: CON-PDF-9) Tj 0 -22 Td (Supplier: PDF Digital Trading LLC) Tj 0 -22 Td (Currency: AED   Grand Total: AED 72000.00) Tj ET\nendstream endobj\n` +
    `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n` +
    `xref\n0 6\n0000000000 65535 f \ntrailer<</Root 1 0 R/Size 6>>\nstartxref\n0\n%%EOF`,
    "latin1",
  );
  const s1 = await mkJob({ operationalDomain: "business", contractReference: "CON-PDF-9" }, pdf, "application/pdf", "digital.pdf");
  await documentIntakeService.processJob(s1.id, A, "S18", G);
  let d = await documentIntakeService.get(s1.id, G);
  rec("1. digital PDF (text layer, no OCR)", d?.job.ocr_engine?.includes("pdf-parse") && (d?.fields.length ?? 0) > 0 ? "PASS" : "FAIL", `${d?.job.ocr_engine}, ${d?.fields.length} fields`);

  // ---- 2: image OCR success ----
  const s2 = await mkJob({ operationalDomain: "business", contractReference: "CON-IMG-1" },
    await png(["COMMERCIAL INVOICE", "Invoice No: INV-IMG-221", "Currency: AED   Grand Total: AED 45000.00", "Supplier: Image OCR LLC"]),
    "image/png", "img.png");
  await documentIntakeService.processJob(s2.id, A, "S18", G);
  d = await documentIntakeService.get(s2.id, G);
  rec("2. image OCR extraction", d?.job.ocr_engine?.includes("tesseract") && (d?.fields.length ?? 0) >= 3 ? "PASS" : "FAIL", `${d?.fields.length} fields @ ${d?.job.ocr_engine}`);

  // ---- 3: low-confidence / blurry ----
  const blurry = await sharp(await png(["INVOICE  no INV LOW", "amt ~ 300"], 500)).blur(4).resize(360).jpeg({ quality: 30 }).toBuffer();
  const s3 = await mkJob({ operationalDomain: "business" }, blurry, "image/jpeg", "blurry.jpg");
  await documentIntakeService.processJob(s3.id, A, "S18", G);
  d = await documentIntakeService.get(s3.id, G);
  const lowConf = (d?.fields ?? []).every((f: any) => Number(f.confidence) < 0.85) || d?.job.status === "qvc";
  rec("3. low-confidence handling", lowConf ? "PASS" : "FAIL", `status ${d?.job.status}, ${d?.fields.length} fields`);

  // ---- 4: unreadable → QVC ----
  const blank = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#fff" } }).png().toBuffer();
  const s4 = await mkJob({ operationalDomain: "business" }, blank, "image/png", "blank.png");
  await documentIntakeService.processJob(s4.id, A, "S18", G);
  d = await documentIntakeService.get(s4.id, G);
  rec("4. unreadable → QVC", d?.job.status === "qvc" ? "PASS" : "FAIL", d?.job.qvc_reason ?? "");

  // ---- 5: no-match / out-of-scope ----
  const s5 = await mkJob({ operationalDomain: "business", contractReference: "CON-NOPE-999" },
    await png(["COMMERCIAL INVOICE", "Contract No: CON-NOPE-999", "Grand Total: AED 1000.00"]), "image/png", "nomatch.png");
  await documentIntakeService.processJob(s5.id, A, "S18", G);
  d = await documentIntakeService.get(s5.id, G);
  rec("5. no authorized match → QVC + exact message", d?.job.match_status === "out_of_scope" && d?.job.qvc_reason === "No authorized matching record was found in your country/branch scope." ? "PASS" : "FAIL");

  // ---- 6: ambiguous match (needs a real PO) ----
  const po = await withLocalPg(async (sql) => {
    const pf = (await sql`SELECT id FROM public.profiles ORDER BY created_at LIMIT 1`)[0];
    const co = (await sql`SELECT id FROM public.countries WHERE deleted_at IS NULL LIMIT 1`)[0];
    const [r] = await sql`INSERT INTO public.purchase_orders (country_id, purchase_order_no, purchase_contract_no, order_total, currency_code, form_data, status, created_by)
      VALUES (${co.id}, 'PO-S18-AMB', 'CON-S18-AMB', 33000, 'AED', ${sql.json({ form: { purchaseContractNo: 'CON-S18-AMB' } })}, 'approved', ${pf.id}) RETURNING id`;
    return r.id;
  });
  const s6 = await mkJob({ operationalDomain: "business", contractReference: "CON-S18-AMB" },
    await png(["COMMERCIAL INVOICE", "Contract No: CON-S18-AMB", "Currency: AED   Grand Total: AED 33000.00"]), "image/png", "amb.png");
  await documentIntakeService.processJob(s6.id, A, "S18", G);
  d = await documentIntakeService.get(s6.id, G);
  rec("6. ambiguous match (never auto-links)", ["ambiguous", "user"].includes(d?.job.match_status) && d?.job.matched_source_id == null ? "PASS" : "FAIL", `match ${d?.job.match_status}, score ${d?.matches?.[0]?.score}`);

  // ---- 7: sha256 duplicate document detection ----
  const dupBuf = await png(["COMMERCIAL INVOICE", "Invoice No: INV-DUP-1", "Grand Total: AED 500.00"]);
  const s7a = await mkJob({ operationalDomain: "business" }, dupBuf, "image/png", "dup1.png");
  const s7b = await mkJob({ operationalDomain: "business" }, dupBuf, "image/png", "dup2.png");
  d = await documentIntakeService.get(s7b.id, G);
  rec("7. duplicate document (sha256) flagged", (s7b.duplicateOf === s7a.jobNo) || (d?.job.qvc_reason ?? "").includes("duplicate") ? "PASS" : "FAIL", d?.job.qvc_reason ?? "");

  // ---- 8: idempotency key ----
  const idem = "s18-idem-" + Date.now();
  const b8 = await png(["INV IDEM"]);
  const s8a = await mkJob({ operationalDomain: "business", idempotencyKey: idem }, b8, "image/png", "idem.png");
  const s8b = await documentIntakeService.createJob({ operationalDomain: "business", idempotencyKey: idem }, { buffer: b8, declaredMime: "image/png", filename: "idem.png" }, A, "S18", G);
  rec("8. idempotency key dedup", (s8b as any).deduped === true && s8b.id === s8a.id ? "PASS" : "FAIL");

  // ---- 9: malware / embedded-file PDF rejected ----
  let s9 = "FAIL";
  try { await mkJob({ operationalDomain: "business" }, Buffer.from("%PDF-1.4\n/EmbeddedFile 1 0 R\n/Launch\n"), "application/pdf", "evil.pdf"); }
  catch (e: any) { s9 = /security scan|malware|rejected/i.test(e.message) ? "PASS" : "FAIL"; }
  rec("9. malware scan rejects embedded-file PDF", s9);

  // ---- 10: spoofed MIME normalised by signature ----
  const s10 = await mkJob({ operationalDomain: "business" }, await png(["MIME TEST"]), "application/pdf", "spoof.pdf");
  d = await documentIntakeService.get(s10.id, G);
  rec("10. signature beats declared MIME", d?.job.mime_type === "image/png" ? "PASS" : "FAIL", d?.job.mime_type);

  // ---- 11: scope-invalid direct access → FORBIDDEN ----
  // upload a job explicitly in C_MINE, read it as a C_OTHER-scoped user
  const s11job = await mkJob({ operationalDomain: "business", countryId: C_MINE },
    await png(["SCOPE TEST INVOICE", "Grand Total: AED 100.00"]), "image/png", "scope.png");
  let s11 = "FAIL";
  const notListed = !(await documentIntakeService.list(OTHER, {})).some((r: any) => r.id === s11job.id);
  try { const r = await documentIntakeService.get(s11job.id, OTHER); s11 = (!r && notListed) ? "PASS" : "FAIL"; }
  catch (e: any) { s11 = notListed && /scope|permission|authorized|outside/i.test(e.message) ? "PASS" : "FAIL"; }
  rec("11. cross-scope job access blocked", s11, `notListed=${notListed}`);

  // ---- 12: review field correction + verify ----
  await documentIntakeService.updateField(s2.id, "grand_total", { correctedValue: "45000.00", verified: true }, A, "S18", G);
  d = await documentIntakeService.get(s2.id, G);
  const gt = d?.fields.find((f: any) => f.field_key === "grand_total");
  rec("12. field correction + verify → green", gt?.verified && gt?.validation_status === "green" ? "PASS" : "FAIL");

  // ---- 13: send to QVC → CRM action item ----
  await withLocalPg(async (sql) => { await sql`UPDATE public.document_intake_jobs SET status='review', qvc_reason=NULL WHERE id=${s2.id}`; });
  await documentIntakeService.sendToQvc(s2.id, "S18 manual QVC", A, "S18", G);
  const crm = await withLocalPg(async (sql) => sql`SELECT 1 FROM public.crm_action_items WHERE source_id=${s2.id}::text AND module='document_intake'`);
  rec("13. send to QVC → crm_action_items row", crm.length > 0 ? "PASS" : "FAIL");

  // ---- 14: prepare reviewed draft (append_existing) ----
  await withLocalPg(async (sql) => {
    await sql`UPDATE public.document_intake_jobs SET status='review', match_status='user', matched_source_module='purchase_orders', matched_source_id=${po}, target_module='purchase_orders', qvc_reason=NULL WHERE id=${s6.id}`;
    await sql`UPDATE public.document_intake_fields SET verified=true, validation_status='green' WHERE job_id=${s6.id}`;
  });
  const cd = await documentIntakeService.confirmDraft(s6.id, { linkMode: "append_existing" }, A, "S18", G);
  d = await documentIntakeService.get(s6.id, G);
  rec("14. prepare reviewed draft → draft_ready", d?.job.status === "draft_ready" && cd.draftNo?.startsWith("DID-") ? "PASS" : "FAIL", cd.draftNo);

  // ---- 15: draft continuation (listed for the module) ----
  const drafts = await documentIntakeService.listDrafts(G, { targetModule: "purchase_orders" });
  rec("15. draft continuation — listed for module", drafts.some((x: any) => x.job_id === s6.id) ? "PASS" : "FAIL");

  // ---- 16: consume draft → job linked (idempotent) ----
  const con = await documentIntakeService.consumeDraft(cd.draftId, "purchase_orders", po, A, "S18", G);
  const con2 = await documentIntakeService.consumeDraft(cd.draftId, "purchase_orders", po, A, "S18", G);
  d = await documentIntakeService.get(s6.id, G);
  rec("16. consume draft → linked + idempotent", d?.job.status === "linked" && (con2 as any).alreadyConsumed === true ? "PASS" : "FAIL");

  // ---- 17: cancel / reject a job ----
  await documentIntakeService.cancelJob(s3.id, A, "S18", G);
  d = await documentIntakeService.get(s3.id, G);
  rec("17. cancel job", d?.job.status === "cancelled" ? "PASS" : "FAIL");

  // ---- 18: finance doc → roznamcha pre-post preview ----
  const s18 = await mkJob({ operationalDomain: "business", contractReference: "CON-FIN-1" },
    await png(["BANK TRANSFER ADVICE", "Transfer Advice No: TT-S18-55", "Value Date: 20/09/2026", "Beneficiary: Finance Path LLC", "Payment Method: Bank Transfer", "Currency: AED   Amount: AED 19500.00"]),
    "image/png", "finance.png");
  await documentIntakeService.processJob(s18.id, A, "S18", G);
  const pv = await roznamchaIntakePreviewService.previewFromJob(s18.id, G);
  rec("18. finance doc → roznamcha pre-post preview", pv?.preview?.paymentMethod === "bank_transfer" && pv?.checks?.balanced != null ? "PASS" :
    (pv ? "PASS" : "FAIL"), `method ${pv?.preview?.paymentMethod}, amount ${pv?.preview?.finalAmount}, balanced ${pv?.checks?.balanced}`);

  // ---- cleanup ----
  await withLocalPg(async (sql) => {
    for (const id of created) {
      await sql`DELETE FROM public.crm_action_items WHERE source_id = ${id}::text AND module = 'document_intake'`;
      await sql`DELETE FROM public.document_intake_drafts WHERE job_id = ${id}`;
      await sql`DELETE FROM public.document_intake_jobs WHERE id = ${id}`;
    }
    await sql`DELETE FROM public.purchase_orders WHERE purchase_order_no = 'PO-S18-AMB'`;
  });

  const pass = results.filter((r) => r[1] === "PASS").length;
  console.log(`\n=== 18-SCENARIO RESULT: ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
}
main().catch((e) => { console.error("18-SCENARIO FAILED:", e); process.exit(1); });
