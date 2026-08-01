import fs from 'fs';
import postgres from 'postgres';

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}

async function checkAdmins() {
  loadEnv();
  const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 1, prepare: false });

  const users = await sql`
    select u.id, u.email, p.full_name, p.raw_password, ura.role 
    from auth.users u
    left join profiles p on p.id = u.id
    left join user_role_assignments ura on ura.user_id = u.id
    order by u.created_at desc
    limit 20
  `;

  console.log("\n================ ADMIN CREDENTIALS ================");
  console.table(users.map(u => ({
    email: u.email,
    name: u.full_name,
    password: u.raw_password || "(not set in profiles)",
    role: u.role
  })));

  await sql.end();
}

checkAdmins().catch(console.error);
