import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: accounts, error: err1 } = await supabase
    .from("enterprise_accounts")
    .select("id, name, scope, country_id, country_branch_id, city_branch_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("Latest accounts:", JSON.stringify(accounts, null, 2));
  if (err1) console.error("Accounts error:", err1);

  const { data: assignments, error: err2 } = await supabase
    .from("user_role_assignments")
    .select("user_id, role, country_id, is_active")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log("Recent assignments:", JSON.stringify(assignments, null, 2));
  if (err2) console.error("Assignments error:", err2);
  
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").limit(10);
  console.log("Profiles:", JSON.stringify(profiles, null, 2));
}

run();
