import { execSync } from 'child_process';

const bashScript = `
cd /var/www/dgt-nextjs
node << 'NODEOF'
import postgres from "postgres";
import fs from "fs";

const envLines = fs.readFileSync('.env.local', 'utf8').split('\\n');
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
    const users = await sql\`SELECT id, email, full_name, role, status FROM public.users LIMIT 10;\`;
    console.log("Users in DB:", users);
  } catch (e) {
    console.error("DB Query error:", e);
  } finally {
    await sql.end();
  }
}
run();
NODEOF
`;

try {
  const res = execSync(`ssh -o StrictHostKeyChecking=no root@72.60.209.121 "bash -s"`, {
    input: bashScript,
    encoding: 'utf8'
  });
  console.log(res);
} catch (e) {
  console.error("Test Error:", e.message);
}
