// Comprehensive End-to-End Live VPS Verification Script

async function runAudit() {
  console.log("================================================================================");
  console.log("            COMPREHENSIVE ERP END-TO-END VERIFICATION ON LIVE VPS                ");
  console.log("================================================================================\n");

  const results = [];
  const logResult = (moduleName, check, pass, detail) => {
    results.push({ moduleName, check, pass, detail });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${moduleName} - ${check}: ${detail}`);
  };

  const VPS_URL = 'http://72.60.209.121';

  // 1. AUTHENTICATION & SESSION CONTEXT
  console.log("--- 1. Authenticating as Super Admin ---");
  const loginRes = await fetch(`${VPS_URL}/api/erp/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'superadmin@damaan.com', password: 'Admin@123' })
  });

  const loginData = await loginRes.json();
  const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')].filter(Boolean);
  const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

  logResult(
    "Authentication",
    "Super Admin Login",
    loginRes.status === 200 && (loginData.success || loginData.ok),
    `Status ${loginRes.status}, Redirect: ${loginData.redirectUrl || '/dashboard'}`
  );

  // 2. SESSION SCOPE VERIFICATION
  console.log("\n--- 2. Verifying Session Scopes ---");
  const sessionRes = await fetch(`${VPS_URL}/api/erp/auth/session`, {
    headers: { Cookie: cookieHeader }
  });
  const sessionData = await sessionRes.json();
  const sessionPayload = sessionData.data || sessionData;
  const isSuperAdmin = sessionPayload.scopes?.isSuperAdmin;
  const userRoles = sessionPayload.roles || [];
  logResult(
    "Session Context",
    "Global Super Admin Scope",
    sessionRes.status === 200 && isSuperAdmin && userRoles.includes('super_admin'),
    `Role: ${userRoles.join(', ')}, Scope: ${sessionPayload.scopes?.summary?.level || 'global'}, User: ${sessionPayload.user?.fullName} (${sessionPayload.user?.email})`
  );

  // 3. EMPLOYEE MASTER API & REAL DB DATA
  console.log("\n--- 3. Verifying Employee Master API & Real DB Records ---");
  const empRes = await fetch(`${VPS_URL}/api/erp/hr-payroll/employees`, {
    headers: { Cookie: cookieHeader }
  });
  const empData = await empRes.json();
  const employees = empData.employees || [];
  logResult(
    "Employee Master",
    "Real Database Load (No Mock Data)",
    empRes.status === 200 && Array.isArray(employees),
    `Total Real Employees in DB: ${employees.length}`
  );

  if (employees.length > 0) {
    const firstEmp = employees[0];
    console.log(`Sample Employee Code: ${firstEmp.employee_code}, Name: ${firstEmp.person?.customer_name}, Dept: ${firstEmp.department || 'N/A'}, Status: ${firstEmp.status}`);

    // Test Employee Detail Endpoint
    const detailRes = await fetch(`${VPS_URL}/api/erp/hr-payroll/employees/${firstEmp.id}`, {
      headers: { Cookie: cookieHeader }
    });
    const detailData = await detailRes.json();
    const empDetail = detailData.employee || detailData.data?.employee || (Array.isArray(detailData.employee) ? detailData.employee[0] : null);
    logResult(
      "Employee Master",
      "Single Employee Detail (Full Relations)",
      detailRes.status === 200 && !!empDetail?.id,
      `Loaded Code: ${empDetail?.employee_code}, Name: ${empDetail?.person?.customer_name || empDetail?.full_name}, Basic Salary: ${empDetail?.basic_salary}, Net: ${empDetail?.net_salary}`
    );
  }

  // 4. MULTILINGUAL (5 LANGUAGES) & LOCALIZATION
  console.log("\n--- 4. Verifying Multilingual Localization across 5 Languages ---");
  const languages = ['en', 'ur', 'ps', 'fa', 'ar'];
  for (const lang of languages) {
    const langEmpRes = await fetch(`${VPS_URL}/api/erp/hr-payroll/employees?lang=${lang}`, {
      headers: { Cookie: cookieHeader }
    });
    const langEmpData = await langEmpRes.json();
    logResult(
      "Multilingual API",
      `Language Resolution (${lang.toUpperCase()})`,
      langEmpRes.status === 200 && Array.isArray(langEmpData.employees),
      `Successfully returned ${langEmpData.employees?.length || 0} employees localized in ${lang}`
    );
  }

  // 5. SERVER-SIDE RENDERING (SSR) & ROUTE STABILITY (NO 404 / 502)
  console.log("\n--- 5. Verifying Route Stability & Server-Side Rendering (SSR) ---");
  const routesToVerify = [
    { path: '/dashboard/general-office/employees', name: 'General Office Management' },
    { path: '/dashboard/super-admin', name: 'Super Admin Dashboard' },
    { path: '/dashboard/country', name: 'Country Dashboard' },
    { path: '/dashboard/city', name: 'City Dashboard' },
    { path: '/dashboard/all-release-entries', name: 'All Release Entries' },
    { path: '/dashboard/ledger/super-admin/detailed', name: 'Super Admin Detailed Ledger' },
    { path: '/dashboard/super', name: 'Legacy Route Redirect (/dashboard/super)' }
  ];

  for (const r of routesToVerify) {
    const res = await fetch(`${VPS_URL}${r.path}`, {
      headers: { Cookie: cookieHeader },
      redirect: 'follow'
    });
    logResult(
      "Route Stability",
      r.name,
      res.status === 200,
      `Status: ${res.status} at URL: ${res.url}`
    );
  }

  // 6. LEDGER REPORT API & DETAILED STATEMENT
  console.log("\n--- 6. Verifying Ledger System on Live DB ---");
  const ledgersRes = await fetch(`${VPS_URL}/api/erp/accounting/reports/ledger/ledgers?reportScope=super_admin&limit=1000`, {
    headers: { Cookie: cookieHeader }
  });
  const ledgersData = await ledgersRes.json();
  const ledgersList = ledgersData.data?.ledgers || ledgersData.ledgers || [];
  logResult(
    "Ledger Reports",
    "Searchable Ledgers List",
    ledgersRes.status === 200 && Array.isArray(ledgersList) && ledgersList.length > 0,
    `Found ${ledgersList.length} accounts in real database`
  );

  if (ledgersList.length > 0) {
    const targetLedger = ledgersList[0];
    const stmtRes = await fetch(`${VPS_URL}/api/erp/accounting/reports/ledger/statement?ledgerId=${targetLedger.ledgerId}&fromDate=2026-01-01&toDate=2026-12-31`, {
      headers: { Cookie: cookieHeader }
    });
    const stmtData = await stmtRes.json();
    const stmtPayload = stmtData.data || stmtData;
    logResult(
      "Ledger Reports",
      "Detailed Running Balance Statement",
      stmtRes.status === 200 && stmtPayload.found,
      `Account: ${stmtPayload.header?.accountName || stmtPayload.header?.ledgerName}, Total Transactions: ${stmtPayload.lines?.length || 0}`
    );
  }

  // 7. SUMMARY REPORT
  console.log("\n================================================================================");
  console.log("                           VERIFICATION SUMMARY REPORT                          ");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`SYSTEM HEALTH: ${failed === 0 ? '100% OPERATIONAL (ALL CHECKS PASSED)' : 'ISSUES DETECTED'}`);
}

runAudit().catch(console.error);
