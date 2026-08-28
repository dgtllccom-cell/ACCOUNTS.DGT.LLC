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

async function listAllUsers() {
  const users = await sql`
    SELECT 
      u.id, 
      u.email, 
      p.full_name, 
      p.user_code,
      r.role,
      r.country_id,
      c.name as country_name,
      r.city_branch_id,
      cb.name as city_branch_name,
      r.is_active as role_active,
      u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    LEFT JOIN public.user_role_assignments r ON u.id = r.user_id AND r.deleted_at IS NULL
    LEFT JOIN public.countries c ON r.country_id = c.id
    LEFT JOIN public.city_branches cb ON r.city_branch_id = cb.id
    ORDER BY u.created_at ASC;
  `;

  console.log(`Total users in system: ${users.length}\n`);
  users.forEach((u, i) => {
    console.log(`${i+1}. [${u.email}] Full Name: "${u.full_name || ''}" | UserCode: ${u.user_code || ''} | Role: ${u.role || 'NONE'} | Country: ${u.country_name || 'Global'} | Branch: ${u.city_branch_name || 'N/A'}`);
  });

  await sql.end();
}

listAllUsers().catch(console.error);
