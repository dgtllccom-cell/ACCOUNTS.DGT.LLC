// DEV-only: a 4-page phone-scanned bilingual English / Chinese supplier SALES CONTRACT uploaded as a PURCHASE BOOKING, end to end:
//   upload → background OCR (every page, eng + chi_sim) → extraction → field mapping → supplier / account matching (Account Master,
//   scope) → verification (Matched / Missing / Mismatch / Manual review) → draft in the existing Purchase Booking workflow → the
//   hand-off payload the Purchase Booking wizard reads. Nothing is posted: purchase / roznamcha / journal / ledger counts unchanged.
//
// Usage: npx vite-node --config vitest.config.mjs scripts/e2e-verify-document-intake-bilingual.mts [baseUrl] [scanPdf]
//   (scanPdf: node scripts/dev/make-scanned-contract-fixture.mjs)
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { buildTempAgentToken } from "../lib/auth/temp-session";
import { initialReview } from "../lib/document-intelligence/review-init";
import { getIntakeModule } from "../lib/document-intelligence/intake-modules";

const BASE = process.argv[2] || "http://localhost:3000";
const SCAN = process.argv[3] || ".tmp/fixtures/dalian-sunshine-sales-contract-scan-4p.pdf";
const UAE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const CB = "87c2e253-b6c1-482d-a808-272337f3ffda";
const CITY = "79b31aba-45f1-4aba-9068-fb3eb2102a81";
const DEMO = { userId: "00000000-0000-4000-8000-0000000d0001", email: "demo.dubai.e2e@dgt.llc", name: "Demo Dubai City Admin", role: "city_branch_admin", countryId: UAE, cb: CB, city: CITY };
const PKADMIN = { userId: "409b050f-faf9-428f-9ec6-d9c8bc5a9dc2", email: "pakistan.admin@dgt.llc", name: "Pakistan Country Admin", role: "country_admin", countryId: PK, cb: null as string | null, city: null as string | null };
type Who = typeof DEMO | typeof PKADMIN;

const results: { label: string; ok: boolean }[] = [];
const check = (label: string, ok: boolean, detail?: unknown) => { results.push({ label, ok }); console.log(`${ok ? "PASS" : "FAIL"}: ${label}${ok ? "" : "  -> " + JSON.stringify(detail)?.slice(0, 600)}`); };

function loadEnvSecret() {
  if (process.env.ERP_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) return;
  for (const f of [".env.local", ".env"]) {
    try { for (const line of readFileSync(f, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*(ERP_SESSION_SECRET|AUTH_SECRET|NEXTAUTH_SECRET)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch { /* ignore */ }
  }
}
const cookie = (w: Who) => `erp_session=${buildTempAgentToken({ userId: w.userId, email: w.email, fullName: w.name, roles: [w.role as any], assignments: [{ role: w.role as any, countryId: w.countryId, countryBranchId: w.cb, cityBranchId: w.city }] })}`;
async function api(w: Who, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Cookie: cookie(w) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const txt = await res.text(); let json: any = null; try { json = JSON.parse(txt); } catch { /* */ }
  return { status: res.status, json, data: json?.data ?? json };
}
async function upload(buf: Buffer, name: string, key: string) {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "application/pdf" }), name);
  fd.append("operationalDomain", "business"); fd.append("countryId", UAE); fd.append("countryBranchId", CB); fd.append("cityBranchId", CITY);
  fd.append("sourceModuleHint", "purchase_booking"); fd.append("idempotencyKey", key);
  const res = await fetch(`${BASE}/api/erp/document-intelligence/upload`, { method: "POST", headers: { Cookie: cookie(DEMO) }, body: fd, signal: AbortSignal.timeout(180000) });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, job: json?.data?.job ?? json?.job };
}
async function waitFor(jobId: string, pred: (d: any) => boolean, ms = 420000) {
  const t0 = Date.now(); let last: any = null;
  while (Date.now() - t0 < ms) { last = (await api(DEMO, "GET", `/api/erp/document-intelligence/${jobId}`)).data; if (last?.job && pred(last)) return last; await new Promise((r) => setTimeout(r, 3000)); }
  return last;
}
const counts = () => withLocalPg(async (sql) => {
  const out: Record<string, number> = {};
  for (const t of ["purchase_orders", "roznamcha_entries", "journal_entries", "ledger_balances", "stock_movements"]) {
    try { out[t] = (await sql`select count(*)::int n from ${sql(t)}`)[0].n; } catch { /* table missing */ }
  }
  return out;
});

async function main() {
  if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not DEV.");
  loadEnvSecret();
  if (!existsSync(SCAN)) execFileSync(process.execPath, ["scripts/dev/make-scanned-contract-fixture.mjs", SCAN], { stdio: "inherit" });
  const before = await counts();
  const pdf = readFileSync(SCAN);

  // 1. upload as a Purchase Booking (the document's own title is "SALES CONTRACT" — it is the supplier's)
  const up = await upload(pdf, "dalian-sunshine-sales-contract-scan-4p.pdf", `bil-${Date.now()}`);
  check("4-page scanned bilingual contract uploaded", up.status === 201 && !!up.job?.id, up);
  const jobId: string = up.job.id;
  const kick = await api(DEMO, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "process", async: true });
  check("background OCR started", kick.status === 200 && kick.data?.result?.status === "processing", kick.json);
  const done = await waitFor(jobId, (d) => !["uploaded", "ocr", "classifying", "extracting", "matching"].includes(d.job.status));
  const job = done?.job ?? {};
  const fm: Record<string, string> = Object.fromEntries((done?.fields ?? []).map((f: any) => [f.field_key, String(f.corrected_value ?? f.normalized_value ?? f.raw_value ?? "")]));
  const fr: Record<string, any> = Object.fromEntries((done?.fields ?? []).map((f: any) => [f.field_key, f]));

  // 2. OCR — every page, English and Chinese
  check("OCR completed without an error and the job is reviewable (not 'error', not an empty form)", !job.error && ["review", "qvc"].includes(job.status) && (done?.fields?.length ?? 0) >= 20, { status: job.status, error: job.error, fields: done?.fields?.length });
  const ocr = String(job.ocr_text ?? "");
  check("all 4 pages were read (page_count 4) — not page 1 four times", job.page_count === 4 && /Port of Loading/i.test(ocr) && /BKCHCNBJ810/.test(ocr) && /Authorized signature/i.test(ocr), { pc: job.page_count, len: ocr.length });
  check("Chinese text is read as Chinese (卖方 / 买方 / 大连赛恩进出口有限公司)", /卖方/.test(ocr) && /买方/.test(ocr) && /大连赛恩进出口有限公司/.test(ocr), ocr.slice(0, 300));
  check("engine records the languages used (eng+ara+chi_sim)", /chi_sim/.test(String(job.ocr_engine ?? "")), job.ocr_engine);
  check("language detected is the dominant script (en), not Arabic noise", job.language_detected === "en", job.language_detected);

  // 3. extraction → Purchase Booking fields
  check("classified into the Purchase Booking module although the title says SALES CONTRACT", ["purchase_contract", "purchase_booking", "purchase_order", "proforma_invoice", "commercial_invoice"].includes(String(job.doc_type_code)) && job.target_module === "purchase_orders", { code: job.doc_type_code, target: job.target_module });
  check("seller (supplier) and buyer read", /^DALIAN SUNSHINE IMP/.test(fm.supplier_name) && fm.customer_name === "DAMAAN GENERAL TRADING LLC", { s: fm.supplier_name, b: fm.customer_name });
  check("seller's Chinese name read", fm.supplier_name_local === "大连赛恩进出口有限公司", fm.supplier_name_local);
  check("contract no. / date / currency / total", fm.contract_number === "DSA2023-1018" && fm.document_date === "2023-10-11" && fm.currency === "USD" && fm.grand_total === "1158740", fm);
  check("goods: description, unit price, unit, HS code, origin", /GOLDEN RAISINS/.test(fm.goods_description) && fm.unit_price === "5267" && fm.unit === "MT" && fm.hs_codes === "080620" && fm.country_of_origin === "China", fm);
  check("quantity 220 MT — calculated from amount ÷ price and flagged for review (not shown as read)", fm.quantity === "220" && fr.quantity?.validation_status !== "green" && /calculated/i.test(String(fr.quantity?.validation_message ?? "")), fr.quantity);
  check("goods line item 220 × 5,267 = 1,158,740 USD", done?.lineItems?.length === 1 && Number(done.lineItems[0].quantity) === 220 && Number(done.lineItems[0].unit_price) === 5267 && Number(done.lineItems[0].amount) === 1158740, done?.lineItems);
  check("payment / delivery: terms, incoterm, ports, shipment time", /30% T\/T in advance/.test(fm.payment_terms) && fm.incoterm === "CFR" && fm.port_of_loading === "DALIAN, CHINA" && /^JEBEL/.test(fm.port_of_discharge) && fm.shipment_time === "Before December 15, 2023", fm);
  check("packing + gross / net weight", /10 KG net per carton/.test(fm.packing) && fm.gross_weight === "228800" && fm.net_weight === "220000", fm);
  check("bank details of the seller", /BANK OF CHINA/.test(fm.bank_name) && fm.swift_bic === "BKCHCNBJ810" && /3070 5678 9012/.test(fm.account_number), fm);
  check("nothing invented: no invoice number, no BL / container / truck / AWB", !fm.invoice_number && !fm.bl_number && !fm.container_numbers && !fm.truck_number && !fm.awb_number, { inv: fm.invoice_number, bl: fm.bl_number });

  // 4. supplier / account matching (Account Master, this login's scope; never auto-assigned unless unambiguous)
  const ctxRes = await api(DEMO, "GET", `/api/erp/document-intelligence/${jobId}/context?moduleId=purchase_booking`);
  const ctx = ctxRes.data?.context ?? ctxRes.data;
  check("context: the Seller is the supplier side", ctx?.partyRole === "supplier" && /^DALIAN SUNSHINE/.test(String(ctx?.documentPartyName ?? "")) && ctx?.documentOwnName === "DAMAAN GENERAL TRADING LLC", { role: ctx?.partyRole, p: ctx?.documentPartyName, own: ctx?.documentOwnName });
  check("matching supplier records from the Account Master are offered (Dalian Sunshine)", (ctx?.candidates ?? []).some((c: any) => /dalian sunshine/i.test(c.name)), (ctx?.candidates ?? []).map((c: any) => [c.name, c.score]));
  check("account options are this login's in-scope accounts only", Array.isArray(ctx?.accountOptions), ctx?.accountOptions?.length);
  const pkCtx = await api(PKADMIN, "GET", `/api/erp/document-intelligence/${jobId}/context?moduleId=purchase_booking`);
  check("another country's admin cannot open the job (403/404)", pkCtx.status === 403 || pkCtx.status === 404, pkCtx.status);

  // 5. verification
  const ver = (await api(DEMO, "GET", `/api/erp/document-intelligence/${jobId}/verification`)).data;
  const vc: Record<string, any> = Object.fromEntries((ver?.checks ?? []).map((c: any) => [c.code, c]));
  check("verification: document-content checks present", ["extraction_completed", "field_contract_number", "field_supplier_name", "field_grand_total", "line_math", "total_lines", "currency_single", "weights", "destination_consistent", "party_in_erp"].every((k) => vc[k]?.group === "content"), Object.keys(vc));
  check("verification: extraction completed = Matched", vc.extraction_completed?.status === "pass", vc.extraction_completed);
  check("verification: total = goods lines (Matched), gross ≥ net (Matched), one currency (Matched)", vc.total_lines?.status === "pass" && vc.weights?.status === "pass" && vc.currency_single?.status === "pass", [vc.total_lines, vc.weights, vc.currency_single]);
  check("verification: calculated quantity → Manual review required (line math + quantity field)", vc.line_math?.status === "warning" && vc.field_quantity?.status === "warning", [vc.line_math, vc.field_quantity]);
  check("verification: destination 'JEBELALL' vs delivery place 'JEBEL ALI' → not silently Matched", ["warning", "pass"].includes(vc.destination_consistent?.status), vc.destination_consistent);
  check("verification: supplier in the Account Master is Matched or Manual review (choose)", ["pass", "warning"].includes(vc.party_in_erp?.status), vc.party_in_erp);
  check("verification: duplicate checks are a separate 'records' group", vc.duplicate_document?.group === "records", vc.duplicate_document);

  // 6. draft in the existing Purchase Booking workflow + the hand-off payload
  const mod = getIntakeModule("purchase_booking")!;
  const review = initialReview(done, mod, ctx);
  const cand = (ctx?.candidates ?? []).find((c: any) => /dalian sunshine/i.test(c.name));
  if (cand && !review.party.id) review.party = { id: cand.id, kind: cand.kind, name: cand.name, documentName: review.party.documentName };
  const acct = cand?.accountIds?.find((id: string) => (ctx?.accountOptions ?? []).some((a: any) => a.id === id));
  if (acct) review.accounts = { ...review.accounts, supplierAccountId: acct };
  check("review form pre-filled from the extraction (ports / shipment / origin included)", review.form.contractNo === "DSA2023-1018" && review.form.loadingPort === "DALIAN, CHINA" && review.form.shipmentTime === "Before December 15, 2023" && review.form.countryOfOrigin === "China" && review.items.length === 1, review.form);
  const save = await api(DEMO, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "confirm", linkMode: "new_record", targetModule: "purchase_orders", intent: "draft", countryId: UAE, countryBranchId: CB, cityBranchId: CITY, review });
  const r = save.data?.result ?? save.data;
  check("saved as a DRAFT of the Purchase Booking (nothing posted)", save.status === 200 && !!r?.draftNo, save.json);
  const p = r?.payload ?? {};
  check("hand-off payload: contract / date / supplier / currency / total", p.purchaseContractNo === "DSA2023-1018" && p.purchaseDate === "2023-10-11" && /DALIAN SUNSHINE|Dalian Sunshine/i.test(String(p.supplierName)) && p.currency === "USD" && Number(p.totalAmount) === 1158740, p);
  check("hand-off payload: loading Dalian / China, destination country UAE, origin China", p.loadingPort === "Dalian" && p.loadingCountry === "China" && p.receivedCountry === "United Arab Emirates" && p.origin === "China", { lp: p.loadingPort, lc: p.loadingCountry, rc: p.receivedCountry, o: p.origin });
  check("hand-off goods entry 220 × 5,267", Array.isArray(r?.goodsEntries) && r.goodsEntries.length === 1 && Number(r.goodsEntries[0].quantity) === 220 && Number(r.goodsEntries[0].unitPrice) === 5267, r?.goodsEntries);
  if (acct) check("the selected supplier account is carried as the Purchase Account", p.purchaseAccountId === acct, { p: p.purchaseAccountId, acct });
  const again = await api(DEMO, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "confirm", linkMode: "new_record", targetModule: "purchase_orders", intent: "draft", countryId: UAE, countryBranchId: CB, cityBranchId: CITY, review });
  check("saving again updates the SAME draft (no duplicate)", (again.data?.result ?? again.data)?.draftNo === r?.draftNo, { a: (again.data?.result ?? again.data)?.draftNo, b: r?.draftNo });

  // 7. Retry OCR on a job with a saved draft: the draft re-opens on the NEW extraction (its old review state is reset, not reused)
  const retry = await api(DEMO, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "process", async: true, force: true });
  check("Retry OCR restarts the extraction", retry.status === 200 && ["processing", "already_running"].includes(retry.data?.result?.status), retry.json);
  const redone = await waitFor(jobId, (d) => !["uploaded", "ocr", "classifying", "extracting", "matching"].includes(d.job.status));
  check("after Retry OCR the fields are there again", (redone?.fields?.length ?? 0) >= 20 && !redone?.job?.error, { n: redone?.fields?.length, e: redone?.job?.error });
  check("the open draft no longer carries the earlier review state (the form opens on the fresh extraction)", redone?.draft?.status === "prepared" && !redone?.draft?.draft_payload?._review, { st: redone?.draft?.status, hasReview: Boolean(redone?.draft?.draft_payload?._review) });

  // 8. no accounting / stock side effects
  const after = await counts();
  check("no purchase booking, roznamcha, journal, ledger or stock record was created by intake", JSON.stringify(before) === JSON.stringify(after), { before, after });

  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} passed; job=${jobId} draft=${r?.draftNo ?? "-"}`);
  process.exit(passed === results.length ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
