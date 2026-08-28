
import postgres from "postgres";
import fs from "fs";

const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
let dbUrl = '';
for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function run() {
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const ea = await sql`SELECT id, account_code, account_name, country_id, branch_id FROM public.enterprise_accounts LIMIT 20;`;
    console.log("Enterprise accounts count:", ea.length);
    console.log(ea);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
