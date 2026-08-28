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

async function inspectUsers() {
  console.log("=== Inspecting Users table & columns ===");
  const userCols = await sql`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
  `;
  console.log("Users columns:", userCols);

  const totalUsers = await sql`SELECT count(*) FROM users;`;
  console.log("Total users count:", totalUsers);

  const sampleUsers = await sql`
    SELECT id, email, username, full_name, role, country_id, country_branch_id, city_branch_id, is_active, deleted_at 
    FROM users 
    LIMIT 30;
  `;
  console.log("Sample users:", sampleUsers);

  // Check roles table or enum if any
  const roles = await sql`
    SELECT DISTINCT role FROM users;
  `;
  console.log("Distinct roles in users:", roles);

  await sql.end();
}

inspectUsers().catch(console.error);
