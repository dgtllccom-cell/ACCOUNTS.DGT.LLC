import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, memberships(id, role_id, scope)");
  
  const { data: roles } = await supabase.from("erp_role_templates").select("*");
  const superAdminRole = roles?.find(r => r.code === "SUPER_ADMIN" || r.name === "Super Admin");

  console.log("Super Admin Role ID:", superAdminRole?.id);
  
  if (users) {
    for (const u of users) {
      const isSuperAdmin = u.memberships?.some((m: any) => m.role_id === superAdminRole?.id);
      if (isSuperAdmin) {
        console.log("Super Admin User:", u.full_name, u.email);
      }
    }
  }
}

check();
