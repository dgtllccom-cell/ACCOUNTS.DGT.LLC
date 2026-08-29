import fs from "node:fs";
const BASE = "http://localhost:3000";
const COOKIE = fs.readFileSync("scratch/uat-cookies.txt", "utf8").split(/\r?\n/).map(l => l.replace(/^#HttpOnly_/, "")).filter(l => l && !l.startsWith("#") && l.includes("\t")).map(l => { const p = l.split("\t"); return `${p[5]}=${p[6]}`; }).join("; ");
const H = { cookie: COOKIE, "content-type": "application/json" };
const j = async r => { const t = await r.text(); try { return JSON.parse(t); } catch { return { _raw: t.slice(0, 400), _st: r.status }; } };

const jobId = fs.readFileSync("scratch/uat-job-id.txt", "utf8").trim();
const draftId = fs.readFileSync("scratch/uat-draft-id.txt", "utf8").trim();

const UAE = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const UAE_CB = "87c2e253-b6c1-482d-a808-272337f3ffda";
const UAE_CITY = "79b31aba-45f1-4aba-9068-fb3eb2102a81";
const RATE = 3.675;
const USD_TOTAL = 220500;
const AED_TOTAL = +(USD_TOTAL * RATE).toFixed(2);   // 810337.50
console.log(`USD ${USD_TOTAL} × ${RATE} = AED ${AED_TOTAL}`);

// ---- STEP: create the purchase order (draft prefill → real record) ----
const body = {
  countryId: UAE, countryBranchId: UAE_CB, cityBranchId: UAE_CITY,
  purchaseContractNo: "DSA2025-0908",
  purchaseOrderNo: "AUTO",
  purchaseCurrency: "USD", paymentCurrency: "AED", currencyCode: "USD",
  exchangeRate: RATE,
  orderTotal: USD_TOTAL,
  advanceAmount: 22050,
  totalGoodsOriginal: USD_TOTAL, totalGoodsLocal: AED_TOTAL, totalGoodsUsd: USD_TOTAL,
  landedCostOriginal: USD_TOTAL, landedCostLocal: AED_TOTAL, landedCostUsd: USD_TOTAL,
  originalLanguage: "en",
  formData: {
    form: {
      billNo: "DSA-25087",
      manualBillNumber: "DSA2025-0908",
      purchaseContractNo: "DSA2025-0908",
      purchaseDate: "2025-09-08",
      supplierName: "DALIAN SUNSHINE IMP. & EXP.",
      purchaseAccountName: "DEV TEST AE Purchase Account [LOCAL-LOADTEST-AUG2026-R01]",
      purchaseAccountNo: "LOADTEST-AE-PURCHASE",
      salesAccountName: "DALIAN SUNSHINE IMP. & EXP.",
      salesAccountNo: "UAE-DUB-AC-0003",
      supplierAccountNo: "UAE-DUB-AC-0003",
      purchaseCurrency: "USD", paymentCurrency: "AED", currencyType: "USD",
      exchangeRate: RATE,
      totalAmount: USD_TOTAL,
      advanceAmount: 22050,
      loadingPort: "Shenzhen, China", receivingPort: "Jebel Ali, UAE", loadingCountry: "China",
      shippingMode: "Sea — Refrigerated Container",
      goodsEntries: [{
        item: "Yunnan Walnut Kernels — Extra Light Halves (>90% halves, >90% extra light), 10kg net carton",
        goodsName: "Yunnan Walnut Kernels — Extra Light Halves",
        qtyNo: 45, qtyName: "TON", quantity: 45,
        netWeight: 45000, grossWeight: 45000,
        priceType: "P/Ton", coursePrice: 4900,
        totalAmount: USD_TOTAL, currency: "USD", currencyType: "USD", exchangeRate: RATE,
      }],
    },
    totals: { grandFinal: USD_TOTAL, totalAmount: USD_TOTAL, totalQuantity: 45 },
    documentIntake: { jobNo: "DI-2026-00001", draftNo: "DID-2026-00001", jobId, draftId },
  },
};

let r = await fetch(`${BASE}/api/erp/purchases/orders`, { method: "POST", headers: { ...H, "idempotency-key": `uat-po-dsa2025-0908` }, body: JSON.stringify(body) });
let po = await j(r);
console.log("\n1. CREATE PO:", r.status, JSON.stringify(po).slice(0, 400));
const poId = po?.data?.purchaseOrderId || po?.purchaseOrderId || po?.data?.id;
if (!poId) { console.error("no PO id"); process.exit(1); }
fs.writeFileSync("scratch/uat-po-id.txt", poId);

// ---- STEP: consume the draft (link job → created PO) ----
r = await fetch(`${BASE}/api/erp/document-intelligence/drafts/${draftId}`, { method: "PATCH", headers: H, body: JSON.stringify({ action: "consume", createdSourceModule: "purchase_orders", createdSourceId: poId }) });
console.log("2. CONSUME DRAFT:", r.status, JSON.stringify(await j(r)).slice(0, 250));

// ---- STEP: transfer (post to Business Roznamcha) ----
r = await fetch(`${BASE}/api/erp/purchases/orders/${poId}/transfer`, { method: "POST", headers: { ...H, "idempotency-key": `uat-transfer-${poId}` }, body: JSON.stringify({ remarks: "Real-contract UAT — DSA2025-0908 walnut kernels, USD→AED @ 3.675" }) });
let tr = await j(r);
console.log("3. TRANSFER:", r.status, JSON.stringify(tr).slice(0, 500));

// ---- STEP: duplicate transfer must be rejected ----
r = await fetch(`${BASE}/api/erp/purchases/orders/${poId}/transfer`, { method: "POST", headers: { ...H, "idempotency-key": `uat-transfer-dup-${poId}` }, body: JSON.stringify({ remarks: "dup attempt" }) });
console.log("4. DUPLICATE TRANSFER (expect blocked):", r.status, JSON.stringify(await j(r)).slice(0, 300));
