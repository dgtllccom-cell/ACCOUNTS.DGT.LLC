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
  const users = await sql`
    SELECT u.id, u.email, p.full_name, ura.role, ura.country_id, ura.country_branch_id
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.user_role_assignments ura ON ura.user_id = u.id
    WHERE ura.role::text LIKE '%admin%' OR u.email LIKE '%admin%'
    LIMIT 20
  `;
  console.log('Admin users in DB:');
  for (const u of users) {
    console.log(`- ${u.email} (${u.full_name}): role=${u.role}`);
  }
  await sql.end();
}

main().catch(console.error);
