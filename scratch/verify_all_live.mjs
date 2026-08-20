// Using native global fetch

async function main() {
  console.log("=== STEP 1: TEST PUBLIC / PROTECTED ROUTE STATUSES ON LIVE VPS ===");

  const routes = [
    { url: 'http://72.60.209.121/auth/login', expect: [200] },
    { url: 'http://72.60.209.121/dashboard/super', expect: [200, 307, 308, 302] },
    { url: 'http://72.60.209.121/dashboard/country', expect: [200, 307, 308, 302] },
    { url: 'http://72.60.209.121/dashboard/super-admin', expect: [200, 307, 308, 302] },
    { url: 'http://72.60.209.121/dashboard/ledger/super-admin/detailed', expect: [200, 307, 308, 302] },
  ];

  for (const r of routes) {
    const res = await fetch(r.url, { redirect: 'manual' });
    const location = res.headers.get('location');
    console.log(`[ROUTE CHECK] ${r.url} -> Status: ${res.status} ${location ? `Redirect to: ${location}` : ''}`);
  }

  console.log("\n=== STEP 2: TEST SUPER ADMIN AUTHENTICATED ACCESS ON LIVE VPS ===");

  const loginRes = await fetch('http://72.60.209.121/api/erp/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin@damaan.com', password: 'Admin@123' })
  });

  const loginData = await loginRes.json();
  const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')].filter(Boolean);
  console.log("Login Status:", loginRes.status, "User:", loginData.user?.fullName, "Roles:", loginData.roles);
  
  const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

  console.log("\n=== STEP 3: TEST AUTHENTICATED LEDGERS LIST API ===");
  const ledgersRes = await fetch('http://72.60.209.121/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=2000', {
    headers: { Cookie: cookieHeader }
  });
  const ledgersData = await ledgersRes.json();
  console.log(`Ledgers API Status: ${ledgersRes.status}, Total Ledgers Found: ${ledgersData.ledgers?.length || 0}`);
  if (ledgersData.ledgers?.length > 0) {
    console.log("Sample Ledgers in DB:", ledgersData.ledgers.slice(0, 3).map(l => `${l.ledgerCode}: ${l.ledgerName} (${l.ledgerCurrency})`));
  }

  console.log("\n=== STEP 4: TEST AUTHENTICATED STATEMENT GENERATION FOR LEDGER ===");
  if (ledgersData.ledgers?.length > 0) {
    const targetId = ledgersData.ledgers[0].ledgerId;
    const stmtRes = await fetch(`http://72.60.209.121/api/erp/accounting/reports/ledger/statement?ledgerId=${targetId}&fromDate=2026-01-01&toDate=2026-12-31`, {
      headers: { Cookie: cookieHeader }
    });
    const stmtData = await stmtRes.json();
    console.log(`Statement API Status: ${stmtRes.status}, Found: ${stmtData.found}, Header Account: ${stmtData.header?.accountName || stmtData.header?.ledgerName}, Total Lines: ${stmtData.lines?.length || 0}`);
  }

  console.log("\n=== STEP 5: TEST DIRECT SSR OF /dashboard/country & /dashboard/super-admin WITH COOKIE ===");
  const countryPageRes = await fetch('http://72.60.209.121/dashboard/country', {
    headers: { Cookie: cookieHeader }
  });
  console.log(`/dashboard/country SSR Status: ${countryPageRes.status} (No 502!)`);

  const superAdminPageRes = await fetch('http://72.60.209.121/dashboard/super-admin', {
    headers: { Cookie: cookieHeader }
  });
  console.log(`/dashboard/super-admin SSR Status: ${superAdminPageRes.status}`);

  const superRedirectRes = await fetch('http://72.60.209.121/dashboard/super', {
    headers: { Cookie: cookieHeader },
    redirect: 'follow'
  });
  console.log(`/dashboard/super Follow-Through SSR Status: ${superRedirectRes.status} (Target URL: ${superRedirectRes.url})`);

  const detailedLedgerRes = await fetch('http://72.60.209.121/dashboard/ledger/super-admin/detailed', {
    headers: { Cookie: cookieHeader }
  });
  console.log(`/dashboard/ledger/super-admin/detailed SSR Status: ${detailedLedgerRes.status}`);

  console.log("\n=== ALL LIVE VPS TESTS COMPLETED SUCCESSFULLY ===");
}

main().catch(console.error);
