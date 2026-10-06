import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { enterpriseRolePermissions } from "../lib/permissions/enterprise-roles";

async function run() {
  const admin = createSupabaseAdminClient() as any;
  const { data: users, error } = await admin.from("user_role_assignments").select("user_id, role");
  if (error) {
    console.error(error);
    return;
  }
  
  for (const user of users) {
    if (user.role === "city_branch_admin" || user.role === "main_branch_admin" || user.role === "country_user" || user.role === "country_admin") {
      const { data: permRow } = await admin.from("user_permission_sets").select("permissions").eq("user_id", user.user_id).maybeSingle();
      if (permRow && permRow.permissions) {
        const perms = new Set(permRow.permissions);
        let updated = false;
        const required = ["accounts:create", "accounts:update", "ledgers:create", "ledgers:update", "roznamcha:create", "roznamcha:read", "purchases:create"];
        for (const req of required) {
          if (!perms.has(req)) {
            perms.add(req);
            updated = true;
          }
        }
        if (updated) {
          await admin.from("user_permission_sets").update({ permissions: Array.from(perms) }).eq("user_id", user.user_id);
          console.log(`Updated permissions for user ${user.user_id} (${user.role})`);
        }
      }
    }
  }
  console.log("Done");
}

run();
