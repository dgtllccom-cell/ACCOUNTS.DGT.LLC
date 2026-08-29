import fs from "node:fs";
const BASE = "http://localhost:3000";
const COOKIE = fs.readFileSync("scratch/uat-cookies.txt","utf8").split(/\r?\n/)
  .map(l=>l.replace(/^#HttpOnly_/,""))
  .filter(l=>l && !l.startsWith("#") && l.includes("\t"))
  .map(l=>{const p=l.split("\t");return `${p[5]}=${p[6]}`}).join("; ");
const H = { "cookie": COOKIE };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { _raw: t.slice(0,500), _status: r.status }; } };

// 1. UPLOAD
const fd = new FormData();
fd.append("operationalDomain", "business");
fd.append("countryId", "935dd0b9-8228-43b3-b53d-c06e9ae2882f");       // UAE
fd.append("countryBranchId", "87c2e253-b6c1-482d-a808-272337f3ffda"); // DEV Demo Dubai
fd.append("cityBranchId", "79b31aba-45f1-4aba-9068-fb3eb2102a81");    // DEV Demo Dubai City Branch
fd.append("contractReference", "DSA2025-0908");
fd.append("documentReference", "DSA-25087");
fd.append("uploadMethod", "web");
fd.append("file", new Blob([fs.readFileSync("uat-samples/2-containers.pdf")], { type: "application/pdf" }), "2 containers .pdf");

let r = await fetch(`${BASE}/api/erp/document-intelligence/upload`, { method: "POST", headers: H, body: fd });
let up = await j(r);
console.log("1. UPLOAD:", r.status, JSON.stringify(up).slice(0, 300));
const jobId = up?.data?.job?.id || up?.job?.id || up?.data?.id;
if (!jobId) { console.error("no job id"); process.exit(1); }
console.log("   jobId:", jobId);

// 2. PROCESS
r = await fetch(`${BASE}/api/erp/document-intelligence/${jobId}`, { method: "PATCH", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ action: "process" }) });
console.log("2. PROCESS:", r.status, JSON.stringify(await j(r)).slice(0, 300));

// 3. GET
r = await fetch(`${BASE}/api/erp/document-intelligence/${jobId}`, { headers: H });
let g = await j(r);
const d = g?.data ?? g;
console.log("\n3. JOB STATE:");
console.log("   status:", d.job?.status, "| docType:", d.job?.doc_type_code, "conf:", d.job?.doc_type_confidence, "| target:", d.job?.target_module);
console.log("   ocr_engine:", d.job?.ocr_engine, "| pages:", d.job?.page_count, "| lang:", d.job?.language_detected, "| match_status:", d.job?.match_status);
console.log("   qvc_reason:", d.job?.qvc_reason);
console.log("   FIELDS:");
for (const f of d.fields ?? []) console.log(`     ${f.field_key} = "${f.corrected_value ?? f.normalized_value ?? f.raw_value}" [${f.validation_status} conf=${f.confidence} verified=${f.verified}]`);
console.log("   LINE ITEMS:", (d.lineItems ?? d.line_items ?? []).length);
for (const li of (d.lineItems ?? d.line_items ?? [])) console.log(`     #${li.line_no} ${li.description} | qty=${li.quantity} ${li.unit} | unit=${li.unit_price} | amt=${li.amount} ${li.currency}`);
console.log("   MATCHES:", (d.matches ?? []).length);
for (const m of d.matches ?? []) console.log(`     ${m.source_module} ${m.label} score=${m.score} scope_ok=${m.scope_ok} selected=${m.is_selected} — ${m.reason}`);

fs.writeFileSync("scratch/uat-job-id.txt", jobId);
