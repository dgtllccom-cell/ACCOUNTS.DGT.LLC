import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const sql = postgres(env.DATABASE_URL, { ssl: "require" });

async function main() {
  const profiles = await sql`
    SELECT p.id, p.user_code, p.full_name, p.raw_password, u.email, ura.role::text as role_name
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.user_role_assignments ura ON ura.user_id = p.id
    WHERE p.deleted_at IS NULL
    ORDER BY p.created_at DESC
    LIMIT 15
  `;
  console.log('Profiles:');
  for (const p of profiles) {
    console.log(`- ${p.email || p.user_code} (${p.full_name}): pass=${p.raw_password}, role=${p.role_name}`);
  }
  await sql.end();
}

main().catch(console.error);
