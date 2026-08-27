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
const sql = postgres(dbUrl);

async function inspectProfiles() {
  const profileCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles'
  `;
  console.log("Profiles columns:", profileCols.map(c => `${c.column_name} (${c.data_type})`));

  const uraCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'user_role_assignments'
  `;
  console.log("user_role_assignments columns:", uraCols.map(c => `${c.column_name} (${c.data_type})`));

  const existingProfiles = await sql`
    SELECT id, user_code, full_name, raw_password FROM profiles LIMIT 10;
  `;
  console.log("Sample profiles:", existingProfiles);

  await sql.end();
}

inspectProfiles().catch(console.error);
