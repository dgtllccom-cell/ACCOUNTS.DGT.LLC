import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import fs from "fs";
import path from "path";

// 1. Read environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local file not found at " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const databaseUrl = env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || "list";
  const targetEmail = args[1];

  if (action === "delete") {
    if (!targetEmail) {
      console.error("Error: Please specify the email to delete. Example: node scripts/inspect-and-clean.js delete user@example.com");
      process.exit(1);
    }
    await deleteUser(targetEmail);
  } else {
    await listUsers();
  }
}

async function listUsers() {
  console.log("Connecting to database and fetching users...\n");

  let sql;
  try {
    sql = postgres(databaseUrl, { ssl: "require" });
  } catch (err) {
    console.warn("Warning: Could not initialize database client (only fetching from Supabase Auth). Error:", err.message);
  }

  try {
    // Fetch from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      throw new Error(`Failed to list users from Supabase Auth: ${authError.message}`);
    }

    const authUsers = authData.users || [];
    console.log(`=== SUPABASE AUTH USERS (${authUsers.length}) ===`);
    authUsers.forEach(u => {
      console.log(`- Email: ${u.email}`);
      console.log(`  ID: ${u.id}`);
      console.log(`  Created: ${u.created_at}`);
      console.log(`  Metadata: ${JSON.stringify(u.user_metadata)}`);
      console.log("");
    });

    // Fetch from public profiles
    let profiles = [];
    let roleAssignments = [];
    if (sql) {
      profiles = await sql`SELECT id, full_name, user_code, deleted_at FROM public.profiles`;
      roleAssignments = await sql`SELECT user_id, role, is_active, deleted_at FROM public.user_role_assignments`;
    }

    console.log(`=== DATABASE PROFILES (${profiles.length}) ===`);
    profiles.forEach(p => {
      console.log(`- Code: ${p.user_code} | Name: ${p.full_name}`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Deleted At: ${p.deleted_at || "Active (null)"}`);
      console.log("");
    });

    // Identify mismatches / orphaned accounts
    console.log("=== DIAGNOSIS: ORPHANED / CONFLICTING RECORDS ===");
    let hasIssues = false;

    for (const au of authUsers) {
      const dbProfile = profiles.find(p => p.id === au.id);
      const dbRoles = roleAssignments.filter(r => r.user_id === au.id);

      if (!dbProfile) {
        console.log(`[ORPHANED AUTH] User ${au.email} exists in Supabase Auth, but has NO profile in public.profiles table!`);
        console.log(`  -> This will cause registration email conflicts. To fix, delete this user.`);
        hasIssues = true;
      } else if (dbProfile.deleted_at) {
        console.log(`[SOFT-DELETED PROFILE] User ${au.email} has a soft-deleted profile in public.profiles (deleted_at: ${dbProfile.deleted_at}), but still exists in Supabase Auth.`);
        console.log(`  -> To allow re-registration, this user must be deleted from Supabase Auth.`);
        hasIssues = true;
      }

      const activeRoles = dbRoles.filter(r => !r.deleted_at && r.is_active);
      if (activeRoles.length === 0 && au.email !== "superadmin@damaan.com") {
        console.log(`[NO ACTIVE ROLE] User ${au.email} has no active/undeleted role assignments in the database.`);
        hasIssues = true;
      }
    }

    if (!hasIssues) {
      console.log("No orphaned or conflicting records detected!");
    } else {
      console.log("\nTo delete a conflicting user and allow re-registration, run:");
      console.log("  node scripts/inspect-and-clean.js delete <email>");
    }

  } catch (err) {
    console.error("Error during listing:", err);
  } finally {
    if (sql) await sql.end();
  }
}

async function deleteUser(email) {
  console.log(`Searching for user with email: ${email} to delete...`);

  let sql;
  try {
    sql = postgres(databaseUrl, { ssl: "require" });
  } catch (err) {
    console.warn("Warning: Database connection not available, deleting from Supabase Auth only.");
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      throw new Error(`Failed to list users from Supabase Auth: ${authError.message}`);
    }

    const userToDelete = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!userToDelete) {
      console.log(`No user found in Supabase Auth with email: ${email}`);
      return;
    }

    const userId = userToDelete.id;
    console.log(`Found user in Supabase Auth. ID: ${userId}`);

    // Delete database assignments first if database is connected
    if (sql) {
      console.log("Deleting role assignments from public.user_role_assignments...");
      await sql`DELETE FROM public.user_role_assignments WHERE user_id = ${userId}`;
      
      console.log("Deleting profile from public.profiles...");
      await sql`DELETE FROM public.profiles WHERE id = ${userId}`;
    }

    // Delete from Supabase Auth
    console.log("Deleting user from Supabase Auth...");
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw new Error(`Failed to delete user from Supabase Auth: ${deleteError.message}`);
    }

    console.log(`\nSuccess: User ${email} has been completely removed from both public database and Supabase Auth!`);
    console.log("You can now register this email address again.");

  } catch (err) {
    console.error("Error during deletion:", err);
  } finally {
    if (sql) await sql.end();
  }
}

main();
