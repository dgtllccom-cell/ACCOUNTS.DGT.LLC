
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let supabaseUrl = "";
let supabaseKey = "";

for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.replace("NEXT_PUBLIC_SUPABASE_URL=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
  if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    supabaseKey = trimmed.replace("SUPABASE_SERVICE_ROLE_KEY=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function clean() {
  await supabase.auth.admin.deleteUser("c0402d72-8ff4-44a9-960a-9300b0ac3994");
  const { data } = await supabase.auth.admin.listUsers();
  console.log("FINAL AUTH USERS (" + data.users.length + "):");
  data.users.forEach(u => console.log(" -", u.email, "(" + u.id + ")"));
}
clean();
