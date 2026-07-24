import fs from "node:fs";
import postgres from "postgres";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function applyMigration() {
  try {
    console.log("Applying 0044_ports_borders_master_data.sql...");
    const migrationSql = fs.readFileSync("supabase/migrations/0044_ports_borders_master_data.sql", "utf8");
    
    await sql.unsafe(migrationSql);
    
    console.log("Migration applied successfully!");
  } catch(e) {
    console.error("Error applying migration:", e);
  } finally {
    await sql.end();
  }
}

applyMigration();
