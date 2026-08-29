import fs from "node:fs";
const BASE="http://localhost:3000";
const COOKIE=fs.readFileSync("scratch/uat-cookies.txt","utf8").split(/\r?\n/).map(l=>l.replace(/^#HttpOnly_/,"")).filter(l=>l&&!l.startsWith("#")&&l.includes("\t")).map(l=>{const p=l.split("\t");return `${p[5]}=${p[6]}`}).join("; ");
const H={cookie:COOKIE,"content-type":"application/json"};
const j=async r=>{const t=await r.text();try{return JSON.parse(t)}catch{return{_raw:t.slice(0,400)}}};
const poId=fs.readFileSync("scratch/uat-po-id.txt","utf8").trim();

// Advance / deposit payment — the actual Mashreq transfer on the bank receipt (USD 20,050.00 @ 3.675)
const body = {
  kind: "advance",
  entryDate: "2025-10-03",
  amount: 20050,
  currencyCode: "USD",
  exchangeRate: 3.675,
  debitLedgerId: "fd7a5f86-d45c-4c55-8685-e0c08b1b0909",  // DALIAN SUNSHINE (supplier)
  creditLedgerId: "6b24ea23-9514-4311-aba3-94ba99a993f8", // AE Bank Ledger
  referenceNo: "MASHREQ 033DBFC252760922",
  narration: "10% deposit — Mashreq fund transfer 033DBFC252760922 to DALIAN SUNSHINE, USD 20,050.00 @ 3.675",
};
let r = await fetch(`${BASE}/api/erp/purchases/orders/${poId}/payments`, { method:"POST", headers:{...H,"idempotency-key":`uat-adv-${poId}`}, body: JSON.stringify(body) });
console.log("ADVANCE PAYMENT:", r.status, JSON.stringify(await j(r)).slice(0,500));
