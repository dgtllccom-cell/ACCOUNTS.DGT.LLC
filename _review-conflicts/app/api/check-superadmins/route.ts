import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: users } = await supabase.from("profiles").select("id, full_name, email, role");
  const { data: memberships } = await supabase.from("memberships").select("id, user_id, role_id, scope, roles(name, is_system)");
  const { data: roles } = await supabase.from("roles").select("*");
  const { data: erp_roles } = await supabase.from("erp_role_templates").select("*");

  return NextResponse.json({ users, memberships, roles, erp_roles });
}
