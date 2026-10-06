// DEV-only end-to-end verification of the Document Intake / Scan-to-Entry repair.
// Drives the REAL API routes (upload -> process -> context -> confirm -> reopen) with signed DEV test sessions,
// then reads the DEV database to prove what was (and was not) written.
//
// Usage: npx vite-node --config vitest.config.mjs scripts/e2e-verify-document-intake.mts [baseUrl] [pdfPath]
// DEV ONLY (csesvyxxjivnkkozgopt). Nothing is posted; the AI never creates bills.

import { readFileSync } from "node:fs";
import { withLocalPg, getDbUrl } from "../lib/db/local-postgres";
import { buildTempAgentToken } from "../lib/auth/temp-session";

const BASE = process.argv[2] || "http://localhost:3000";
const PDF = process.argv[3] || "C:/Users/dgtll/AppData/Local/Temp/claude/B--accounts-dgt-llc-code-project/2834159b-a2a0-4728-a0d2-4876b08db123/scratchpad/dalian-contract-0907B.pdf";
const UAE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const PK = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const DALIAN_COMPANY = "123a0a68-1eec-4e84-9db3-7b64efbb2641";
const DALIAN_ACCOUNT = "44c0308d-5c4e-4497-b9b8-0af7c02e7276";

type Who = { userId: string; email: string; name: string; role: string; countryId: string; cb: string | null; city: string | null };
const WHO: Record<string, Who> = {
  super: { userId: "00000000-0000-4000-8000-000000000001", email: "superadmin@dgt.llc", name: "E2E Super Admin", role: "super_admin", countryId: "", cb: null, city: null },
  uae: { userId: "c5bb3ddf-0781-41f7-b625-241a1c6babd0", email: "uae.admin@dgt.llc", name: "UAE Country Admin", role: "country_admin", countryId: UAE, cb: null, city: null },
  // the DEV demo branch that owns the Dalian Sunshine account (UAE-DUB-AC-0003)
  dubai: { userId: "00000000-0000-4000-8000-0000000d0001", email: "demo.dubai.e2e@dgt.llc", name: "Demo Dubai City Admin", role: "city_branch_admin", countryId: UAE, cb: "87c2e253-b6c1-482d-a808-272337f3ffda", city: "79b31aba-45f1-4aba-9068-fb3eb2102a81" },
  // a DIFFERENT Dubai branch (Deira): must NOT see the demo branch job or its accounts
  deira: { userId: "8f07f23e-fa25-4e37-bae5-40577f96e4c9", email: "dubai.branch@dgt.llc", name: "Deira Dubai City Admin", role: "city_branch_admin", countryId: UAE, cb: "87c2e253-b6c1-482d-a808-272337f3ffda", city: "b5e94645-05c1-4420-8ecb-141ca7d84f12" },
  pk: { userId: "409b050f-faf9-428f-9ec6-d9c8bc5a9dc2", email: "pakistan.admin@dgt.llc", name: "Pakistan Country Admin", role: "country_admin", countryId: PK, cb: null, city: null },
};

const results: { label: string; ok: boolean }[] = [];
function check(label: string, ok: boolean, detail?: unknown) {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${ok ? "" : "  -> " + JSON.stringify(detail)?.slice(0, 600)}`);
}

function loadEnvSecret() {
  if (process.env.ERP_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) return;
  for (const f of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*(ERP_SESSION_SECRET|AUTH_SECRET|NEXTAUTH_SECRET)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch { /* ignore */ }
  }
}
function cookie(w: Who) {
  const token = buildTempAgentToken({
    userId: w.userId, email: w.email, fullName: w.name, roles: [w.role as any],
    assignments: w.role === "super_admin" ? [] : [{ role: w.role as any, countryId: w.countryId, countryBranchId: w.cb, cityBranchId: w.city }],
  });
  return `erp_session=${token}`;
}
async function api(w: Who, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json", Cookie: cookie(w), "x-erp-lang": "en" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const txt = await res.text();
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* not json */ }
  return { status: res.status, json, data: json?.data ?? json };
}
async function upload(w: Who, key: string, scope: { cb: string; city: string }, hint: string, domain = "business") {
  const fd = new FormData();
  fd.append("file", new Blob([readFileSync(PDF)], { type: "application/pdf" }), "dalian-contract-0907B.pdf");
  fd.append("operationalDomain", domain);
  fd.append("countryId", UAE);
  fd.append("countryBranchId", scope.cb);
  fd.append("cityBranchId", scope.city);
  fd.append("sourceModuleHint", hint);
  fd.append("idempotencyKey", key);
  const res = await fetch(`${BASE}/api/erp/document-intelligence/upload`, { method: "POST", headers: { Cookie: cookie(w) }, body: fd, signal: AbortSignal.timeout(180000) });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, job: json?.data?.job ?? json?.job, json };
}

async function main() {
  if (!getDbUrl().includes("csesvyxxjivnkkozgopt")) throw new Error("Refusing: not DEV.");
  loadEnvSecret();
  const dubaiScope = { cb: WHO.dubai.cb!, city: WHO.dubai.city! };
  const runKey = `e2e-${Date.now()}`;

  // ── 1. upload as Dubai city admin, hinted to Purchase Booking, then extract ───────────────────────
  const up = await upload(WHO.dubai, runKey, dubaiScope, "purchase_booking");
  check("upload accepted (201)", up.status === 201 && !!up.job?.id, up);
  const jobId: string = up.job.id;
  const proc = await api(WHO.dubai, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "process" });
  check("process (extract) ok", proc.status === 200, proc);

  const got = await api(WHO.dubai, "GET", `/api/erp/document-intelligence/${jobId}`);
  const fields: any[] = got.data?.fields ?? [];
  const fv = (k: string) => { const f = fields.find((x) => x.field_key === k); return f ? (f.corrected_value ?? f.normalized_value ?? f.raw_value) : null; };
  check("extracted: original contract no. 0907B", fv("contract_number") === "0907B", fv("contract_number"));
  check("extracted: date 2026-09-05", fv("document_date") === "2026-09-05", fv("document_date"));
  check("extracted: Total Amount 60000 (was blank)", String(fv("grand_total")) === "60000", fv("grand_total"));
  check("extracted: seller (Supplier) populated (was blank)", /Dalian Sunshine/i.test(String(fv("supplier_name"))), fv("supplier_name"));
  check("extracted: buyer DGT LLC", /DGT/i.test(String(fv("customer_name"))), fv("customer_name"));
  check("extracted: USD, T/T, CIF", fv("currency") === "USD" && fv("payment_terms") === "T/T" && /CIF/.test(String(fv("delivery_terms"))), { c: fv("currency"), p: fv("payment_terms"), d: fv("delivery_terms") });
  check("extracted: bank details (CCB, A/C, SWIFT)", /CONSTRUCTION/i.test(String(fv("bank_name"))) && /2121/.test(String(fv("account_number"))) && fv("swift_bic") === "PCBCCNBJDLX", { b: fv("bank_name"), a: fv("account_number"), s: fv("swift_bic") });
  check("no master-data noise field (registration_number) on a trade contract", fv("registration_number") === null, fv("registration_number"));
  check("field count is real (> 15) and line item parsed 50 x 1200 = 60000", fields.length > 15 && got.data.lineItems?.length === 1 && Number(got.data.lineItems[0].amount) === 60000 && Number(got.data.lineItems[0].quantity) === 50, { n: fields.length, li: got.data.lineItems });
  check("job remembers the chosen module (hint = purchase_booking)", got.data?.job?.source_module_hint === "purchase_booking", got.data?.job?.source_module_hint);

  // ── 2. module-aware context: Seller = our supplier, linked account + bank matched ──────────────────
  const ctx = await api(WHO.dubai, "GET", `/api/erp/document-intelligence/${jobId}/context?moduleId=purchase_booking`);
  const c = ctx.data;
  check("context: party role is supplier, document party = the Seller", c?.partyRole === "supplier" && /Dalian Sunshine/i.test(c?.documentPartyName ?? ""), { r: c?.partyRole, n: c?.documentPartyName });
  check("context: Dalian company master matched (Seller, not Buyer)", c?.selectedPartyId === DALIAN_COMPANY && c?.partyStatus === "matched", { s: c?.selectedPartyId, st: c?.partyStatus, cands: c?.candidates?.map((x: any) => x.name) });
  const cand = c?.candidates?.find((x: any) => x.id === DALIAN_COMPANY);
  check("context: its linked account UAE-DUB-AC-0003 is offered, with the real id", !!cand?.accountIds?.includes(DALIAN_ACCOUNT) && c.accountOptions.some((a: any) => a.id === DALIAN_ACCOUNT && a.linkedPartyIds.includes(DALIAN_COMPANY)), { acc: cand?.accountIds });
  check("context: bank on document MATCHES the party's linked China Construction Bank", c?.bank?.status === "matched", c?.bank);
  check("context: no verified USD->AED rate on DEV -> rate is null (user must enter)", c?.rate?.fromCurrency === "USD" && c?.rate?.baseCurrency === "AED" && c?.rate?.rate === null, c?.rate);

  // ── 3. save draft: validation, then in-place update (no duplicate) ─────────────────────────────────
  const review = (over: any = {}) => ({
    moduleId: "purchase_booking",
    form: { contractNo: "0907B", documentDate: "2026-09-05", reference: "", currency: "USD", totalAmount: "60000", paymentTerms: "T/T", deliveryTerms: "CIF Dalian Port", incoterm: "CIF", deliveryPlace: "Dalian Port", quality: "", packing: "", hsCode: "", lotNo: "", variety: "", goodsDescription: "Plastic Raw Material", grossWeight: "", tareWeight: "", netWeight: "", truckNo: "", blNo: "", containerNos: "", notes: "e2e" },
    party: { id: DALIAN_COMPANY, kind: "company", name: "DALIAN SUNSHINE IMP. & EXP.", documentName: "Dalian Sunshine Imp & Exp. Co., Ltd." },
    accounts: { supplierAccountId: DALIAN_ACCOUNT, purchaseAccountId: "", customerAccountId: "", salesAccountId: "", debitAccountId: "", creditAccountId: "", bankAccountId: "" },
    items: [{ description: "Plastic Raw Material", hsCode: "", quantity: 50, unit: "MT", unitPrice: 1200, amount: 60000, grossWeight: null, tareWeight: null, netWeight: null, lotNo: "", variety: "", quality: "", sourcePage: 1 }],
    exchange: { originalAmount: 60000, originalCurrency: "USD", finalCurrency: "AED", rate: 3.6725, rateDate: "2026-10-02", direction: "multiply", finalAmount: 220350, rateSource: "manual", confirmed: true },
    bank: { decision: "use_matched", bankId: "b8bfb67a-2f40-4bc5-9712-e3e85e85f27e" },
    ...over,
  });
  const confirm = (w: Who, rv: any, intent = "draft") => api(w, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "confirm", linkMode: "new_record", targetModule: "purchase_orders", intent, countryId: UAE, countryBranchId: dubaiScope.cb, cityBranchId: dubaiScope.city, review: rv });

  const bogus = await confirm(WHO.dubai, review({ accounts: { ...review().accounts, supplierAccountId: "11111111-1111-4111-8111-111111111111" } }));
  check("a made-up account id is rejected (422 ACCOUNT_INVALID), nothing saved", bogus.status === 422 && bogus.json?.error?.code === "ACCOUNT_INVALID", bogus.json);
  const d0 = await withLocalPg(async (sql) => (await sql`select count(*)::int n from public.document_intake_drafts where job_id=${jobId}`)[0].n);
  check("…and no draft row was created by the rejected save", d0 === 0, d0);

  const noAcct = await confirm(WHO.dubai, review({ accounts: { ...review().accounts, supplierAccountId: "" } }), "handoff");
  check("hand-off without the supplier account is blocked (422)", noAcct.status === 422 && /account:supplier/.test(JSON.stringify(noAcct.json)), noAcct.json);
  const noRate = await confirm(WHO.dubai, review({ exchange: { ...review().exchange, confirmed: false } }), "handoff");
  check("hand-off with an UNCONFIRMED exchange rate is blocked (422)", noRate.status === 422 && /rate_unconfirmed/.test(JSON.stringify(noRate.json)), noRate.json);

  const s1 = await confirm(WHO.dubai, review());
  check("save draft ok (200) with a DID number", s1.status === 200 && !!s1.data?.result?.draftNo, s1.json);
  const did1 = s1.data?.result?.draftNo;
  const draftId1 = s1.data?.result?.draftId;
  const s2 = await confirm(WHO.dubai, review({ form: { ...review().form, totalAmount: "61000", notes: "edited" }, exchange: { ...review().exchange, originalAmount: 61000, finalAmount: 224022.5 } }));
  check("re-save UPDATES the same draft (same id + DID number)", s2.status === 200 && s2.data?.result?.draftId === draftId1 && s2.data?.result?.draftNo === did1 && s2.data?.result?.updatedInPlace === true, s2.json);
  const cnt = await withLocalPg(async (sql) => (await sql`select count(*)::int n, count(*) filter (where status='prepared')::int p from public.document_intake_drafts where job_id=${jobId}`)[0]);
  check("exactly ONE draft row exists for the job after two saves (no duplicate bill/draft)", cnt.n === 1 && cnt.p === 1, cnt);
  const row = await withLocalPg(async (sql) => (await sql`select draft_payload, line_items from public.document_intake_drafts where id=${draftId1}`)[0]);
  const pl = row.draft_payload;
  check("draft payload carries the supplier ACCOUNT ID, party, original contract no. and the USD amount", pl.purchaseAccountId === DALIAN_ACCOUNT && pl.supplierName === "DALIAN SUNSHINE IMP. & EXP." && pl.purchaseContractNo === "0907B" && pl.totalAmount === 61000, pl);
  check("draft payload keeps the confirmed exchange state (USD->AED 3.6725 = 224,022.5) and the original amount", pl._review?.exchange?.finalAmount === 224022.5 && pl._review?.exchange?.originalAmount === 61000 && pl.secondaryCurrency === "AED" && pl.exchangeRate === 3.6725, pl._review?.exchange);
  const corr = fields.length ? await withLocalPg(async (sql) => (await sql`select corrected_value from public.document_intake_fields where job_id=${jobId} and field_key='grand_total'`)[0]?.corrected_value) : null;
  check("the correction (61000) was written back to the extracted field", String(corr) === "61000", corr);

  // ── 4. reopen: Queue -> Open -> everything restored without re-upload ──────────────────────────────
  const re = await api(WHO.dubai, "GET", `/api/erp/document-intelligence/${jobId}`);
  const saved = re.data?.draft?.draft_payload?._review;
  check("reopen: saved draft returned with the job (module, account, total, notes, rate)", saved?.moduleId === "purchase_booking" && saved?.accounts?.supplierAccountId === DALIAN_ACCOUNT && saved?.form?.totalAmount === "61000" && saved?.form?.notes === "edited" && saved?.exchange?.rate === 3.6725, saved);
  check("reopen: job is draft_ready and the original file is still served", re.data?.job?.status === "draft_ready", re.data?.job?.status);
  const fileRes = await fetch(`${BASE}/api/erp/document-intelligence/${jobId}/file`, { headers: { Cookie: cookie(WHO.dubai) } });
  const fbytes = Buffer.from(await fileRes.arrayBuffer());
  check("reopen: original PDF still downloadable (no re-upload needed)", fileRes.status === 200 && fbytes.slice(0, 4).toString() === "%PDF", fileRes.status);
  const proc2 = await api(WHO.dubai, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "process" });
  check("a plain 'process' on a reviewed job does NOT wipe the review (already_processed)", proc2.data?.result?.status === "already_processed", proc2.json);
  const fAfter = await withLocalPg(async (sql) => (await sql`select corrected_value from public.document_intake_fields where job_id=${jobId} and field_key='grand_total'`)[0]?.corrected_value);
  check("…the corrected total survived", String(fAfter) === "61000", fAfter);

  // ── 5. same file uploaded again with the same key: reused, not duplicated ──────────────────────────
  const again = await upload(WHO.dubai, runKey, dubaiScope, "purchase_booking");
  check("re-upload with the same idempotency key reuses the job (deduped, status kept)", again.job?.id === jobId && again.job?.deduped === true && again.job?.status === "draft_ready", again.job);
  const other = await upload(WHO.dubai, runKey + "-b", dubaiScope, "purchase_booking");
  const otherId = other.job?.id;
  const ctxDup = await api(WHO.dubai, "GET", `/api/erp/document-intelligence/${otherId}/context?moduleId=purchase_booking`);
  check("same FILE under a new key is flagged as a possible duplicate in the review context", (ctxDup.data?.duplicates ?? []).some((d: any) => d.id === jobId && d.reason === "same_file"), ctxDup.data?.duplicates);

  // ── 6. hand-off (all checks pass) ───────────────────────────────────────────────────────────────────
  const ho = await confirm(WHO.dubai, review({ exchange: { ...review().exchange, originalAmount: 61000, finalAmount: 224022.5 }, form: { ...review().form, totalAmount: "61000" } }), "handoff");
  check("hand-off passes once account + confirmed rate exist, returns the payload for the target form", ho.status === 200 && ho.data?.result?.payload?.purchaseAccountId === DALIAN_ACCOUNT && ho.data?.result?.payload?.operator === "*", ho.json);

  // ── 7. change module: Purchase -> Sales clears the supplier mapping, revalidates ─────────────────────
  const um = await api(WHO.dubai, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "update_module", moduleId: "sales_booking" });
  check("update_module to sales_booking ok", um.status === 200 && um.data?.result?.targetModule === "sales_orders", um.json);
  const ctxS = await api(WHO.dubai, "GET", `/api/erp/document-intelligence/${jobId}/context?moduleId=sales_booking`);
  check("sales context: counter-party is now the document BUYER (DGT LLC), not the Seller", ctxS.data?.partyRole === "customer" && /DGT/i.test(ctxS.data?.documentPartyName ?? "") && ctxS.data?.selectedPartyId !== DALIAN_COMPANY, { r: ctxS.data?.partyRole, n: ctxS.data?.documentPartyName, sel: ctxS.data?.selectedPartyId });
  const salesSave = await api(WHO.dubai, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "confirm", linkMode: "new_record", targetModule: "sales_orders", intent: "draft", countryId: UAE, countryBranchId: dubaiScope.cb, cityBranchId: dubaiScope.city, review: review({ moduleId: "sales_booking", party: { id: null, kind: null, name: "", documentName: "DGT LLC" } }) });
  const salesPl = salesSave.data?.result?.payload;
  check("saving as Sales prunes the leftover supplier account (it never reaches the sales payload)", salesSave.status === 200 && salesPl?.purchaseAccountId === undefined && salesPl?.supplierName === undefined && salesPl?._review?.accounts?.supplierAccountId === "", salesSave.json);

  // ── 8. Shipping cargo (customer order): never any price / currency ───────────────────────────────────
  const cargo = await api(WHO.dubai, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "update_module", moduleId: "customer_order" });
  check("update_module to customer_order (shipping cargo) ok", cargo.status === 200 || cargo.status === 403, cargo.json);
  if (cargo.status === 200) {
    const cs = await api(WHO.dubai, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "confirm", linkMode: "new_record", targetModule: "clearing_customer_orders", intent: "draft", countryId: UAE, countryBranchId: dubaiScope.cb, cityBranchId: dubaiScope.city, review: review({ moduleId: "customer_order", party: { id: null, kind: null, name: "", documentName: "DGT LLC" } }) });
    const p = cs.data?.result?.payload ?? {};
    const banned = ["currency", "currencyCode", "purchaseCurrency", "totalAmount", "orderTotal", "coursePrice", "exchangeRate", "paymentTerms", "secondaryCurrency", "grandTotal"].filter((k) => p[k] !== undefined);
    check("cargo draft contains NO price / currency / amount / rate / payment keys", cs.status === 200 && banned.length === 0 && p.goodsName === "Plastic Raw Material", { status: cs.status, banned, p });
  }

  // ── 9. role / scope restrictions ─────────────────────────────────────────────────────────────────────
  const deiraGet = await api(WHO.deira, "GET", `/api/erp/document-intelligence/${jobId}`);
  check("another Dubai branch (Deira) cannot open the demo-branch job (403/404)", deiraGet.status === 403 || deiraGet.status === 404, deiraGet.status);
  const pkGet = await api(WHO.pk, "GET", `/api/erp/document-intelligence/${jobId}`);
  check("Pakistan admin cannot open the UAE job (403/404)", pkGet.status === 403 || pkGet.status === 404, pkGet.status);
  const pkCtx = await api(WHO.pk, "GET", `/api/erp/document-intelligence/${jobId}/context?moduleId=purchase_booking`);
  check("Pakistan admin cannot read the UAE review context (403/404)", pkCtx.status === 403 || pkCtx.status === 404, pkCtx.status);
  const pkSave = await api(WHO.pk, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "confirm", linkMode: "new_record", targetModule: "purchase_orders", intent: "draft", review: review() });
  check("Pakistan admin cannot save into the UAE job", pkSave.status === 403 || pkSave.status === 404, pkSave.status);
  const uaeGet = await api(WHO.uae, "GET", `/api/erp/document-intelligence/${jobId}/context?moduleId=purchase_booking`);
  check("UAE country admin CAN open the UAE job's review context", uaeGet.status === 200 && !!uaeGet.data?.accountOptions?.length, uaeGet.status);
  const list = await api(WHO.dubai, "GET", `/api/erp/document-intelligence?limit=200`);
  const lr = (list.data?.rows ?? []).find((r: any) => r.id === jobId);
  check("Queue row lists the job with a real field count and its draft reference", !!lr && Number(lr.field_count) > 15 && !!lr.draft_reference, lr && { fc: lr.field_count, d: lr.draft_reference });

  // regression: a save that carries NO scope ids (e.g. opened by deep link) must keep the job in its owner's scope
  const noScope = await api(WHO.dubai, "PATCH", `/api/erp/document-intelligence/${jobId}`, { action: "confirm", linkMode: "new_record", targetModule: "purchase_orders", intent: "draft", countryId: null, countryBranchId: null, cityBranchId: null, review: review({ moduleId: "purchase_booking" }) });
  const jobScope = await withLocalPg(async (sql) => (await sql`select city_branch_id, country_branch_id from public.document_intake_jobs where id=${jobId}`)[0]);
  const stillMine = await api(WHO.dubai, "GET", `/api/erp/document-intelligence/${jobId}`);
  check("a save with empty scope ids keeps the job inside its owner's branch scope (still readable)", noScope.status === 200 && jobScope.city_branch_id === dubaiScope.city && stillMine.status === 200, { noScope: noScope.status, jobScope, still: stillMine.status });

  // ── 10. posted records are read-only here ─────────────────────────────────────────────────────────────
  await withLocalPg(async (sql) => { await sql`update public.document_intake_jobs set status='linked' where id=${jobId}`; });
  const post = await confirm(WHO.dubai, review());
  check("a LINKED (entered) document cannot be re-saved here: 409 ALREADY_POSTED", post.status === 409 && post.json?.error?.code === "ALREADY_POSTED", post.json);
  await withLocalPg(async (sql) => { await sql`update public.document_intake_jobs set status='draft_ready' where id=${jobId}`; });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed; job=${jobId}; draft=${did1}`);
  if (failed.length) { console.log("FAILED:", failed.map((f) => f.label).join(" | ")); process.exitCode = 1; }
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
