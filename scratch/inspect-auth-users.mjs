import postgres from 'postgres';
import fs from 'fs';

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}
loadEnv();

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const sql = postgres(dbUrl, { max: 2, prepare: false });

async function inspectAuth() {
  console.log("=== Inspecting auth.users ===");
  const users = await sql`
    SELECT id, email, raw_user_meta_data, raw_app_meta_data, created_at, last_sign_in_at 
    FROM auth.users 
    ORDER BY created_at DESC;
  `;
  console.log("Total auth.users:", users.length);
  users.forEach(u => {
    console.log(`- ${u.email} | meta: ${JSON.stringify(u.raw_user_meta_data)}`);
  });

  console.log("\n=== Checking public schema for profile tables ===");
  const publicTables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name ILIKE '%profile%' OR table_name ILIKE '%user%' OR table_name ILIKE '%employee%' OR table_name ILIKE '%role%' OR table_name ILIKE '%permission%')
    ORDER BY table_name;
  `;
  console.log("Public user/profile/role tables:", publicTables.map(t => t.table_name));

  for (const t of publicTables) {
    try {
      const rows = await sql`SELECT * FROM ${sql(t.table_name)} LIMIT 5;`;
      console.log(`Sample from ${t.table_name} (Count: ${rows.length}):`, rows);
    } catch (e) {
      console.log(`Error reading ${t.table_name}:`, e.message);
    }
  }

  await sql.end();
}

inspectAuth().catch(console.error);
