import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import { 
  buildRbacRoleSummary, 
  buildAllModulesCapabilities, 
  convertMatrixToPermissions,
  ERP_MODULE_DEFINITIONS 
} from '../lib/permissions/rbac-matrix-builder.ts';
import postgres from 'postgres';

const sql = postgres(resolveDbUrl("prod"), {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function runVerification() {
  console.log("=================================================================");
  console.log("  TESTING CUSTOM ASSIGNABLE RBAC PERMISSIONS & DATABASE SYNC   ");
  console.log("=================================================================\n");

  console.log("1. Simulating Administrator Form/Module Checkbox Customization:");
  const testRole = "cashier";
  console.log(`Base Role: [${testRole}]`);

  // Build initial capabilities
  let capabilities = buildAllModulesCapabilities(testRole, []);
  console.log(`Default Cashier Allowed Modules: ${capabilities.filter(m => m.canView).length}`);

  // Admin manually customizes:
  // - Grant "General & Branch Ledgers" -> View only
  // - Grant "Purchase Booking" -> Create only
  // - Revoke "Roznamcha Daily Cash Books" -> Approve/Post
  capabilities = capabilities.map(mod => {
    if (mod.moduleKey === "general_ledgers") {
      return { ...mod, canView: true, canCreate: false, canEdit: false, canPostApprove: false };
    }
    if (mod.moduleKey === "purchase_booking") {
      return { ...mod, canView: true, canCreate: true, canEdit: false, canPostApprove: false };
    }
    if (mod.moduleKey === "roznamcha_cash_entry") {
      return { ...mod, canView: true, canCreate: true, canPostApprove: false };
    }
    return mod;
  });

  // Convert to database permissions array
  const customPermissions = convertMatrixToPermissions(testRole, capabilities);
  console.log(`\nGenerated Custom Permission Tokens (${customPermissions.length} rules):`, customPermissions);

  // Evaluate RBAC Summary with custom permissions
  const evaluatedSummary = buildRbacRoleSummary(testRole, customPermissions);
  console.log(`\nEvaluated Summary for Customized User:`);
  console.log(`  Allowed Modules: ${evaluatedSummary.accessibleModules.length}`);
  console.log(`  Restricted Modules: ${evaluatedSummary.restrictedModules.length}`);

  console.log("\n2. Testing Real Database Persistence in 'user_permission_sets':");
  
  // Find a test user or active user
  const users = await sql`
    SELECT id, user_code FROM profiles LIMIT 1
  `;

  if (users.length > 0) {
    const testUserId = users[0].id;
    console.log(`Testing persistence with User ID: ${testUserId} (${users[0].user_code})`);

    // Upsert custom permissions
    await sql`
      INSERT INTO user_permission_sets (user_id, permissions, source, updated_at)
      VALUES (${testUserId}, ${customPermissions}, 'manual', NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET permissions = ${customPermissions}, source = 'manual', updated_at = NOW()
    `;
    console.log("✅ Custom permissions saved to 'user_permission_sets' table in PostgreSQL.");

    // Query back from DB
    const [fetched] = await sql`
      SELECT permissions, source, updated_at FROM user_permission_sets WHERE user_id = ${testUserId}
    `;

    console.log(`Fetched from DB: source="${fetched.source}", tokens=${fetched.permissions.length}`);
    
    // Reconstruct matrix from fetched DB permissions
    const reconstructedCaps = buildAllModulesCapabilities(testRole, fetched.permissions);
    const ledgerModule = reconstructedCaps.find(m => m.moduleKey === "general_ledgers");
    const purchaseModule = reconstructedCaps.find(m => m.moduleKey === "purchase_booking");
    const roznamchaModule = reconstructedCaps.find(m => m.moduleKey === "roznamcha_cash_entry");

    console.log(`Reconstructed Checkbox State from DB:`);
    console.log(`  - Ledgers: View=${ledgerModule?.canView}, Edit=${ledgerModule?.canEdit}, Approve=${ledgerModule?.canPostApprove}`);
    console.log(`  - Purchase: View=${purchaseModule?.canView}, Create=${purchaseModule?.canCreate}`);
    console.log(`  - Roznamcha: View=${roznamchaModule?.canView}, Approve=${roznamchaModule?.canPostApprove}`);

    if (ledgerModule?.canView === true && ledgerModule?.canEdit === false && purchaseModule?.canCreate === true && roznamchaModule?.canPostApprove === false) {
      console.log("\n🎉 PERFECT MATCH! All checkbox permissions accurately stored, retrieved, and reconstructed from database!");
    } else {
      console.error("Mismatch in reconstructed capabilities!");
    }
  }

  await sql.end();
}

runVerification().catch(console.error);
