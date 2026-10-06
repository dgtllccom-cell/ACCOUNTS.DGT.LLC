import fetch from "node-fetch";

async function verifyAll() {
  const baseUrl = "http://127.0.0.1:3000";
  console.log("=== Comprehensive ERP Module-by-Module Verification ===");

  // 1. Super Admin Authentication
  const testPass = process.env.TEST_ADMIN_PASSWORD || "";
  const loginRes = await fetch(`${baseUrl}/api/erp/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "all.superadmin@dgt.llc", password: testPass })
  });
  if (!loginRes.ok) {
    console.error("Login failed!");
    return;
  }
  const cookies = loginRes.headers.get("set-cookie") || "";
  console.log("✓ Super Admin Session Authenticated");

  const modules = [
    { name: "Executive Dashboard", url: "/dashboard" },
    { name: "Purchase Orders Register", url: "/api/erp/purchases/orders" },
    { name: "Purchase Loading Records Queue", url: "/api/erp/purchases/loading-records" },
    { name: "Purchase Loading UI Page", url: "/dashboard/purchase/purchase-loading-records" },
    { name: "Local Purchase", url: "/dashboard/purchase/local-purchase" },
    { name: "Sales Management UI", url: "/dashboard/sales" },
    { name: "Sales Orders API", url: "/api/erp/sales/orders" },
    { name: "Smart CRM Dashboard API", url: "/api/erp/crm/dashboard" },
    { name: "Smart CRM Control Center UI", url: "/dashboard/crm" },
    { name: "Customer 360 API", url: "/api/erp/crm/customer-360" },
    { name: "Shipping Line Dashboard UI", url: "/dashboard/shipping-line" },
    { name: "Shipping BL Records API", url: "/api/erp/shipping/bl-records" },
    { name: "Shipping Lines Master API", url: "/api/erp/shipping-lines" },
    { name: "Roznamcha / Daybook UI", url: "/dashboard/roznamcha" },
    { name: "Roznamcha Cash Register API", url: "/api/erp/roznamcha" },
    { name: "Ledgers Register API", url: "/api/erp/ledgers" },
    { name: "Ledger Accounts UI", url: "/dashboard/ledger" },
    { name: "Enterprise Accounts UI", url: "/dashboard/accounts" },
    { name: "Enterprise Accounts API", url: "/api/erp/accounts" },
    { name: "Goods Master Register API", url: "/api/erp/goods-master" },
    { name: "Goods Master Settings UI", url: "/dashboard/settings/goods-master" },
    { name: "Country & Territory Management UI", url: "/dashboard/country" },
    { name: "Branch Management UI", url: "/dashboard/branch-management" },
    { name: "Users & Access Control UI", url: "/dashboard/users" },
    { name: "Users Directory API", url: "/api/erp/users?limit=10" },
    { name: "Tax & E-Invoicing (UAE) Dashboard", url: "/dashboard/tax-einvoicing/uae/dashboard" },
    { name: "Transfer Center UI", url: "/dashboard/transfer-center" },
    { name: "Payment Journals UI", url: "/dashboard/journal" }
  ];

  let passed = 0;
  let failed = 0;

  for (const m of modules) {
    try {
      const res = await fetch(`${baseUrl}${m.url}`, {
        headers: { "Cookie": cookies }
      });
      const ok = res.status >= 200 && res.status < 400;
      if (ok) passed++; else failed++;
      console.log(`[${ok ? "PASS" : "FAIL"}] ${m.name} -> ${m.url} (Status: ${res.status})`);
    } catch (err) {
      failed++;
      console.log(`[FAIL] ${m.name} -> ${m.url} (Error: ${err.message})`);
    }
  }

  console.log(`\nFinal Verification Result: ${passed} PASSED, ${failed} FAILED across all ${modules.length} modules.`);
}

verifyAll();
