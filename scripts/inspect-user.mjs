import postgres from "postgres";
import fs from "fs";

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

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function check() {
  console.log("=== Active Profiles matching quetta, chaman, or dubai/deira ===");
  const profiles = await sql`
    SELECT id, full_name, user_code, deleted_at
    FROM public.profiles
    WHERE (full_name ILIKE '%quetta%' OR full_name ILIKE '%chaman%' OR full_name ILIKE '%deira%' OR full_name ILIKE '%dubai%')
      AND deleted_at IS NULL;
  `;
  console.log(profiles);

  console.log("\n=== Checking user role assignments for each found profile ===");
  for (const p of profiles) {
    const roles = await sql`SELECT role, is_active, deleted_at FROM public.user_role_assignments WHERE user_id = ${p.id};`;
    console.log(`Profile ${p.id} (${p.full_name} / ${p.user_code}):`, roles);
  }

  await sql.end();
}

check().catch(console.error);
