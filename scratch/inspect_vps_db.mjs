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
console.log("DB URL exists:", !!dbUrl);

async function run() {
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const ledgersCount = await sql\`SELECT count(*) FROM public.ledgers WHERE deleted_at IS NULL;\`;
    console.log("Total Ledgers in DB:", ledgersCount[0].count);

    const accountsCount = await sql\`SELECT count(*) FROM public.accounts WHERE deleted_at IS NULL;\`;
    console.log("Total Accounts in DB:", accountsCount[0].count);

    const sampleLedgers = await sql\`SELECT id, code, name, currency, account_id, enterprise_account_id, scope FROM public.ledgers WHERE deleted_at IS NULL LIMIT 5;\`;
    console.log("Sample Ledgers:", sampleLedgers);

    const sampleAccounts = await sql\`SELECT id, code, name, category, account_kind, scope FROM public.accounts WHERE deleted_at IS NULL LIMIT 5;\`;
    console.log("Sample Accounts:", sampleAccounts);
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
