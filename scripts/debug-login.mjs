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

async function debugLogin(rawIdentifier) {
  const cleanId = rawIdentifier.replace(/@dgt\.llc$/i, "").trim().toLowerCase();
  console.log(`\nTesting rawIdentifier: "${rawIdentifier}", cleanId: "${cleanId}"`);

  const rows = await sql`
    SELECT p.id, p.user_code, p.full_name, p.raw_password, u.email as auth_email
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE u.email ILIKE ${rawIdentifier}
       OR u.email ILIKE ${`${cleanId}@dgt.llc`}
       OR p.user_code ILIKE ${rawIdentifier}
       OR p.user_code ILIKE ${cleanId}
    LIMIT 1;
  `;
  console.log("Direct PG Profile:", rows[0]);

  if (!rows[0]) {
    console.log("Profile not found by direct PG!");
    // Check what the Supabase fallback would do:
    // In Supabase fallback:
    // .or(`user_code.ilike.${rawIdentifier},user_code.ilike.${cleanId}`)
    // and then cityKeywords.find(k => cleanId.includes(k)) -> 'quetta'!
    // which queries: .ilike("full_name", `%quetta%`)!
    const cityRows = await sql`
      SELECT id, full_name, user_code FROM public.profiles WHERE full_name ILIKE '%quetta%' AND deleted_at IS NULL LIMIT 5;
    `;
    console.log("City fallback matching profiles:", cityRows);
  } else {
    // Check roles
    const roleRows = await sql`
      SELECT id, role, country_id, country_branch_id, city_branch_id, is_active, deleted_at
      FROM public.user_role_assignments
      WHERE user_id = ${rows[0].id}
        AND is_active = true
        AND deleted_at IS NULL;
    `;
    console.log("Roles for profile:", roleRows);
  }
}

async function run() {
  await debugLogin("quetta.branch@dgt.llc");
  await sql.end();
}

run().catch(console.error);
