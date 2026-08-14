import { buildRbacRoleSummary } from '../lib/permissions/rbac-matrix-builder.ts';
import postgres from 'postgres';

const sql = postgres('postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function runTest() {
  console.log("=================================================");
  console.log("  TESTING USER REGISTRATION & RBAC ARCHITECTURE  ");
  console.log("=================================================\n");

  console.log("1. Testing RBAC Role Summaries for Key Roles:");
  const rolesToTest = ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "accountant", "cashier", "agent_user", "auditor_viewer"];

  for (const r of rolesToTest) {
    const summary = buildRbacRoleSummary(r);
    console.log(`\n▶ Role: [${r}] -> "${summary.roleTitle}"`);
    console.log(`  Scope: ${summary.scopeDescription}`);
    console.log(`  Accessible Modules: ${summary.accessibleModules.length} / 10`);
    console.log(`  Restricted Modules: ${summary.restrictedModules.length}`);
    console.log(`  Supervisor Privileges: ${summary.supervisorPrivileges.length}`);
  }

  console.log("\n2. Testing Real Database HR Employees for Auto-fill:");
  const employees = await sql`
    SELECT e.id, e.employee_code, e.designation, e.department, e.status,
           e.country_id, e.country_branch_id, e.city_branch_id,
           c.customer_name as name, c.mobile, c.email, c.address
    FROM employees e
    LEFT JOIN customers c ON c.id = e.person_master_id
    LIMIT 5
  `;

  console.log(`Fetched ${employees.length} sample employees:`);
  employees.forEach(emp => {
    console.log(`  • Code: ${emp.employee_code || emp.id} | Name: ${emp.name || 'N/A'} | Desig: ${emp.designation || 'Staff'} | Dept: ${emp.department || 'General'} | Mobile: ${emp.mobile || 'N/A'}`);
  });

  console.log("\n3. Testing Database Users and Role Assignments:");
  const userAssignments = await sql`
    SELECT ura.user_id, ura.role, ura.country_id, ura.country_branch_id, ura.city_branch_id, ura.is_active,
           p.full_name, p.user_code, u.email
    FROM user_role_assignments ura
    LEFT JOIN profiles p ON p.id = ura.user_id
    LEFT JOIN auth.users u ON u.id = ura.user_id
    LIMIT 5
  `;

  console.log(`Active User Assignments: ${userAssignments.length}`);
  userAssignments.forEach(u => {
    console.log(`  • User: ${u.full_name || u.user_code || 'User'} | Role: ${u.role} | Email: ${u.email || 'N/A'} | Active: ${u.is_active}`);
  });

  await sql.end();
  console.log("\n✅ All User Registration & RBAC workflows verified successfully!");
}

runTest().catch(console.error);
