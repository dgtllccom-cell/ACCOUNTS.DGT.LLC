import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

// Load .env.local natively
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_SECRET = process.env.ERP_SESSION_SECRET || "c0734b4690f88f3d2878efd9ace71db7eac681d5a22f52ac64d540c4a41d661d";
const BASE_URL = "http://localhost:3000";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

// Confirm database safety rule:
console.log("================================================================================");
console.log("DATABASE SAFETY CHECK:");
console.log("Connected Supabase URL:", SUPABASE_URL);
if (SUPABASE_URL.includes("inmayhrxucimxqhgseqi")) {
  console.error("FATAL: Connected to PRODUCTION DATABASE (inmayhrxucimxqhgseqi). ABORTING!");
  process.exit(1);
}
console.log("Target Database: DEV / Sandbox (csesvyxxjivnkkozgopt) - VERIFIED SAFE.");
console.log("================================================================================");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

function buildSessionToken({ role = "super_admin", countryId = null, branchId = null } = {}) {
  const payload = {
    v: 1,
    kind: "temp",
    userId: "00000000-0000-4000-8000-000000000001",
    email: `${role}@damaan.com`,
    fullName: `Test ${role}`,
    roles: [role],
    assignments: [
      {
        role,
        countryId,
        countryBranchId: branchId,
        cityBranchId: branchId,
        operationalDomain: "both",
        mobileProfile: "standard"
      }
    ],
    createdAt: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

async function run() {
  const results = [];
  const superToken = buildSessionToken({ role: "super_admin" });

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`[PASS] ${name} ${details ? "- " + details : ""}`);
      results.push({ name, status: "PASS", details });
    } else {
      console.error(`[FAIL] ${name} ${details ? "- " + details : ""}`);
      results.push({ name, status: "FAIL", details });
    }
  }

  try {
    // 1. Gather test entities from DEV DB
    console.log("\n--- Phase 1: Querying DEV Master Records ---");
    const { data: countries } = await supabase.from("countries").select("id, name").limit(10);
    const { data: branches } = await supabase.from("country_branches").select("id, code, name, country_id");
    const { data: companies } = await supabase.from("companies").select("id, name, company_code").limit(5);
    const { data: banks } = await supabase.from("banks").select("id, bank_name, branch_name, account_number").limit(5);
    const { data: warehouses } = await supabase.from("warehouses").select("id, warehouse_name, warehouse_code").limit(5);
    const { data: customers } = await supabase.from("customers").select("id, customer_name, person_code").limit(5);

    assert("DEV DB has countries", countries && countries.length > 0, `Count: ${countries?.length}`);
    assert("DEV DB has country branches", branches && branches.length > 0, `Count: ${branches?.length}`);
    assert("DEV DB has companies", companies && companies.length >= 3, `Count: ${companies?.length}`);
    assert("DEV DB has banks", banks && banks.length >= 3, `Count: ${banks?.length}`);
    assert("DEV DB has warehouses", warehouses && warehouses.length >= 2, `Count: ${warehouses?.length}`);
    assert("DEV DB has customers", customers && customers.length > 0, `Count: ${customers?.length}`);

    const targetCountry = countries[0];
    const targetBranch = branches.find(b => b.country_id === targetCountry.id);
    if (!targetBranch) {
      throw new Error(`No branch found for country ${targetCountry.name}`);
    }
    const comp1 = companies[0];
    const comp2 = companies[1];
    const comp3 = companies[2];
    const bank1 = banks[0];
    const bank2 = banks[1];
    const bank3 = banks[2];
    const wh1 = warehouses[0];
    const wh2 = warehouses[1];
    const { data: testCust, error: custErr } = await supabase.from("customers").insert({
      country_id: targetCountry.id,
      customer_name: `E2E Customer ${Date.now().toString().slice(-4)}`,
      person_code: `CUST-E2E-${Date.now().toString().slice(-5)}`,
      mobile: "+93700112233",
      whatsapp: "+93700112233",
      is_active: true
    }).select().single();
    if (custErr || !testCust) {
      throw new Error(`Failed to create test customer: ${custErr?.message}`);
    }

    console.log(`Target Country: ${targetCountry.name} (${targetCountry.id})`);
    console.log(`Target Branch: ${targetBranch.name} (${targetBranch.id})`);
    console.log(`Test Customer: ${testCust.customer_name} (${testCust.id})`);
    console.log(`Companies: [${comp1.name}, ${comp2.name}, ${comp3.name}]`);
    console.log(`Banks: [${bank1.bank_name}, ${bank2.bank_name}, ${bank3.bank_name}]`);
    console.log(`Warehouses: [${wh1.warehouse_name}, ${wh2.warehouse_name}]`);

    // 2. Count existing accounts and ledgers before test
    const { count: initialAccountsCount } = await supabase.from("enterprise_accounts").select("*", { count: "exact", head: true });
    const { count: initialLedgersCount } = await supabase.from("ledgers").select("*", { count: "exact", head: true });

    // 3. Phase 2: Create Account with 3 Companies, 3 Banks, 2 Warehouses
    console.log("\n--- Phase 2: Creating Account via Canonical API ---");
    const testCode = `ACC-E2E-${Date.now().toString().slice(-6)}`;
    const createPayload = {
      scope: "main_branch",
      code: testCode,
      countryId: targetCountry.id,
      countryBranchId: targetBranch.id,
      name: `TEST-MULTI-LINK-ACCOUNT-${Date.now().toString().slice(-4)}`,
      kind: "asset",
      currency: "AED",
      openingBalance: 15000,
      customerId: testCust.id,
      companyId: comp2.id, // Comp2 is Primary
      companyIds: [comp1.id, comp2.id, comp3.id],
      linkedCompanies: [
        { id: comp1.id, name: comp1.name, isPrimary: false },
        { id: comp2.id, name: comp2.name, isPrimary: true },
        { id: comp3.id, name: comp3.name, isPrimary: false }
      ],
      bankId: bank1.id, // Bank1 is Primary
      bankIds: [bank1.id, bank2.id, bank3.id],
      linkedBanks: [
        { id: bank1.id, name: bank1.bank_name, isPrimary: true, accountNumber: bank1.account_number || "AE120260000011112222333" },
        { id: bank2.id, name: bank2.bank_name, isPrimary: false, accountNumber: bank2.account_number || "AE990260000044445555666" },
        { id: bank3.id, name: bank3.bank_name, isPrimary: false, accountNumber: bank3.account_number || "AE880260000077778888999" }
      ],
      warehouseId: wh1.id,
      warehouseIds: [wh1.id, wh2.id],
      operationalDomain: "business",
      status: "active"
    };

    const createRes = await fetch(`${BASE_URL}/api/erp/accounting/accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `erp_session=${superToken}`
      },
      body: JSON.stringify(createPayload)
    });

    const createJson = await createRes.json();
    if (createRes.status !== 201 && createRes.status !== 200) {
      console.error("CREATE ERROR RESPONSE:", JSON.stringify(createJson, null, 2));
    }
    assert("Account creation API responded 201/200", createRes.status === 201 || createRes.status === 200, `Status: ${createRes.status}`);
    const resData = createJson.data || createJson.account || createJson;
    const testAccountId = resData?.accountId || resData?.id;
    const testAccountCode = resData?.accountCode || resData?.code || resData?.accountNumber || resData?.account_number;
    assert("Created account ID returned", !!testAccountId, `ID: ${testAccountId}`);
    console.log(`Created Account: ID=${testAccountId}, Code=${testAccountCode}`);

    // 4. Phase 3: Verify Database Integrity (Single Account & Single Ledger)
    console.log("\n--- Phase 3: Verifying Database Integrity ---");
    const { count: postCreateAccountsCount } = await supabase.from("enterprise_accounts").select("*", { count: "exact", head: true });
    const { count: postCreateLedgersCount } = await supabase.from("ledgers").select("*", { count: "exact", head: true });

    assert("Exactly 1 new Account created in DB", postCreateAccountsCount === initialAccountsCount + 1, `Old: ${initialAccountsCount}, New: ${postCreateAccountsCount}`);
    assert("Exactly 1 new Ledger created in DB", postCreateLedgersCount === initialLedgersCount + 1, `Old: ${initialLedgersCount}, New: ${postCreateLedgersCount}`);

    // Inspect the exact database row
    const { data: dbAccount } = await supabase
      .from("enterprise_accounts")
      .select("id, code, name, company_id, bank_id, customer_id, linked_companies, linked_banks")
      .eq("id", testAccountId)
      .single();

    assert("DB row primary company_id matches Comp 2", dbAccount.company_id === comp2.id);
    assert("DB row primary bank_id matches Bank 1", dbAccount.bank_id === bank1.id);
    const parsedLinkedComps = Array.isArray(dbAccount.linked_companies) ? dbAccount.linked_companies : (typeof dbAccount.linked_companies === 'string' ? JSON.parse(dbAccount.linked_companies) : []);
    const parsedLinkedBanks = Array.isArray(dbAccount.linked_banks) ? dbAccount.linked_banks : (typeof dbAccount.linked_banks === 'string' ? JSON.parse(dbAccount.linked_banks) : []);
    assert("DB row linked_companies JSONB has 3 elements", parsedLinkedComps.length === 3, `Length: ${parsedLinkedComps.length}`);
    assert("DB row linked_banks JSONB has 3 elements", parsedLinkedBanks.length === 3, `Length: ${parsedLinkedBanks.length}`);

    // Inspect warehouses junction table
    const { data: dbWhJunction } = await supabase
      .from("enterprise_account_warehouses")
      .select("warehouse_id, is_primary")
      .eq("account_id", testAccountId);

    assert("DB enterprise_account_warehouses has 2 rows", dbWhJunction && dbWhJunction.length === 2, `Count: ${dbWhJunction?.length}`);

    // 5. Phase 4: Fetch via Canonical GET API (Simulating Refresh & Reopen)
    console.log("\n--- Phase 4: Simulating Refresh & Reopen via GET API ---");
    const getRes = await fetch(`${BASE_URL}/api/erp/accounting/accounts/${testAccountId}?language=en`, {
      headers: { Cookie: `erp_session=${superToken}` }
    });
    assert("GET account by ID returned 200", getRes.status === 200, `Status: ${getRes.status}`);
    const getJson = await getRes.json();
    const fetchedAccount = getJson.data?.account || getJson.account;
    const fetchedLedger = getJson.data?.ledger || getJson.ledger;

    assert("GET resolved 3 companies", fetchedAccount?.companies?.length === 3, `Count: ${fetchedAccount?.companies?.length}`);
    const fetchedPrimaryComp = fetchedAccount?.companies?.find(c => c.isPrimary);
    assert("GET correctly identifies primary company (Comp 2)", fetchedPrimaryComp?.id === comp2.id, `Name: ${fetchedPrimaryComp?.name}`);

    assert("GET resolved 3 banks", fetchedAccount?.banks?.length === 3, `Count: ${fetchedAccount?.banks?.length}`);
    const fetchedPrimaryBank = fetchedAccount?.banks?.find(b => b.isPrimary);
    assert("GET correctly identifies primary bank (Bank 1)", fetchedPrimaryBank?.id === bank1.id, `Name: ${fetchedPrimaryBank?.name}`);

    assert("GET resolved warehouses", fetchedAccount?.warehouses?.length === 2, `Count: ${fetchedAccount?.warehouses?.length}`);
    assert("GET resolved customer", fetchedAccount?.customer?.id === testCust.id, `Customer: ${fetchedAccount?.customer?.customer_name}`);
    assert("GET returned attached canonical ledger", !!fetchedLedger?.id, `Ledger: ${fetchedLedger?.name} (${fetchedLedger?.code})`);

    // 6. Phase 5: Test Edit & Removal (Switch Primary, Remove Non-Primary)
    console.log("\n--- Phase 5: Updating Relationships (Switch Primary, Remove Non-Primary) ---");
    // Switch primary company to Comp 3, remove Comp 1
    // Switch primary bank to Bank 2, remove Bank 3
    const updatePayload = {
      name: fetchedAccount.name,
      companyId: comp3.id,
      companyIds: [comp2.id, comp3.id],
      linkedCompanies: [
        { id: comp2.id, name: comp2.name, isPrimary: false },
        { id: comp3.id, name: comp3.name, isPrimary: true }
      ],
      bankId: bank2.id,
      bankIds: [bank1.id, bank2.id],
      linkedBanks: [
        { id: bank1.id, name: bank1.bank_name, isPrimary: false, accountNumber: bank1.account_number || "AE120260000011112222333" },
        { id: bank2.id, name: bank2.bank_name, isPrimary: true, accountNumber: bank2.account_number || "AE990260000044445555666" }
      ],
      warehouseIds: [wh1.id]
    };

    const updateRes = await fetch(`${BASE_URL}/api/erp/accounting/accounts/${testAccountId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `erp_session=${superToken}`
      },
      body: JSON.stringify(updatePayload)
    });

    assert("PATCH account returned 200", updateRes.status === 200, `Status: ${updateRes.status}`);

    // Re-verify database state after update
    const { count: postUpdateAccountsCount } = await supabase.from("enterprise_accounts").select("*", { count: "exact", head: true });
    const { count: postUpdateLedgersCount } = await supabase.from("ledgers").select("*", { count: "exact", head: true });

    assert("Account count unchanged after update (NO duplicate account)", postUpdateAccountsCount === postCreateAccountsCount);
    assert("Ledger count unchanged after update (NO duplicate ledger)", postUpdateLedgersCount === postCreateLedgersCount);

    const { data: updatedDbAccount } = await supabase
      .from("enterprise_accounts")
      .select("id, code, company_id, bank_id, linked_companies, linked_banks")
      .eq("id", testAccountId)
      .single();

    assert("Updated DB primary company_id is now Comp 3", updatedDbAccount.company_id === comp3.id);
    assert("Updated DB primary bank_id is now Bank 2", updatedDbAccount.bank_id === bank2.id);
    assert("Updated DB linked_companies now has 2 elements", updatedDbAccount.linked_companies?.length === 2);
    assert("Updated DB linked_banks now has 2 elements", updatedDbAccount.linked_banks?.length === 2);
    assert("Account Code remained original", updatedDbAccount.code === testAccountCode);

    // 7. Phase 6: Duplicate Protection Verification
    console.log("\n--- Phase 6: Duplicate Prevention Verification ---");
    // Attempt to add Comp 2 twice in payload
    const duplicatePayload = {
      linkedCompanies: [
        { id: comp2.id, name: comp2.name, isPrimary: true },
        { id: comp2.id, name: comp2.name, isPrimary: false }
      ],
      companyIds: [comp2.id, comp2.id],
      companyId: comp2.id
    };

    const dupRes = await fetch(`${BASE_URL}/api/erp/accounting/accounts/${testAccountId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `erp_session=${superToken}`
      },
      body: JSON.stringify(duplicatePayload)
    });
    assert("Duplicate submission safely processed or deduplicated without crashing", dupRes.status === 200 || dupRes.status === 400);

    // Verify deduplication: DB row should now have exactly 1 element
    const { data: dedupedDbAccount } = await supabase
      .from("enterprise_accounts")
      .select("linked_companies")
      .eq("id", testAccountId)
      .single();
    const dedupedList = Array.isArray(dedupedDbAccount.linked_companies) ? dedupedDbAccount.linked_companies : JSON.parse(dedupedDbAccount.linked_companies || "[]");
    assert("Duplicate company submission safely deduplicated in DB", dedupedList.length === 1);

    // Re-apply updatePayload with 2 distinct companies so Phase 8 multilingual test has 2 companies
    await fetch(`${BASE_URL}/api/erp/accounting/accounts/${testAccountId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `erp_session=${superToken}`
      },
      body: JSON.stringify(updatePayload)
    });

    // 8. Phase 7: Role Permissions & Branch Scoping
    console.log("\n--- Phase 7: Permissions & Branch Scoping ---");
    // Create Branch User token belonging to a different branch/country
    const otherBranch = branches.find(b => b.id !== targetBranch.id);
    if (otherBranch) {
      const branchUserToken = buildSessionToken({
        role: "branch_user",
        countryId: otherBranch.country_id,
        branchId: otherBranch.id
      });

      // Try fetching accounts scoped by the other branch
      const branchListRes = await fetch(`${BASE_URL}/api/erp/accounting/accounts?countryBranchId=${otherBranch.id}`, {
        headers: { Cookie: `erp_session=${branchUserToken}` }
      });
      const branchListJson = await branchListRes.json();
      const accountsList = branchListJson.data?.accounts || branchListJson.accounts || [];
      const leakedAccount = accountsList.find(a => a.id === testAccountId);
      assert("Branch isolation: Account from targetBranch NOT leaked to otherBranch user", !leakedAccount);
    }

    // 9. Phase 8: Multilingual API Contract Verification (5 Languages)
    console.log("\n--- Phase 8: 5-Language API Parity Verification ---");
    const langs = ["en", "ur", "ar", "fa", "ps"];
    for (const l of langs) {
      const langRes = await fetch(`${BASE_URL}/api/erp/accounting/accounts/${testAccountId}?language=${l}`, {
        headers: { Cookie: `erp_session=${superToken}` }
      });
      assert(`GET account in language '${l}' returns 200`, langRes.status === 200);
      const langJson = await langRes.json();
      const acct = langJson.data?.account || langJson.account;
      // Stored names and codes must NOT be distorted or corrupted
      assert(`Language '${l}' preserves exact account code`, acct?.code === testAccountCode);
      assert(`Language '${l}' preserves exact company list length`, acct?.companies?.length === 2);
      assert(`Language '${l}' preserves exact bank list length`, acct?.banks?.length === 2);
    }

    // 10. Phase 9: Cleanup Test Data from DEV DB
    console.log("\n--- Phase 9: Cleaning up Test Account from DEV DB ---");
    await supabase.from("enterprise_account_history").delete().eq("enterprise_account_id", testAccountId);
    await supabase.from("enterprise_account_warehouses").delete().eq("account_id", testAccountId);
    await supabase.from("approval_requests").delete().eq("target_id", testAccountId);
    if (fetchedLedger?.id) {
      await supabase.from("ledgers").delete().eq("id", fetchedLedger.id);
    }
    await supabase.from("ledgers").delete().eq("enterprise_account_id", testAccountId);
    await supabase.from("enterprise_accounts").delete().eq("id", testAccountId);
    if (testCust?.id) {
      await supabase.from("customers").delete().eq("id", testCust.id);
    }
    const { count: finalAccountsCount } = await supabase.from("enterprise_accounts").select("*", { count: "exact", head: true });
    const { count: finalLedgersCount } = await supabase.from("ledgers").select("*", { count: "exact", head: true });
    assert("Test account cleanly removed from DEV DB", finalAccountsCount === initialAccountsCount, `Initial: ${initialAccountsCount}, Final: ${finalAccountsCount}`);
    assert("Test ledger cleanly removed from DEV DB", finalLedgersCount === initialLedgersCount, `Initial: ${initialLedgersCount}, Final: ${finalLedgersCount}`);

    console.log("\n================================================================================");
    console.log("FINAL RESULTS SUMMARY:");
    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;
    console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("================================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

run();
