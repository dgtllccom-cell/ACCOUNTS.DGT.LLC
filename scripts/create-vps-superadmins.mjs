import { execSync } from "child_process";
import fs from "fs";

const SERVER = "root@72.60.209.121";

const script = `
import postgres from "postgres";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let dbUrl = "";
let supabaseUrl = "";
let supabaseKey = "";

for (const line of envContent.split("\\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.replace("NEXT_PUBLIC_SUPABASE_URL=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
  if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    supabaseKey = trimmed.replace("SUPABASE_SERVICE_ROLE_KEY=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 15 });
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function createSuperAdmins() {
  console.log("=================================================================");
  console.log("       INITIALIZING SUPER ADMIN & COUNTRY ADMIN USERS ON VPS     ");
  console.log("=================================================================\\n");

  const usersToCreate = [
    { email: "superadmin@damaan.com", password: "Password123!", fullName: "Super Admin", code: "SUPERADMIN", role: "super_admin" },
    { email: "asmatdgtllc@users.damaan.local", password: "Password123!", fullName: "ASMATULLAH", code: "ASMATDGTLLC", role: "super_admin" },
    { email: "afg-country-admin@users.damaan.local", password: "Password123!", fullName: "Afghanistan Admin", code: "AFG-ADMIN", role: "country_admin" }
  ];

  for (const u of usersToCreate) {
    const { data: res, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.fullName, user_code: u.code, role: u.role }
    });

    if (error && !error.message.includes("already exists")) {
      console.log("  * User creation error (" + u.email + "):", error.message);
    } else {
      console.log("  + User established:", u.email);
    }
  }

  const { data: allUsers } = await supabase.auth.admin.listUsers();
  for (const u of allUsers?.users || []) {
    let ucode = "USR-" + u.id.slice(0, 6).toUpperCase();
    if (u.email === "superadmin@damaan.com") ucode = "SUPERADMIN";
    if (u.email === "asmatdgtllc@users.damaan.local") ucode = "ASMATDGTLLC";
    if (u.email === "afg-country-admin@users.damaan.local") ucode = "AFG-ADMIN";

    await sql\`
      INSERT INTO public.profiles (id, full_name, user_code)
      VALUES (\${u.id}, \${u.user_metadata?.full_name || u.email}, \${ucode})
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, user_code = EXCLUDED.user_code
    \`;
  }

  console.log("\\n--> FINAL ACTIVE AUTH USERS ON VPS:");
  for (const u of allUsers?.users || []) {
    console.log("  - Email: " + u.email + " | ID: " + u.id + " | Confirmed: " + !!u.email_confirmed_at);
  }

  // Restart PM2 on VPS to clear in-memory caches
  await sql.end();
}

createSuperAdmins().catch(e => {
  console.error("Error creating users:", e);
  process.exit(1);
});
`;

fs.writeFileSync("scripts/vps_create_admins.mjs", script);

try {
  execSync(`scp -o StrictHostKeyChecking=no scripts/vps_create_admins.mjs ${SERVER}:/var/www/dgt-nextjs/vps_create_admins.mjs`, { stdio: "inherit" });
  execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "cd /var/www/dgt-nextjs && node vps_create_admins.mjs && pm2 restart dgt-nextjs && rm -f vps_create_admins.mjs"`, { stdio: "inherit" });
} catch (e) {
  console.error("Execution error:", e.message);
}
