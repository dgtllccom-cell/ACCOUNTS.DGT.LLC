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

async function verify() {
  loadEnv();
  const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 1, prepare: false });

  const [pakistan] = await sql`select id from countries where name ilike '%Pakistan%' and deleted_at is null limit 1`;
  if (!pakistan) throw new Error("Pakistan country not found in database.");

  const [chamanBranch] = await sql`select id, name from city_branches where country_id=${pakistan.id} and deleted_at is null and (name ilike '%Chaman%' or city_name ilike '%Chaman%') order by created_at asc limit 1`;
  if (!chamanBranch) throw new Error("Chaman branch not found in database! Make sure it exists.");

  const accounts = await sql`select count(*) from enterprise_accounts where city_branch_id=${chamanBranch.id} and deleted_at is null`;
  const ledgers = await sql`select count(*) from ledgers where city_branch_id=${chamanBranch.id} and deleted_at is null`;

  console.log(`\n==========================================`);
  console.log(`VERIFICATION RESULT FOR CHAMAN BRANCH`);
  console.log(`==========================================`);
  console.log(`Branch Name: ${chamanBranch.name}`);
  console.log(`Total Accounts Found: ${accounts[0].count}`);
  console.log(`Total Ledgers Found: ${ledgers[0].count}`);
  console.log(`==========================================`);
  console.log(`If you see 362 or more accounts here, they are SUCCESSFULLY inserted in the database!`);
  console.log(`To see them in the UI, you MUST click on the top right profile icon and LOG OUT of "Admin Quetta".`);
  console.log(`Then log in using the "Chaman Admin" account or the "Super Admin" account.`);
  console.log(`==========================================\n`);

  await sql.end();
}

verify().catch(console.error);
