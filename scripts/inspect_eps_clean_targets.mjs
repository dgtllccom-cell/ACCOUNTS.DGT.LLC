import { execSync } from "child_process";
import fs from "fs";

const SERVER = "root@72.60.209.121";

const inspectScript = `
import postgres from "postgres";
import fs from "fs";

let envContent = fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
let dbUrl = "";
for (const line of envContent.split("\\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 15 });

async function run() {
  console.log("=== 1. ROZNAMCHA ENTRIES (ALL) ===");
  try {
    const roz = await sql\`SELECT * FROM roznamcha_entries\`;
    console.log(JSON.stringify(roz, null, 2));
  } catch (e) { console.log("roz err:", e.message); }

  console.log("\\n=== 2. ENTERPRISE ACCOUNTS (ALL) ===");
  try {
    const acc = await sql\`SELECT * FROM enterprise_accounts\`;
    console.log(JSON.stringify(acc, null, 2));
  } catch (e) { console.log("acc err:", e.message); }

  console.log("\\n=== 3. LEDGERS (ALL) ===");
  try {
    const ledgers = await sql\`SELECT * FROM ledgers\`;
    console.log(JSON.stringify(ledgers, null, 2));
  } catch (e) { console.log("ledgers err:", e.message); }

  console.log("\\n=== 4. DOCUMENT INTAKE JOBS (ALL) ===");
  try {
    const docJobs = await sql\`SELECT * FROM document_intake_jobs\`;
    console.log(JSON.stringify(docJobs, null, 2));
  } catch (e) { console.log("docJobs err:", e.message); }

  console.log("\\n=== 5. CUSTOMERS (SAMPLE) ===");
  try {
    const cust = await sql\`SELECT * FROM customers LIMIT 5\`;
    console.log(JSON.stringify(cust, null, 2));
  } catch (e) { console.log("cust err:", e.message); }

  console.log("\\n=== 6. CHECK STORAGE FILES IN /var/www/dgt-nextjs/storage ===");
  if (fs.existsSync("/var/www/dgt-nextjs/storage")) {
    console.log("Storage dir files:", fs.readdirSync("/var/www/dgt-nextjs/storage"));
  } else {
    console.log("No /var/www/dgt-nextjs/storage directory");
  }

  await sql.end();
}

run().catch(e => {
  console.error("Inspect error:", e);
  process.exit(1);
});
`;

fs.writeFileSync("scripts/remote_inspect.mjs", inspectScript);

try {
  execSync(`scp -o StrictHostKeyChecking=no scripts/remote_inspect.mjs ${SERVER}:/var/www/dgt-nextjs/remote_inspect.mjs`, { stdio: "inherit" });
  execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "cd /var/www/dgt-nextjs && node remote_inspect.mjs && rm -f remote_inspect.mjs"`, { stdio: "inherit" });
} catch (e) {
  console.error("Execution failed:", e.message);
} finally {
  if (fs.existsSync("scripts/remote_inspect.mjs")) {
    fs.unlinkSync("scripts/remote_inspect.mjs");
  }
}
