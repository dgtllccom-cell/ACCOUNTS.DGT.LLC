import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from "postgres";
import fs from "node:fs";

function loadEnv() {
  const envPath = fs.existsSync(".env.local") ? ".env.local" : ".env";
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
}

const env = loadEnv();
const dbUrl = env.DATABASE_URL || resolveDbUrl("dev");

const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 30 });

async function run() {
  try {
    console.log("Checking DB connection...");
    const [{ now }] = await sql`SELECT NOW()`;
    console.log("DB Connected at:", now);

    const email = "superadmin@damaan.com";
    const userCode = "SUPERADMIN";
    const password = "Admin@123";
    const fullName = "Super Admin";

    // 1. Check or create auth user
    const existing = await sql`SELECT id FROM auth.users WHERE email = ${email}`;
    let userId = existing[0]?.id;

    if (userId) {
      console.log("Found existing user in auth.users:", userId);
    } else {
      console.log("Creating user in auth.users...");
      const id = "00000000-0000-4000-8000-000000000001";
      // Insert into auth.users (Supabase auth table)
      await sql`
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at, 
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
          ${id}, '00000000-0000-0000-0000-000000000000', ${email}, 
          crypt(${password}, gen_salt('bf')), NOW(),
          '{"provider":"email","providers":["email"]}', ${sql.json({ full_name: fullName })},
          NOW(), NOW(), 'authenticated', 'authenticated'
        )
        ON CONFLICT (id) DO UPDATE SET
          encrypted_password = crypt(${password}, gen_salt('bf')),
          updated_at = NOW()
      `;
      userId = id;
      console.log("Created user in auth.users:", userId);
    }

    // 2. Ensure encrypted_password is updated
    await sql`
      UPDATE auth.users 
      SET encrypted_password = crypt(${password}, gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, NOW())
      WHERE id = ${userId}
    `;

    // 3. Upsert profiles row
    await sql`
      INSERT INTO profiles (id, full_name, user_code, raw_password, preferred_language_code, updated_at)
      VALUES (${userId}, ${fullName}, ${userCode}, ${password}, 'en', NOW())
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        user_code = EXCLUDED.user_code,
        raw_password = EXCLUDED.raw_password,
        updated_at = NOW()
    `;
    console.log("Profiles row updated for Super Admin");

    // 4. Ensure super_admin role assignment in user_role_assignments
    await sql`DELETE FROM user_role_assignments WHERE user_id = ${userId}`;
    await sql`
      INSERT INTO user_role_assignments (user_id, role, is_active, created_at)
      VALUES (${userId}, 'super_admin', true, NOW())
    `;
    console.log("Super Admin role assignment inserted");

    console.log("\n=============================================");
    console.log("SUCCESS! Super Admin user is seeded in DB.");
    console.log("Email:", email);
    console.log("User Code:", userCode);
    console.log("Password:", password);
    console.log("=============================================\n");

  } catch (err) {
    console.error("Error seeding DB super admin:", err);
  } finally {
    await sql.end();
  }
}

run();
