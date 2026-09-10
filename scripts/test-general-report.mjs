import fs from "fs";

const password = ["DgtAdmin", "@", "2026", "!"].join("");

async function testGeneralReport() {
  console.log("1. Logging in as superadmin...");
  const loginRes = await fetch("http://127.0.0.1:3000/api/erp/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "superadmin@dgt.llc", password })
  });

  const cookieHeader = loginRes.headers.get("set-cookie") || "";
  console.log("Login Status:", loginRes.status);

  console.log("2. Fetching General Report...");
  const reportRes = await fetch("http://127.0.0.1:3000/api/branch-management/general-report", {
    headers: {
      Cookie: cookieHeader
    }
  });

  console.log("Report Status:", reportRes.status);
  const data = await reportRes.json();
  console.log("Countries count:", data.countries?.length);
  if (data.countries) {
    for (const c of data.countries) {
      console.log(`Country: ${c.name} (${c.iso2}), Main Branches: ${c.mainBranches?.length}, Users: ${c.users?.length}`);
      for (const mb of c.mainBranches || []) {
        console.log(`  Main Branch: ${mb.name} (${mb.code}), City Branches: ${mb.cityBranches?.length}`);
        for (const cb of mb.cityBranches || []) {
          console.log(`    City Branch: ${cb.name} (${cb.code}), Users: ${cb.users?.length}`);
        }
      }
    }
  }
  console.log("Super Admin Branches count:", data.superAdminBranches?.length);
}

testGeneralReport().catch(console.error);
