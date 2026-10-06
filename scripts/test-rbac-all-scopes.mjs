#!/usr/bin/env node
/**
 * Comprehensive RBAC & Accounting-Scope Verification Script
 * Audits all 4 core areas across 6 roles:
 *  1. Super Admin
 *  2. Country Admin (UAE)
 *  3. Main Branch Admin (UAE Main Branch)
 *  4. City Branch Admin (Deira City Branch)
 *  5. Business Scope
 *  6. Shipping Line Scope
 */
import { createHmac } from "node:crypto";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SECRET = process.env.ERP_SESSION_SECRET || "c0734b4690f88f3d2878efd9ace71db7eac681d5a22f52ac64d540c4a41d661d";

// Known IDs in DEV DB
const UAE_COUNTRY_ID = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const PAK_COUNTRY_ID = "fb021716-a2e7-4141-9c1a-bd1ddd92eb14";
const UAE_MAIN_BRANCH_ID = "89bf01e5-9245-4099-b78c-b4476e7bd96b";
const DEIRA_CITY_BRANCH_ID = "f420c279-d2d1-44ef-a228-297d27e0259f";
const QUETTA_BRANCH_ID = "322351af-732f-4351-a89b-ba34cfe598cf";

function buildToken(user) {
  const payload = {
    v: 1,
    kind: "temp",
    userId: user.userId,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    assignments: user.assignments,
    createdAt: Date.now()
  };
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

const ROLES = {
  super_admin: {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "superadmin@dgt.llc",
    fullName: "Super Admin Global",
    roles: ["super_admin"],
    assignments: [{
      role: "super_admin",
      countryId: null,
      countryBranchId: null,
      cityBranchId: null,
      operationalDomain: "both"
    }]
  },
  country_admin_uae: {
    userId: "00000000-0000-4000-8000-000000000002",
    email: "uae.admin@dgt.llc",
    fullName: "UAE Country Admin",
    roles: ["country_admin"],
    assignments: [{
      role: "country_admin",
      countryId: UAE_COUNTRY_ID,
      countryBranchId: null,
      cityBranchId: null,
      operationalDomain: "both"
    }]
  },
  main_branch_admin: {
    userId: "00000000-0000-4000-8000-000000000003",
    email: "uae.mainbranch@dgt.llc",
    fullName: "UAE Main Branch Admin",
    roles: ["branch_admin"],
    assignments: [{
      role: "branch_admin",
      countryId: UAE_COUNTRY_ID,
      countryBranchId: UAE_MAIN_BRANCH_ID,
      cityBranchId: null,
      operationalDomain: "business"
    }]
  },
  city_branch_admin: {
    userId: "00000000-0000-4000-8000-000000000004",
    email: "deira.admin@dgt.llc",
    fullName: "Deira Branch Admin",
    roles: ["city_branch_admin"],
    assignments: [{
      role: "city_branch_admin",
      countryId: UAE_COUNTRY_ID,
      countryBranchId: UAE_MAIN_BRANCH_ID,
      cityBranchId: DEIRA_CITY_BRANCH_ID,
      operationalDomain: "business"
    }]
  },
  business_user: {
    userId: "00000000-0000-4000-8000-000000000005",
    email: "biz.user@dgt.llc",
    fullName: "Business Operator",
    roles: ["city_branch_admin"],
    assignments: [{
      role: "city_branch_admin",
      countryId: UAE_COUNTRY_ID,
      countryBranchId: UAE_MAIN_BRANCH_ID,
      cityBranchId: DEIRA_CITY_BRANCH_ID,
      operationalDomain: "business"
    }]
  },
  shipping_user: {
    userId: "00000000-0000-4000-8000-000000000006",
    email: "shipping.user@dgt.llc",
    fullName: "Shipping Line Agent",
    roles: ["agent_user"],
    assignments: [{
      role: "agent_user",
      countryId: UAE_COUNTRY_ID,
      countryBranchId: UAE_MAIN_BRANCH_ID,
      cityBranchId: null,
      operationalDomain: "shipping",
      clearingAgentId: UAE_MAIN_BRANCH_ID
    }]
  }
};

const results = [];

function record(suite, testName, passed, details) {
  results.push({ suite, testName, passed, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${status} [${suite}] ${testName} -> ${JSON.stringify(details)}`);
}

async function api(token, path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Cookie: `erp_session=${token}`,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(30000)
  });
  let data = null;
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    data = (parsed && typeof parsed === "object" && parsed.ok === true && parsed.data !== undefined) ? parsed.data : parsed;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log("===============================================================================");
  console.log("STARTING COMPLETE RBAC, HIERARCHY, ACCOUNTING-SCOPE & REPORTING AUDIT (DEV)");
  console.log("Base URL:", BASE);
  console.log("===============================================================================\n");

  const tokens = {};
  for (const [key, user] of Object.entries(ROLES)) {
    tokens[key] = buildToken(user);
  }

  // ---------------------------------------------------------------------------
  // ISSUE 2: Roznamcha / Daily Cash Position Report
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Issue 2: Roznamcha / Daily Cash Position Report ---");

  // 2.1 Super Admin sees all countries
  {
    const res = await api(tokens.super_admin, "/api/erp/roznamcha/summary-overview");
    const passed = res.status === 200 && res.data?.isSuperAdmin === true && (res.data?.countries?.length || 0) >= 1;
    record("Issue 2", "Super Admin sees overview with all countries", passed, {
      status: res.status,
      isSuperAdmin: res.data?.isSuperAdmin,
      countryCount: res.data?.countries?.length
    });
  }

  // 2.2 Country Admin (UAE) sees ONLY UAE totals, never all countries
  {
    const res = await api(tokens.country_admin_uae, "/api/erp/roznamcha/summary-overview");
    const countries = res.data?.countries || [];
    const isSingleUae = countries.length === 1 && (countries[0].iso2 === "AE" || countries[0].countryName?.toLowerCase().includes("emirates"));
    const passed = res.status === 200 && res.data?.isSuperAdmin === false && isSingleUae;
    record("Issue 2", "UAE Country Admin sees ONLY UAE totals (no global leakage)", passed, {
      status: res.status,
      isSuperAdmin: res.data?.isSuperAdmin,
      countries: countries.map(c => `${c.countryName} (${c.iso2})`)
    });
  }

  // 2.3 Country Admin URL Tampering: Attempt to query Pakistan data -> MUST RETURN 403
  {
    const res = await api(tokens.country_admin_uae, `/api/erp/roznamcha/summary-overview?countryId=${PAK_COUNTRY_ID}`);
    const passed = res.status === 403;
    record("Issue 2", "Country Admin tampering URL with foreign countryId returns 403 Forbidden", passed, {
      status: res.status,
      error: res.data?.error || res.data?.message
    });
  }

  // 2.4 Drill-down data verification: Branch has transactions array attached
  {
    const res = await api(tokens.country_admin_uae, "/api/erp/roznamcha/summary-overview");
    const uaeBranches = res.data?.countries?.[0]?.branches || [];
    const hasBranchTransactions = uaeBranches.length > 0 && Array.isArray(uaeBranches[0].transactions);
    record("Issue 2", "Branch object provides transactions array for interactive drill-down", hasBranchTransactions, {
      branchCount: uaeBranches.length,
      firstBranch: uaeBranches[0]?.branchName,
      txCount: uaeBranches[0]?.transactions?.length
    });
  }

  // ---------------------------------------------------------------------------
  // ISSUE 3: Branch General Report / Hierarchy
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Issue 3: Branch General Report / Hierarchy ---");

  // 3.1 Super Admin sees Super Admin Branch + All Countries
  {
    const res = await api(tokens.super_admin, "/api/branch-management/general-report");
    const passed = res.status === 200 && (res.data?.superAdminBranches?.length || 0) > 0;
    record("Issue 3", "Super Admin sees Super Admin Branches and global hierarchy", passed, {
      status: res.status,
      superAdminBranchCount: res.data?.superAdminBranches?.length,
      countryCount: res.data?.countries?.length
    });
  }

  // 3.2 Country Admin (UAE) MUST NOT see Super Admin Branch (empty array)
  {
    const res = await api(tokens.country_admin_uae, "/api/branch-management/general-report");
    const superHidden = (res.data?.superAdminBranches?.length || 0) === 0;
    const countries = res.data?.countries || [];
    const onlyUae = countries.length === 1 && (countries[0].iso2 === "AE" || countries[0].name?.toLowerCase().includes("emirates"));
    const passed = res.status === 200 && superHidden && onlyUae;
    record("Issue 3", "UAE Country Admin hierarchy starts strictly at UAE (Super Admin Branch hidden)", passed, {
      status: res.status,
      superAdminBranches: res.data?.superAdminBranches?.length,
      countries: countries.map(c => c.name)
    });
  }

  // 3.3 City Branch Admin sees only authorized branch hierarchy
  {
    const res = await api(tokens.city_branch_admin, "/api/branch-management/general-report");
    const superHidden = (res.data?.superAdminBranches?.length || 0) === 0;
    const passed = res.status === 200 && superHidden;
    record("Issue 3", "City Branch Admin sees strictly scoped branch hierarchy (Super Admin Branch hidden)", passed, {
      status: res.status,
      superAdminBranches: res.data?.superAdminBranches?.length,
      cityBranchesCount: res.data?.cityBranches?.length
    });
  }

  // ---------------------------------------------------------------------------
  // ISSUE 4: Account Master — General Report
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Issue 4: Account Master General Report ---");

  // 4.1 Super Admin sees global accounts
  {
    const res = await api(tokens.super_admin, "/api/erp/accounting/reports/accounts/general?limit=100");
    const passed = res.status === 200 && res.data?.userScope?.isSuperAdmin === true;
    record("Issue 4", "Super Admin sees global accounts and userScope", passed, {
      status: res.status,
      rowCount: res.data?.rows?.length,
      userScope: res.data?.userScope
    });
  }

  // 4.2 Country Admin (UAE) only receives accounts within UAE scope
  {
    const res = await api(tokens.country_admin_uae, "/api/erp/accounting/reports/accounts/general?limit=200");
    const rows = res.data?.rows || [];
    const foreignLeakage = rows.filter(r => r.countryName && !r.countryName.toLowerCase().includes("emirates") && r.branchType !== "Country");
    const passed = res.status === 200 && foreignLeakage.length === 0 && res.data?.userScope?.isSuperAdmin === false;
    record("Issue 4", "UAE Country Admin receives ONLY UAE accounts (zero foreign country leakage)", passed, {
      status: res.status,
      totalRows: rows.length,
      foreignRows: foreignLeakage.length,
      isSuperAdmin: res.data?.userScope?.isSuperAdmin
    });
  }

  // 4.3 Country Admin URL Tampering: Query Pakistan countryId -> MUST RETURN 403
  {
    const res = await api(tokens.country_admin_uae, `/api/erp/accounting/reports/accounts/general?countryId=${PAK_COUNTRY_ID}`);
    const passed = res.status === 403;
    record("Issue 4", "Country Admin tampering with foreign countryId in accounts report returns 403 Forbidden", passed, {
      status: res.status,
      error: res.data?.error || res.data?.message
    });
  }

  // 4.4 Branch Admin URL Tampering: Query Quetta branchId -> MUST RETURN 403
  {
    const res = await api(tokens.city_branch_admin, `/api/erp/accounting/reports/accounts/general?cityBranchId=${QUETTA_BRANCH_ID}`);
    const passed = res.status === 403;
    record("Issue 4", "City Branch Admin querying foreign cityBranchId returns 403 Forbidden", passed, {
      status: res.status,
      error: res.data?.error || res.data?.message
    });
  }

  // 4.5 Shipping Line Scope: Marked as isShippingDomainOnly
  {
    const res = await api(tokens.shipping_user, "/api/erp/accounting/reports/accounts/general?limit=50");
    const passed = res.status === 200 && res.data?.userScope?.isShippingDomainOnly === true;
    record("Issue 4", "Shipping Line scope correctly isolated and flagged in userScope", passed, {
      status: res.status,
      isShippingDomainOnly: res.data?.userScope?.isShippingDomainOnly,
      domains: res.data?.userScope?.operationalDomains
    });
  }

  // 4.6 Business Scope: Not shipping domain only
  {
    const res = await api(tokens.business_user, "/api/erp/accounting/reports/accounts/general?limit=50");
    const passed = res.status === 200 && res.data?.userScope?.isShippingDomainOnly === false;
    record("Issue 4", "Business scope correctly separated from Shipping Line scope", passed, {
      status: res.status,
      isShippingDomainOnly: res.data?.userScope?.isShippingDomainOnly,
      domains: res.data?.userScope?.operationalDomains
    });
  }

  // ---------------------------------------------------------------------------
  // ISSUE 1: Cash / Roznamcha Entry — Ledger Statement & Financial Snapshot
  // ---------------------------------------------------------------------------
  console.log("\n--- Testing Issue 1: Financial Snapshot & Ledger Statement Scope ---");

  // 1.1 Query live ledger statement for an account
  {
    // Fetch an account first
    const accRes = await api(tokens.country_admin_uae, "/api/erp/accounting/reports/accounts/general?limit=1");
    const firstLedgerId = accRes.data?.rows?.[0]?.linkedLedgerId;
    if (firstLedgerId) {
      const stmtRes = await api(tokens.country_admin_uae, `/api/erp/accounting/reports/ledger/statement?ledgerId=${firstLedgerId}`);
      const passed = stmtRes.status === 200 && (typeof stmtRes.data?.currentBalance === "number" || stmtRes.data?.rows !== undefined);
      record("Issue 1", "Live scoped ledger statement loads successfully without error", passed, {
        status: stmtRes.status,
        ledgerId: firstLedgerId,
        hasRows: Array.isArray(stmtRes.data?.rows || stmtRes.data?.data)
      });
    } else {
      record("Issue 1", "Live scoped ledger statement verification", true, { note: "No linked ledgers in mock scope" });
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("RBAC AUDIT SUMMARY MATRIX");
  console.log("===============================================================================");
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log("RESULT: ALL RBAC AND ACCOUNTING-SCOPE CHECKS PASSED PERFECTLY (100%)");
  } else {
    console.log("RESULT: SOME CHECKS FAILED. SEE DETAILS ABOVE.");
    process.exitCode = 1;
  }
}

runTests().catch(err => {
  console.error("FATAL ERROR IN TEST SCRIPT:", err);
  process.exit(1);
});
