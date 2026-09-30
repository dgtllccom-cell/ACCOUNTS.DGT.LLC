async function testTarget(baseUrl, label, identifier, pass) {
  console.log(`\n=================== Testing ${label} (${baseUrl}) ===================`);
  try {
    const loginRes = await fetch(`${baseUrl}/api/erp/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password: pass })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.success) {
      console.error(`Login failed on ${label}:`, loginData);
      return;
    }
    const cookieHeader = loginRes.headers.get("set-cookie");
    console.log(`✓ Superadmin login successful on ${label}`);

    const loadingRes = await fetch(`${baseUrl}/api/erp/purchases/loading-records?limit=150`, {
      headers: { "Cookie": cookieHeader || "" }
    });
    const loadingData = await loadingRes.json();
    if (!loadingRes.ok || !loadingData.ok) {
      console.error(`Loading records API failed on ${label}:`, loadingData);
      return;
    }

    const records = loadingData.data?.records || [];
    console.log(`Total loading records returned on ${label}: ${records.length}`);
    const poNumbers = records.map(r => r.purchase_order_no).filter(Boolean);
    console.log(`Purchase Order Numbers in loading queue:`, poNumbers);

    const ae003 = records.find(r => r.purchase_order_no === "AE-001-0003");
    if (ae003) {
      console.log(`✅ FOUND AE-001-0003 in Loading queue! ID: ${ae003.id}, Status: ${ae003.loading_status}, Remarks: ${ae003.remarks}`);
    } else {
      console.log(`❌ AE-001-0003 NOT found in Loading queue on ${label}!`);
    }

    // Also check UAE admin login
    const uaeLoginRes = await fetch(`${baseUrl}/api/erp/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "uae.admin@dgt.llc", password: pass })
    });
    if (uaeLoginRes.ok) {
      const uaeCookie = uaeLoginRes.headers.get("set-cookie");
      const uaeLoadingRes = await fetch(`${baseUrl}/api/erp/purchases/loading-records?limit=150`, {
        headers: { "Cookie": uaeCookie || "" }
      });
      const uaeLoadingData = await uaeLoadingRes.json();
      const uaeRecords = uaeLoadingData.data?.records || [];
      console.log(`Total loading records for UAE Admin on ${label}: ${uaeRecords.length}`);
      const uaeAe003 = uaeRecords.find(r => r.purchase_order_no === "AE-001-0003");
      if (uaeAe003) {
        console.log(`✅ UAE Admin can see AE-001-0003 in Loading queue!`);
      } else {
        console.log(`❌ UAE Admin cannot see AE-001-0003 in Loading queue!`);
      }
    }
  } catch (err) {
    console.error(`Error on ${label}:`, err.message);
  }
}

async function main() {
  await testTarget("http://127.0.0.1:3000", "PROD VPS (dgt-nextjs, port 3000)", "all.superadmin@dgt.llc", "Chaman@9090");
  await testTarget("http://127.0.0.1:3100", "DEV VPS (dgt-dev, port 3100)", "superadmin@dgt.llc", "chaman@9090");
}

main();
