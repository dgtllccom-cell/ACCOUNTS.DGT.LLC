import { GET } from "../app/api/erp/accounting/reports/accounts/general/route.ts";
import { NextRequest } from "next/server";
import * as sessionModule from "../lib/auth/session.ts";

// Mock requireErpSession
sessionModule.requireErpSession = async () => ({
  userId: "00000000-0000-0000-0000-000000000000",
  email: "superadmin@dgt.llc",
  roles: ["super_admin"],
  permissions: ["*"],
  isSuperAdmin: true,
  countryIds: [],
  countryBranchIds: [],
  cityBranchIds: [],
  defaultCompanyId: null
});

async function run() {
  try {
    const req = new NextRequest("http://localhost:3000/api/erp/accounting/reports/accounts/general?limit=500");
    const res = await GET(req);
    const json = await res.json();
    console.log("STATUS:", res.status);
    console.log("RESPONSE OK:", json.ok);
    if (!json.ok) console.log("ERROR:", json.error);
    else console.log("ROWS COUNT:", json.data?.rows?.length);
  } catch (err) {
    console.error("CAUGHT ERROR:", err);
  }
}

run();
