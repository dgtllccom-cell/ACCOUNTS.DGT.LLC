import { createHmac } from "node:crypto";
import fs from "node:fs";

let SESSION_SECRET = "c0734b4690f88f3d2878efd9ace71db7eac681d5a22f52ac64d540c4a41d661d";
try {
  const envContent = fs.readFileSync(".env.local", "utf8");
  const match = envContent.match(/ERP_SESSION_SECRET=([^\r\n]+)/);
  if (match) SESSION_SECRET = match[1].trim();
} catch (e) {}

function buildSessionToken(role = "super_admin", countryId = null) {
  const payload = {
    v: 1, kind: "temp",
    userId: "00000000-0000-4000-8000-000000000001",
    email: "superadmin@damaan.com",
    fullName: "Super Admin",
    roles: [role],
    isSuperAdmin: role === "super_admin",
    countryIds: countryId ? [countryId] : [],
    assignments: [{ role, countryId, countryBranchId: null, cityBranchId: null, operationalDomain: "both", mobileProfile: "standard" }],
    createdAt: Date.now()
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

async function testHierarchy() {
  const superToken = buildSessionToken("super_admin");
  const headers = { 
    Cookie: `erp_session=${superToken}; erp_lang=en`,
    "Content-Type": "application/json"
  };

  console.log("=== 1. Testing GET /api/erp/location-master ===");
  const locRes = await fetch("http://localhost:3000/api/erp/location-master", { headers });
  const locData = await locRes.json();
  console.log(`Locations status: ${locRes.status}, count: ${locData.data?.locations?.length ?? locData.locations?.length ?? 0}`);
  const locations = locData.data?.locations || locData.locations || [];
  const jebelAli = locations.find(l => l.name?.toLowerCase().includes("jebel ali"));
  console.log(`Found Jebel Ali:`, jebelAli?.id, jebelAli?.name);

  console.log("\n=== 2. Testing GET /api/erp/location-terminals ===");
  const termRes = await fetch("http://localhost:3000/api/erp/location-terminals", { headers });
  const termData = await termRes.json();
  const terminals = termData.data?.terminals || termData.terminals || [];
  console.log(`Terminals status: ${termRes.status}, count: ${terminals.length}`);
  console.log("Sample terminals:", terminals.slice(0, 3).map(t => `${t.name} (${t.status})`));

  console.log("\n=== 3. Testing GET /api/erp/customs-treatments ===");
  const custRes = await fetch("http://localhost:3000/api/erp/customs-treatments", { headers });
  const custData = await custRes.json();
  const offices = custData.data?.offices || custData.offices || [];
  console.log(`Customs offices status: ${custRes.status}, count: ${offices.length}`);
  console.log("Sample customs offices:", offices.slice(0, 3).map(o => `${o.office_name} (${o.status})`));

  if (terminals.length > 0) {
    const existingTerm = terminals[0];
    console.log(`\n=== 4. Testing Duplicate Prevention for Gates/Terminals (${existingTerm.name}) ===`);
    const dupRes = await fetch("http://localhost:3000/api/erp/location-terminals", {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId: existingTerm.location_id,
        name: existingTerm.name,
        terminalType: "berth"
      })
    });
    console.log(`Duplicate insertion status (expected 409): ${dupRes.status}`);
    const dupJson = await dupRes.json();
    console.log(`Duplicate error message:`, dupJson.error?.message || dupJson.message);
  }

  if (terminals.length > 0) {
    const sampleTerm = terminals[0];
    console.log(`\n=== 5. Testing Active/Inactive Status Toggle for Gate: ${sampleTerm.name} ===`);
    const newStatus = sampleTerm.status === "active" ? "inactive" : "active";
    const toggleRes = await fetch(`http://localhost:3000/api/erp/location-terminals/${sampleTerm.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: newStatus })
    });
    console.log(`Toggle status: ${toggleRes.status}`);
    const toggleJson = await toggleRes.json();
    console.log(`Updated terminal status:`, (toggleJson.data?.terminal || toggleJson.terminal)?.status);

    // Revert back
    await fetch(`http://localhost:3000/api/erp/location-terminals/${sampleTerm.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: sampleTerm.status })
    });
    console.log(`Reverted terminal status back to: ${sampleTerm.status}`);
  }

  console.log("\n=== 6. Multilingual Header Verification (Urdu / Arabic) ===");
  const arHeaders = { Cookie: `erp_session=${superToken}; erp_lang=ar` };
  const arRes = await fetch("http://localhost:3000/api/erp/customs-treatments?lang=ar", { headers: arHeaders });
  console.log(`Customs offices Arabic GET status: ${arRes.status}`);
}

testHierarchy().catch(console.error);
