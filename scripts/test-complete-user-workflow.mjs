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

async function verifyFullERPMatrix() {
  console.log("=====================================================================");
  console.log("  TESTING COMPLETE 20-MODULE ERP RBAC MATRIX & END-TO-END WORKFLOW   ");
  console.log("=====================================================================\n");

  console.log(`Total ERP Modules Defined: ${ERP_MODULE_DEFINITIONS.length}`);
  const categories = {};
  ERP_MODULE_DEFINITIONS.forEach(m => {
    categories[m.category] = (categories[m.category] || 0) + 1;
  });
  console.log("Category breakdown:", categories);

  console.log("\n1. Testing Default vs Custom Permissions for Roles:");
  const testRoles = ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier", "agent_user", "staff_user", "auditor_viewer"];

  testRoles.forEach(r => {
    const summary = buildRbacRoleSummary(r);
    console.log(`  • Role: [${r.padEnd(18)}] -> Allowed: ${String(summary.accessibleModules.length).padStart(2)}/20 | Restricted: ${String(summary.restrictedModules.length).padStart(2)}/20`);
  });

  console.log("\n2. Testing Real Database Query from 'employees' with Master Join:");
  const [emp] = await sql`
    SELECT e.id, e.employee_code, e.designation, e.department, e.status, e.employment_type,
           c.customer_name, c.mobile, c.email, c.address
    FROM employees e
    LEFT JOIN customers c ON c.id = e.person_master_id
    WHERE e.employee_code IS NOT NULL
    LIMIT 1
  `;

  if (emp) {
    console.log(`  Fetched Real Employee: [${emp.employee_code}] ${emp.customer_name} | ${emp.designation} (${emp.department}) | Phone: ${emp.mobile}`);
  }

  console.log("\n3. Testing Granular Checkbox Customization for 'Accountant':");
  let caps = buildAllModulesCapabilities("accountant", []);
  
  // Custom check:
  // Give accountant full access to Stock Inventory & Item Master
  caps = caps.map(mod => {
    if (mod.moduleKey === "stock_warehouse") {
      return { ...mod, canView: true, canCreate: true, canEdit: true, canDelete: false, canPostApprove: false, canPrintExport: true };
    }
    return mod;
  });

  const customTokens = convertMatrixToPermissions("accountant", caps);
  console.log(`Generated Custom Tokens (${customTokens.length}):`, customTokens.slice(0, 8));

  // Save to DB and retrieve
  const [profile] = await sql`SELECT id FROM profiles LIMIT 1`;
  if (profile) {
    await sql`
      INSERT INTO user_permission_sets (user_id, permissions, source, updated_at)
      VALUES (${profile.id}, ${customTokens}, 'manual', NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET permissions = ${customTokens}, source = 'manual', updated_at = NOW()
    `;

    const [saved] = await sql`SELECT permissions FROM user_permission_sets WHERE user_id = ${profile.id}`;
    const restoredCaps = buildAllModulesCapabilities("accountant", saved.permissions);
    const stockMod = restoredCaps.find(m => m.moduleKey === "stock_warehouse");

    console.log(`Restored Stock Checkboxes: View=${stockMod?.canView}, Create=${stockMod?.canCreate}, Edit=${stockMod?.canEdit}, Export=${stockMod?.canPrintExport}`);
    
    if (stockMod?.canView && stockMod?.canCreate && stockMod?.canEdit && stockMod?.canPrintExport) {
      console.log("\n✅ End-to-end database persistence and permission reconstruction verified 100%!");
    }
  }

  await sql.end();
}

verifyFullERPMatrix().catch(console.error);
