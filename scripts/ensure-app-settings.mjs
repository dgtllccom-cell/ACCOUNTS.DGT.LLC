import fs from "fs";
import postgres from "postgres";

let envContent = "";
if (fs.existsSync(".env.local")) envContent += "\n" + fs.readFileSync(".env.local", "utf8");
if (fs.existsSync(".env")) envContent += "\n" + fs.readFileSync(".env", "utf8");

let dbUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^["']/, "").replace(/["']$/, "");
  }
}

const sql = postgres(dbUrl);

async function main() {
  console.log("Creating app_settings table if not exists...");
  await sql`
    CREATE TABLE IF NOT EXISTS public.app_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      setting_key text UNIQUE NOT NULL,
      setting_value text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    )
  `;
  await sql`NOTIFY pgrst, 'reload schema'`;
  console.log("✅ app_settings created and PostgREST schema reloaded!");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
