import fs from "node:fs";
import postgres from "postgres";

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

async function findLogins() {
  loadEnv();
  const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 1, prepare: false });

  const profiles = await sql`
    select p.*, u.email 
    from profiles p 
    left join auth.users u on p.id = u.id 
    where p.deleted_at is null
  `;
  
  const superAdmins = profiles.filter(p => (p.role || '').includes('super_admin')).slice(0, 2);

  const [chamanBranch] = await sql`select id, name from city_branches where name ilike '%Chaman%' limit 1`;
  const chamanAdmins = profiles.filter(p => p.city_branch_id === chamanBranch?.id);

  console.log(`\n==========================================`);
  console.log(`HOW TO LOGIN AND SEE CHAMAN ACCOUNTS`);
  console.log(`==========================================`);
  console.log(`You are currently logged in as: Admin Quetta`);
  console.log(`Quetta Admin can ONLY see Quetta branch accounts. They CANNOT see Chaman accounts.`);
  console.log(``);
  console.log(`To see the 365 Chaman accounts, please LOGOUT (Click 'Admin Quetta' on top right -> Logout)`);
  console.log(`And then login using one of these accounts:`);
  console.log(``);
  
  if (superAdmins.length > 0) {
    console.log(`--- SUPER ADMIN LOGIN ---`);
    for (const admin of superAdmins) {
      console.log(`Name: ${admin.full_name}`);
      console.log(`Email: ${admin.email || "No Email Found"}`);
      console.log(`Role: ${admin.role}`);
      console.log(`---`);
    }
  }

  if (chamanAdmins.length > 0) {
    console.log(`\n--- CHAMAN ADMIN LOGIN ---`);
    for (const admin of chamanAdmins) {
      console.log(`Name: ${admin.full_name}`);
      console.log(`Email: ${admin.email || "No Email Found"}`);
      console.log(`Role: ${admin.role}`);
      console.log(`---`);
    }
  } else {
    console.log(`\n(No specific Chaman Admin user found, please use Super Admin)`);
  }
  
  console.log(`==========================================\n`);
  await sql.end();
}

findLogins().catch(console.error);
