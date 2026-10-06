/**
 * RBAC Session Tests
 * Verify authorized vs unauthorized access by role
 * Super Admin, Country Admin, Branch Admin, User
 */

async function testRbacSessions() {
  console.log("🔐 RBAC EMAIL ENDPOINT TEST");
  console.log("=".repeat(70));

  const baseUrl = "http://localhost:3000"; // DEV only
  const results: any[] = [];

  // Test data: mailbox account IDs
  const testAccounts = {
    dgtllc_pk: "dgtllc_pk_001", // Pakistan country, primary branch
    dubai_ae: "dubai_ae_001",    // UAE country
    quetta_pk: "quetta_pk_001"   // Pakistan, Quetta city branch
  };

  try {
    console.log("\n1️⃣ SUPER ADMIN SESSION");
    const superAdminRes = await fetch(`${baseUrl}/api/erp/auth/dev-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "super_admin" })
    });

    if (superAdminRes.ok) {
      // Should have access to ALL accounts
      console.log("   ✅ Super Admin session created");

      // Test: Super Admin can access Pakistan mailbox
      const pkAccess = await fetch(`${baseUrl}/api/erp/email/${testAccounts.dgtllc_pk}/fetch`, {
        headers: { "Cookie": superAdminRes.headers.get("set-cookie") || "" }
      });
      console.log(`      Pakistan mailbox: ${pkAccess.status === 200 ? "✅ ACCESS" : `❌ DENIED (${pkAccess.status})`}`);
      results.push({ role: "SUPER_ADMIN", mailbox: "PK", status: pkAccess.status === 200 ? "PASS" : "FAIL" });

      // Test: Super Admin can access UAE mailbox
      const aeAccess = await fetch(`${baseUrl}/api/erp/email/${testAccounts.dubai_ae}/fetch`, {
        headers: { "Cookie": superAdminRes.headers.get("set-cookie") || "" }
      });
      console.log(`      UAE mailbox: ${aeAccess.status === 200 ? "✅ ACCESS" : `❌ DENIED (${aeAccess.status})`}`);
      results.push({ role: "SUPER_ADMIN", mailbox: "AE", status: aeAccess.status === 200 ? "PASS" : "FAIL" });
    } else {
      console.log("   ❌ Super Admin session failed (dev-session may not be available)");
    }

    console.log("\n2️⃣ COUNTRY ADMIN SESSION (Pakistan)");
    try {
      const pkAdminRes = await fetch(`${baseUrl}/api/erp/auth/dev-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "country_admin", countryId: "PK" })
      });

      if (pkAdminRes.ok) {
        console.log("   ✅ Pakistan Country Admin session created");

        // Should access PK mailbox
        const pkAccess = await fetch(`${baseUrl}/api/erp/email/${testAccounts.dgtllc_pk}/fetch`, {
          headers: { "Cookie": pkAdminRes.headers.get("set-cookie") || "" }
        });
        console.log(`      Pakistan mailbox: ${pkAccess.status === 200 ? "✅ ACCESS" : `❌ DENIED (${pkAccess.status})`}`);
        results.push({ role: "COUNTRY_ADMIN_PK", mailbox: "PK", status: pkAccess.status === 200 ? "PASS" : "FAIL" });

        // Should NOT access UAE mailbox
        const aeAccess = await fetch(`${baseUrl}/api/erp/email/${testAccounts.dubai_ae}/fetch`, {
          headers: { "Cookie": pkAdminRes.headers.get("set-cookie") || "" }
        });
        console.log(`      UAE mailbox: ${aeAccess.status === 403 ? "✅ DENIED (403)" : `❌ ALLOWED (${aeAccess.status})`}`);
        results.push({ role: "COUNTRY_ADMIN_PK", mailbox: "AE", status: aeAccess.status === 403 ? "PASS" : "FAIL" });
      } else {
        console.log("   ⚠️ Country Admin session creation not available");
      }
    } catch (err) {
      console.log("   ⚠️ Country Admin test skipped");
    }

    console.log("\n3️⃣ BRANCH ADMIN SESSION");
    try {
      const branchAdminRes = await fetch(`${baseUrl}/api/erp/auth/dev-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "branch_admin", branchId: "quetta_pk_01" })
      });

      if (branchAdminRes.ok) {
        console.log("   ✅ Branch Admin (Quetta) session created");

        // Should access Quetta mailbox
        const quettaAccess = await fetch(`${baseUrl}/api/erp/email/${testAccounts.quetta_pk}/fetch`, {
          headers: { "Cookie": branchAdminRes.headers.get("set-cookie") || "" }
        });
        console.log(`      Quetta mailbox: ${quettaAccess.status === 200 ? "✅ ACCESS" : `❌ DENIED (${quettaAccess.status})`}`);
        results.push({ role: "BRANCH_ADMIN", mailbox: "Quetta", status: quettaAccess.status === 200 ? "PASS" : "FAIL" });

        // Should NOT access other mailbox
        const otherAccess = await fetch(`${baseUrl}/api/erp/email/${testAccounts.dgtllc_pk}/fetch`, {
          headers: { "Cookie": branchAdminRes.headers.get("set-cookie") || "" }
        });
        console.log(`      Other mailbox: ${otherAccess.status === 403 ? "✅ DENIED (403)" : `⚠️ ${otherAccess.status}`}`);
        results.push({ role: "BRANCH_ADMIN", mailbox: "Other", status: otherAccess.status === 403 ? "PASS" : "FAIL" });
      } else {
        console.log("   ⚠️ Branch Admin session creation not available");
      }
    } catch (err) {
      console.log("   ⚠️ Branch Admin test skipped");
    }

    console.log("\n4️⃣ TAMPERING TEST (Manual accountId modification)");
    try {
      const userRes = await fetch(`${baseUrl}/api/erp/auth/dev-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user" })
      });

      if (userRes.ok) {
        // Try to access a random/invalid mailbox ID
        const tamperAccess = await fetch(`${baseUrl}/api/erp/email/TAMPERED_ID_999/fetch`, {
          headers: { "Cookie": userRes.headers.get("set-cookie") || "" }
        });
        console.log(`   ${tamperAccess.status === 404 || tamperAccess.status === 403 ? "✅ REJECTED" : "❌ ALLOWED"} (${tamperAccess.status})`);
        results.push({ role: "USER", test: "TAMPER", status: (tamperAccess.status === 404 || tamperAccess.status === 403) ? "PASS" : "FAIL" });
      }
    } catch (err) {
      console.log("   ⚠️ Tampering test skipped");
    }

    // Summary
    console.log("\n📊 RBAC TEST RESULTS");
    console.log("=".repeat(70));
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;
    console.log(`✅ PASSED: ${passed}/${results.length}`);
    if (failed > 0) console.log(`❌ FAILED: ${failed}/${results.length}`);

    results.forEach(r => {
      console.log(`  ${r.role} / ${r.mailbox || r.test}: ${r.status}`);
    });

  } catch (err) {
    console.error("❌ ERROR:", err instanceof Error ? err.message : "Unknown");
    console.log("\nNote: RBAC tests require DEV environment with dev-session endpoint enabled.");
  }
}

testRbacSessions().catch(console.error);
