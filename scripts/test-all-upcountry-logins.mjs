const BASE_URL = "http://72.60.209.121:3000";
const PASSWORD = "Admin@123";

const TEST_LOGINS = [
  // Super Admin
  { user: "SUPERADMIN@DGT.LLC", expectedRole: "Super Admin", scope: "Global" },
  
  // Country Admins
  { user: "PAKISTAN@DGT.LLC", expectedRole: "Country Admin", scope: "Pakistan" },
  { user: "AFGHANISTAN@DGT.LLC", expectedRole: "Country Admin", scope: "Afghanistan" },
  { user: "INDIA@DGT.LLC", expectedRole: "Country Admin", scope: "India" },
  { user: "UAE@DGT.DALNC", expectedRole: "Country Admin", scope: "UAE" },
  { user: "UAE@DGT.LLC", expectedRole: "Country Admin", scope: "UAE" },
  { user: "CHINA@DGT.LLC", expectedRole: "Country Admin", scope: "China" },

  // City Branches
  { user: "PK/CHAMAN@DGT.LLC", expectedRole: "City Branch User", scope: "Pakistan - Chaman" },
  { user: "PK/QUETTA@DGT.LLC", expectedRole: "City Branch User", scope: "Pakistan - Quetta" },
  { user: "PK/KARACHI@DGT.LLC", expectedRole: "City Branch User", scope: "Pakistan - Karachi" },
  { user: "AF/KABUL@DGT.DALNC", expectedRole: "City Branch User", scope: "Afghanistan - Kabul" },
  { user: "AF/KANDAHAR@DGT.LLC", expectedRole: "City Branch User", scope: "Afghanistan - Kandahar" },
  { user: "AE/DUBAI@DGT.LLC", expectedRole: "City Branch User", scope: "UAE - Dubai" },
  { user: "IN/DELHI@DGT.LLC", expectedRole: "City Branch User", scope: "India - Delhi" },
  { user: "CN/SHENZHEN@DGT.LLC", expectedRole: "City Branch User", scope: "China - Shenzhen" },

  // Clearing Agents
  { user: "PK/CLEARINGAGENT@DGT.LLC", expectedRole: "Country Clearing Agent", scope: "Pakistan Shipping" },
  { user: "AE/CLEARINGAGENT@DGT.LLC", expectedRole: "Country Clearing Agent", scope: "UAE Shipping" },
  { user: "PK/CH/CLEARINGAGENT@DGT.DALNC", expectedRole: "Branch Clearing Agent", scope: "Chaman Shipping" },
  { user: "PK/QTA/CLEARINGAGENT@DGT.DALNC", expectedRole: "Branch Clearing Agent", scope: "Quetta Shipping" },
  { user: "AE/DXB/CLEARINGAGENT@DGT.LLC", expectedRole: "Branch Clearing Agent", scope: "Dubai Port Shipping" }
];

async function runTests() {
  console.log("==========================================================================");
  console.log(`🧪 LIVE AUTHENTICATION TEST SUITE [${BASE_URL}]`);
  console.log("==========================================================================\n");

  const report = [];

  for (const item of TEST_LOGINS) {
    try {
      const res = await fetch(`${BASE_URL}/api/erp/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          identifier: item.user,
          password: PASSWORD
        })
      });

      const json = await res.json().catch(() => ({}));
      const ok = res.status === 200 && json.success === true;

      report.push({
        "Username": item.user,
        "Role": item.expectedRole,
        "Assigned Scope": item.scope,
        "HTTP Status": res.status,
        "Redirect URL": json.redirectUrl || "-",
        "Test Result": ok ? "✅ PASSED" : `❌ FAILED: ${json.error || res.statusText}`
      });
    } catch (err) {
      report.push({
        "Username": item.user,
        "Role": item.expectedRole,
        "Assigned Scope": item.scope,
        "HTTP Status": "ERR",
        "Redirect URL": "-",
        "Test Result": `❌ FAILED: ${err.message}`
      });
    }
  }

  console.table(report);

  const allPassed = report.every(r => r["Test Result"].includes("PASSED"));
  console.log("\n==========================================================================");
  if (allPassed) {
    console.log("🎉 ALL USER LOGINS VERIFIED AND AUTHENTICATED SUCCESSFULLY ON PRODUCTION!");
  } else {
    console.log("⚠️ SOME LOGIN TESTS FAILED - CHECK DETAILS ABOVE");
  }
  console.log("==========================================================================");
}

runTests().catch(console.error);
