import { createHmac } from "node:crypto";

const SESSION_SECRET = "add6fbb7090f10fe8d428ae03e01d9c921bde0b288fa7ecf35db82e7de448bbc256b01632bac67fc39e3506bae06387f";
function buildSessionToken() {
  const payload = {
    v: 1, kind: "temp",
    userId: "be3a6b15-65c5-4d74-82ae-e956c02a5f07",
    email: "superadmin@dgt.llc",
    fullName: "Super Admin",
    roles: ["super_admin", "super_admin_reports"],
    isSuperAdmin: true,
    assignments: [{ role: "super_admin", countryId: null, countryBranchId: null, cityBranchId: null, operationalDomain: "both", mobileProfile: "standard" }],
    createdAt: Date.now()
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

async function run() {
  const token = buildSessionToken();
  const headers = { Cookie: `erp_session=${token}; erp_lang=en` };
  
  // 1. Get companies
  const listRes = await fetch("http://72.60.209.121/api/erp/companies?limit=5", { headers }).then(r => r.json());
  console.log("List status ok?", listRes.ok || !!listRes.companies);
  const firstCompany = (listRes.companies || listRes.data?.companies)?.[0];
  console.log("First company:", firstCompany?.id, firstCompany?.name);

  if (firstCompany) {
    // 2. Fetch company by ID
    const singleRes = await fetch(`http://72.60.209.121/api/erp/companies/${firstCompany.id}`, { headers });
    console.log("Single status:", singleRes.status);
    const json = await singleRes.json();
    console.log("Single res:", JSON.stringify(json, null, 2));
  }
}
run().catch(console.error);
