import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Usage: npx tsx scripts/create_admins.ts

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAdmin(email: string, name: string, roleName: string, password = "Password123!") {
  console.log(`Creating user: ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError) {
    if (authError.message.includes("already exists")) {
      console.log(`User ${email} already exists.`);
      // Fetch user to assign role anyway
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const user = existingUser.users.find(u => u.email === email);
      if (user) await assignRole(user.id, roleName, name, email);
      return;
    }
    console.error(`Failed to create ${email}:`, authError.message);
    return;
  }

  if (authData?.user) {
    await assignRole(authData.user.id, roleName, name, email);
    console.log(`Successfully created ${email}`);
  }
}

async function assignRole(userId: string, roleName: string, fullName: string, email: string) {
  // Ensure profile exists
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    email: email
  }, { onConflict: "id" });

  if (profileError) {
    console.error(`Failed to create profile for ${email}:`, profileError.message);
    return;
  }

  // Find Role ID
  const { data: roles, error: rolesError } = await supabase.from("roles").select("id, company_id").ilike("name", `%${roleName}%`).limit(1);
  if (rolesError || !roles || roles.length === 0) {
    console.error(`Role ${roleName} not found. Ensure roles are seeded.`);
    return;
  }

  const roleId = roles[0].id;
  const companyId = roles[0].company_id;

  // Insert into memberships
  const { error: membershipError } = await supabase.from("memberships").upsert({
    user_id: userId,
    company_id: companyId,
    role_id: roleId,
    scope: 'company'
  }, { onConflict: "user_id, company_id" });

  if (membershipError) {
    console.error(`Failed to assign role ${roleName} to ${email}:`, membershipError.message);
  } else {
    console.log(`Assigned role ${roleName} to ${email}`);
  }
}

async function main() {
  console.log("Starting Admin Creation...");
  await createAdmin("uae.admin@dgt.llc", "UAE Admin", "Country");
  await createAdmin("uae.dubai@dgt.llc", "Dubai Branch Admin", "Branch");
  await createAdmin("ksa.admin@dgt.llc", "KSA Admin", "Country");
  await createAdmin("ksa.riyadh@dgt.llc", "Riyadh Branch Admin", "Branch");
  console.log("Done.");
}

main().catch(console.error);
