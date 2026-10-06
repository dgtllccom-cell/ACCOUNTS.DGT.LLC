import fs from "fs";

const routes = [
  "/api/erp/auth/session",
  "/api/erp/roznamcha/reports?entryCategory=all",
  "/api/erp/roznamcha/reports?entryCategory=cash",
  "/api/erp/roznamcha/reports?entryCategory=bank",
  "/api/erp/roznamcha/reports?entryCategory=business",
  "/api/erp/roznamcha/reports?entryCategory=invoice",
  "/api/erp/roznamcha/reports?entryCategory=transfer",
  "/api/erp/accounts",
  "/api/erp/accounts/bank",
  "/api/erp/customers",
  "/api/erp/companies",
  "/api/erp/locations/countries?all=true",
  "/api/erp/locations/ports",
  "/api/erp/goods",
  "/api/erp/goods-master",
  "/api/erp/purchases/orders",
  "/api/erp/purchases/loading-records",
  "/api/erp/purchases/local-purchase",
  "/api/erp/purchases/booking-journal-report",
  "/api/erp/purchases/journal-booking-stock",
  "/api/erp/sales/orders",
  "/api/erp/clearing-agent/customer-order",
  "/api/erp/clearing-agent/truck-loading",
  "/api/erp/admin/dashboard-settings",
  "/api/erp/ledgers",
  "/api/erp/money-exchange"
];

async function runTests() {
  console.log("Testing API routes against VPS endpoint (72.60.209.121)...");
  
  let failed = 0;
  let passed = 0;

  for (const r of routes) {
    try {
      const res = await fetch(`http://72.60.209.121${r}`, {
        headers: {
          "Accept": "application/json"
        }
      });
      const status = res.status;
      const text = await res.text();
      
      if (status === 200 || status === 201) {
        console.log(`✅ [${status}] ${r}`);
        passed++;
      } else if (status === 401 || status === 403) {
        console.log(`🔒 [${status} AUTH REQUIRED] ${r}`);
        passed++;
      } else {
        console.log(`❌ [${status} ERROR] ${r}`);
        console.log(`   Response: ${text.slice(0, 150)}`);
        failed++;
      }
    } catch (err) {
      console.log(`💥 [FAILED TO CONNECT] ${r} -> ${err.message}`);
      failed++;
    }
  }

  console.log(`\nTest completed: ${passed} OK, ${failed} Failed.`);
}

runTests();
