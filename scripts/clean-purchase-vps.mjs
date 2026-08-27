import { execSync } from 'child_process';

const server = "root@72.60.209.121";

const checkScript = `
cd /var/www/dgt-nextjs
node -e '
const postgres = require("postgres");
const fs = require("fs");

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\\r?\\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}
loadEnv();

const sql = postgres(process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres");

async function run() {
  const accs = await sql\`
    SELECT *
    FROM enterprise_accounts
    WHERE code = 'UAE-DUB-AC-0003'
  \`;
  console.log("FULL UAE-DUB-AC-0003 DETAILS:");
  console.log(JSON.stringify(accs[0], null, 2));
  await sql.end();
}
run();
'
`;

try {
  console.log("Removing the 3 purchase orders from VPS...");
  const out = execSync(`ssh -o StrictHostKeyChecking=no ${server} "bash -s"`, {
    input: checkScript,
    encoding: 'utf8',
    timeout: 30000
  });
  console.log(out);
} catch (e) {
  console.error("Error:", e.stdout || e.stderr || e.message);
}
