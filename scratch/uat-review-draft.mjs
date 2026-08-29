import fs from "node:fs";
const BASE="http://localhost:3000";
const COOKIE=fs.readFileSync("scratch/uat-cookies.txt","utf8").split(/\r?\n/).map(l=>l.replace(/^#HttpOnly_/,"")).filter(l=>l&&!l.startsWith("#")&&l.includes("\t")).map(l=>{const p=l.split("\t");return `${p[5]}=${p[6]}`}).join("; ");
const H={cookie:COOKIE,"content-type":"application/json"};
const jobId=fs.readFileSync("scratch/uat-job-id.txt","utf8").trim();
const j=async r=>{const t=await r.text();try{return JSON.parse(t)}catch{return{_raw:t.slice(0,300),_st:r.status}}};

// fresh process
await fetch(`${BASE}/api/erp/document-intelligence/${jobId}`,{method:"PATCH",headers:H,body:JSON.stringify({action:"process"})});

// --- REVIEW: correct + verify to ground truth ---
const corrections = [
  ["supplier_name", "DALIAN SUNSHINE IMP. & EXP."],
  ["customer_name", "DAMMAN GENERAL TRADING LLC."],
  ["currency", "USD"],
  ["grand_total", "220500"],
  ["advance_amount", "22050"],
  ["document_date", "2025-09-08"],
  ["invoice_number", "DSA-25087"],
  ["payment_terms", "10% Deposit USD 22,050.00 within 3 days; balance within 7 days before container arrival"],
  ["bank_name", "China Construction Bank, Dalian Branch"],
];
for (const [k,v] of corrections) {
  const r = await fetch(`${BASE}/api/erp/document-intelligence/${jobId}/fields`,{method:"PATCH",headers:H,body:JSON.stringify({fieldKey:k,correctedValue:v,verified:true})});
  const rr = await j(r);
  console.log(`  verify ${k} <- "${v}" : ${r.status} ${rr.ok?'OK':JSON.stringify(rr).slice(0,120)}`);
}

// --- state after review ---
let g=(await j(await fetch(`${BASE}/api/erp/document-intelligence/${jobId}`,{headers:H}))).data;
console.log("\nafter review: status", g.job.status, "| all fields verified:", (g.fields||[]).every(f=>f.verified));

// --- CONFIRM DRAFT: override to purchase, new record ---
let r=await fetch(`${BASE}/api/erp/document-intelligence/${jobId}`,{method:"PATCH",headers:H,body:JSON.stringify({action:"confirm",targetModule:"purchase_orders",linkMode:"new_record"})});
let cd=await j(r);
console.log("\nCONFIRM DRAFT:",r.status,JSON.stringify(cd).slice(0,300));
const draftId = cd?.data?.draftId || cd?.data?.result?.draftId;

// --- GET DRAFT ---
if (draftId) {
  const dr=(await j(await fetch(`${BASE}/api/erp/document-intelligence/drafts/${draftId}`,{headers:H}))).data;
  console.log("\nDRAFT", dr.draft_no, "target:", dr.target_module, "linkMode:", dr.link_mode, "currency:", dr.currency);
  console.log("PURCHASE PREFILL PAYLOAD:");
  console.log(JSON.stringify(dr.draft_payload, null, 1));
  console.log("GOODS/LINE ITEMS:", JSON.stringify(dr.line_items));
  fs.writeFileSync("scratch/uat-draft-id.txt", draftId);
}
