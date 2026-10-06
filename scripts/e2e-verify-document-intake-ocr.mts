// DEV-only: scanned 3-page contract -> background OCR -> reviewed status, page viewer endpoints, stuck-OCR recovery,
// zero-field handling and "no accounting side effects". Companion to e2e-verify-document-intake.mts.
//
// Usage: npx vite-node --config vitest.config.mjs scripts/e2e-verify-document-intake-ocr.mts [baseUrl] [scanPdf]
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { buildTempAgentToken } from "../lib/auth/temp-session";

const BASE = process.argv[2] || "http://localhost:3000";
const SCAN = process.argv[3] || "C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/2834159b-a2a0-4728-a0d2-4876b08db123/scratchpad/dalian-scan-3p.pdf";
const UAE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const CB = "87c2e253-b6c1-482d-a808-272337f3ffda";
const CITY = "79b31aba-45f1-4aba-9068-fb3eb2102a81";
const DEMO = { userId: "00000000-0000-4000-8000-0000000d0001", email: "demo.dubai.e2e@dgt.llc", name: "Demo Dubai City Admin", role: "city_branch_admin", countryId: UAE, cb: CB, city: CITY };
const PKADMIN = { userId: "409b050f-faf9-428f-9ec6-d9c8bc5a9dc2", email: "pakistan.admin@dgt.llc", name: "Pakistan Country Admin", role: "country_admin", countryId: PK, cb: null as string | null, city: null as string | null };

const results: { label: string; ok: boolean }[] = [];
const check = (label: string, ok: boolean, detail?: unknown) => { results.push({ label, ok }); console.log(`${ok ? "PASS" : "FAIL"}: ${label}${ok ? "" : "  -> " + JSON.stringify(detail)?.slice(0, 500)}`); };

function loadEnvSecret() {
  if (process.env.ERP_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) return;
  for (const f of [".env.local", ".env"]) {
    try { for (const line of readFileSync(f, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*(ERP_SESSION_SECRET|AUTH_SECRET|NEXTAUTH_SECRET)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch { /* ignore */ }
  }
}
const cookie = (w: typeof DEMO | typeof PKADMIN) => `erp_session=${buildTempAgentToken({ userId: w.userId, email: w.email, fullName: w.name, roles: [w.role as any], assignments: [{ role: w.role as any, countryId: w.countryId, countryBranchId: w.cb, cityBranchId: w.city }] })}`;
async function api(w: typeof DEMO | typeof PKADMIN, method: string, path: string, body?: unknown) {
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
async function waitFor(jobId: string, pred: (d: any) => boolean, ms = 240000) {
  const t0 = Date.now(); let last: any = null;
  while (Date.now() - t0 < ms) { last = (await api(DEMO, "GET", `/api/erp/document-intelligence/${jobId}`)).data; if (last?.job && pred(last)) return last; await new Promise((r) => setTimeout(r, 3000)); }
  return last;
}
const counts = () => withLocalPg(async (sql) => {
  const out: Record<string, number> = {};
  for (const t of ["purchase_orders", "roznamcha_entries", "journal_entries", "ledger_balances"]) {
    try { out[t] = (await sql`select count(*)::int n from ${sql(t)}`)[0].n; } catch { /* table missing */ }
  }
  return out;
});

async function main() {
  if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not DEV.");
  loadEnvSecret();
  const before = await counts();
  const pdf = readFileSync(SCAN);
  const key = `ocr-${Date.now()}`;

  // 1. upload + background OCR
  const up = await upload(pdf, "dalian-scan-3p.pdf", key);
  check("scanned 3-page PDF uploaded", up.status === 201 && !!up.job?.id, up);
  const jobId: string = up.job.id;
  const t0 = Date.now();
  const kick = await api(DEMO, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "process", async: true });
  check("process(async) returns at once with status 'processing' (request not held open)", kick.status === 200 && kick.data?.result?.status === "processing" && Date.now() - t0 < 15000, { s: kick.status, r: kick.data?.result, ms: Date.now() - t0 });
  const mid = (await api(DEMO, "GET", `/api/erp/document-intelligence/${jobId}`)).data;
  check("while OCR runs the job is in a processing state (ocr/classifying/extracting) - not 'reviewed'", ["ocr", "classifying", "extracting", "matching", "review"].includes(mid?.job?.status), mid?.job?.status);
  const done = await waitFor(jobId, (d) => !["uploaded", "ocr", "classifying", "extracting", "matching"].includes(d.job.status));
  const fm = Object.fromEntries((done?.fields ?? []).map((f: any) => [f.field_key, f.corrected_value ?? f.normalized_value ?? f.raw_value]));
  check("OCR finishes and the job reaches 'review' (extracted - review required), not stuck in ocr", done?.job?.status === "review", done?.job?.status);
  check("non-zero field count (>= 20)", (done?.fields?.length ?? 0) >= 20, done?.fields?.length);
  check("page_count = 3 and OCR text stored for 'Review OCR text'", done?.job?.page_count === 3 && String(done?.job?.ocr_text ?? "").includes("SALES CONTRACT"), { pc: done?.job?.page_count, len: String(done?.job?.ocr_text ?? "").length });
  check("supplier / contract no. / date / USD / total read from the SCAN", /Dalian Sunshine/i.test(fm.supplier_name) && fm.contract_number === "0907B" && fm.document_date === "2026-09-05" && fm.currency === "USD" && String(fm.grand_total) === "60000", fm);
  check("item line 50 MT x 1,200 = 60,000 from page 2", done?.lineItems?.length === 1 && Number(done.lineItems[0].quantity) === 50 && Number(done.lineItems[0].unit_price) === 1200 && Number(done.lineItems[0].amount) === 60000 && done.lineItems[0].page_number === 2, done?.lineItems);
  check("HS / lot / variety / quality / packing / incoterm / place read", fm.hs_codes === "390120" && fm.lot_number === "L-5521" && /Film/i.test(fm.variety) && /standard/i.test(fm.quality) && /export packing/i.test(fm.packing) && fm.incoterm === "CIF" && /Dalian Port/.test(fm.delivery_place), fm);
  check("bank details read from page 3", /CONSTRUCTION/i.test(fm.bank_name) && /2121/.test(fm.account_number) && fm.swift_bic === "PCBCCNBJDLX", fm);
  check("NO transport reference is invented (BL / container / truck / AWB / rail absent)", !fm.bl_number && !fm.container_numbers && !fm.truck_number && !fm.awb_number && !fm.rail_reference, { bl: fm.bl_number, c: fm.container_numbers, t: fm.truck_number });
  check("field pages span 1-3 (source-page references)", new Set((done?.fields ?? []).map((f: any) => f.page_number).filter(Boolean)).size >= 2, [...new Set((done?.fields ?? []).map((f: any) => f.page_number))]);

  // 2. viewer endpoints
  const info = await api(DEMO, "GET", `/api/erp/document-intelligence/${jobId}/page?info=1`);
  check("viewer: page count endpoint says 3", info.data?.pages === 3, info.json);
  const p1 = await fetch(`${BASE}/api/erp/document-intelligence/${jobId}/page?n=1&scale=2`, { headers: { Cookie: cookie(DEMO) } });
  const b1 = Buffer.from(await p1.arrayBuffer());
  check("viewer: page 1 is a readable PNG (> 40 KB, PNG signature)", p1.status === 200 && b1.subarray(1, 4).toString() === "PNG" && b1.length > 40000, { s: p1.status, len: b1.length });
  const p3 = await fetch(`${BASE}/api/erp/document-intelligence/${jobId}/page?n=3&scale=3`, { headers: { Cookie: cookie(DEMO) } });
  check("viewer: page 3 at 3x renders", p3.status === 200 && (await p3.arrayBuffer()).byteLength > 40000, p3.status);
  const dl = await fetch(`${BASE}/api/erp/document-intelligence/${jobId}/file?download=1`, { headers: { Cookie: cookie(DEMO) } });
  check("viewer: Download Original sends the PDF as an attachment", dl.status === 200 && /attachment/.test(dl.headers.get("content-disposition") ?? ""), dl.headers.get("content-disposition"));
  const pkp = await fetch(`${BASE}/api/erp/document-intelligence/${jobId}/page?n=1`, { headers: { Cookie: cookie(PKADMIN) } });
  check("viewer: another country cannot read the page images (403/404)", pkp.status === 403 || pkp.status === 404, pkp.status);

  // 3. stuck OCR: a run that died stays in 'ocr' with an old heartbeat
  await withLocalPg(async (sql) => { await sql`update public.document_intake_jobs set status='ocr', updated_at = now() - interval '10 minutes' where id=${jobId}`; });
  const stuck = (await api(DEMO, "GET", `/api/erp/document-intelligence/${jobId}`)).data;
  check("a job frozen in 'ocr' with no heartbeat is reported as stalled (UI shows Retry OCR)", stuck?.job?.status === "ocr" && stuck?.job?.stalled === true, { s: stuck?.job?.status, st: stuck?.job?.stalled });
  await withLocalPg(async (sql) => { await sql`update public.document_intake_jobs set updated_at = now() where id=${jobId}`; });
  const running = await api(DEMO, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "process", async: true });
  check("a LIVE run is not started twice (already_running)", running.data?.result?.status === "already_running", running.json);
  const retry = await api(DEMO, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "process", async: true, force: true });
  check("Retry OCR (force) restarts a stuck job", retry.data?.result?.status === "processing", retry.json);
  const again = await waitFor(jobId, (d) => d.job.status === "review");
  check("…and it completes to 'review' again with fields", again?.job?.status === "review" && again.fields.length >= 20, { s: again?.job?.status, n: again?.fields?.length });

  // 4. zero fields: a blank scan must NOT look like a successful extraction
  const blank = new jsPDF(); blank.setFontSize(1); blank.text(" ", 10, 10);
  const bup = await upload(Buffer.from(blank.output("arraybuffer")), "blank.pdf", key + "-blank");
  await api(DEMO, "PATCH", `/api/erp/document-intelligence/${bup.job.id}`, { action: "process", async: true });
  const bdone = await waitFor(bup.job.id, (d) => !["uploaded", "ocr", "classifying", "extracting", "matching"].includes(d.job.status));
  check("a document with nothing readable ends in 'qvc' with a clear reason and 0 fields (not a silent empty form)", bdone?.job?.status === "qvc" && (bdone?.fields?.length ?? 0) === 0 && /unreadable|no fields/i.test(bdone?.job?.qvc_reason ?? ""), { s: bdone?.job?.status, r: bdone?.job?.qvc_reason, n: bdone?.fields?.length });
  const rep = await api(DEMO, "PATCH", `/api/erp/document-intelligence/${bup.job.id}`, { action: "qvc", reason: "Extraction problem reported by the reviewer" });
  check("Report extraction problem sends the job to the QVC queue", rep.status === 200, rep.json);

  // 5. nothing was posted / created
  const after = await counts();
  check("no purchase booking, roznamcha entry, journal entry or ledger balance was created or changed by intake", JSON.stringify(before) === JSON.stringify(after), { before, after });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed; scan job=${jobId}`);
  if (failed.length) { console.log("FAILED:", failed.map((f) => f.label).join(" | ")); process.exitCode = 1; }
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
