import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envLocal = fs.readFileSync(".env.local", "utf8");
const envVars = {};
for (const line of envLocal.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx > 0) {
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    envVars[k] = v;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectAuthUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing auth users:", error);
    return;
  }
  console.log(`Total Auth Users: ${users.length}`);
  console.table(users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at
  })));
}

inspectAuthUsers();
