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

const sql = postgres(process.env.DATABASE_URL, { max: 2 });

async function run() {
  const emails = ["quetta.branch@dgt.llc", "chaman.branch@dgt.llc", "dubai.branch@dgt.llc"];
  for (const email of emails) {
    const [u] = await sql`SELECT id, email FROM auth.users WHERE email = ${email};`;
    console.log(`\nEmail: ${email}, Auth ID: ${u?.id}`);
    if (u) {
      const p = await sql`SELECT * FROM public.profiles WHERE id = ${u.id};`;
      console.log("Profile:", p);
      const ura = await sql`SELECT * FROM public.user_role_assignments WHERE user_id = ${u.id};`;
      console.log("Assignments for auth user id:", ura);

      // Also check if any assignment exists with this email or profile
      const allUra = await sql`SELECT * FROM public.user_role_assignments WHERE is_active = true AND deleted_at IS NULL;`;
      console.log("Total active assignments count:", allUra.length);
    }
  }
  await sql.end();
}

run().catch(console.error);
