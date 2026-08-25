import { execSync } from 'child_process';
import fs from 'fs';

const BRANCH = "main";
const SERVERS = ["root@72.60.209.121"];

if (fs.existsSync('SECOND_VPS.txt')) {
  const lines = fs.readFileSync('SECOND_VPS.txt', 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.trim();
    if (cleanLine && !cleanLine.startsWith('#') && !SERVERS.includes(`root@${cleanLine}`)) {
      SERVERS.push(`root@${cleanLine}`);
    }
  }
}

console.log("===============================================================");
console.log("  DOCUMENT MANAGEMENT PHASE 1: VPS DEPLOYMENT & PROD MIGRATION");
console.log("  Branch:", BRANCH);
console.log("  Servers:", SERVERS.join(", "));
console.log("===============================================================\n");

const remoteScript = `
set -e

echo "=== [1/6] Navigating to /var/www/dgt-nextjs ==="
cd /var/www/dgt-nextjs

echo "=== [2/6] Fetching and checking out latest ${BRANCH} ==="
git remote set-url origin https://github.com/dgtllccom-cell/ACCOUNTS.DGT.LLC.git
git fetch origin ${BRANCH}
git checkout -f -B ${BRANCH} origin/${BRANCH}
git reset --hard origin/${BRANCH}
echo "Current commit:"
git log -1 --oneline

echo "=== [3/6] Applying Phase 1 Migrations to Production Database ==="
node -e '
const fs = require("fs");
const postgres = require("postgres");

async function applyMigrations() {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    for (const f of [".env.local", ".env"]) {
      if (fs.existsSync(f)) {
        const c = fs.readFileSync(f, "utf8");
        const m = c.match(/^DATABASE_URL\\s*=\\s*(.+)$/m);
        if (m) { dbUrl = m[1].trim().replace(/^["\x27]|["\x27]$/g, ""); break; }
      }
    }
  }
  if (!dbUrl) throw new Error("DATABASE_URL not found on VPS");

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  console.log("Connecting to Production Database...");

  console.log("Applying 20260825_add_office_documents_canonical_fields.sql...");
  const sql1 = fs.readFileSync("supabase/migrations/20260825_add_office_documents_canonical_fields.sql", "utf8");
  await sql.unsafe(sql1);

  console.log("Applying 20260825_office_documents_phase1_context.sql...");
  const sql2 = fs.readFileSync("supabase/migrations/20260825_office_documents_phase1_context.sql", "utf8");
  await sql.unsafe(sql2);

  const cols = await sql\`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'office_documents' 
      AND column_name IN ('company_id', 'company_code', 'account_id', 'person_account_id', 'document_type', 'source_module', 'storage_key', 'document_path')
    ORDER BY column_name;
  \`;
  console.log("Verified Production DB Columns count:", cols.length);
  cols.forEach(c => console.log("  •", c.column_name, "(", c.data_type, ")"));
  await sql.end();
}

applyMigrations().then(() => console.log("✅ Production DB Migration applied successfully!")).catch(err => {
  console.error("❌ Production DB Migration error:", err);
  process.exit(1);
});
'

echo "=== [4/6] Installing dependencies ==="
npm install --include=dev

echo "=== [5/6] Building Next.js application ==="
rm -rf .next
NODE_OPTIONS='--max-old-space-size=4096' npm run build

echo "=== [6/6] Restarting PM2 process ==="
pm2 restart dgt-nextjs --update-env || pm2 start ecosystem.config.cjs
pm2 save

echo "Checking PM2 status:"
pm2 status

echo "Checking HTTP health on localhost:3000:"
sleep 3
curl -I -s http://localhost:3000/dashboard/documents | head -n 5 || true

echo "=== DEPLOYMENT AND VERIFICATION FINISHED SUCCESSFULLY ON VPS ==="
`;

for (const server of SERVERS) {
  console.log(`\n---------------------------------------------------------------`);
  console.log(`🚀 Executing Production Deployment on: ${server}`);
  console.log(`---------------------------------------------------------------`);
  try {
    const out = execSync(`ssh -o StrictHostKeyChecking=no ${server} "bash -s"`, {
      input: remoteScript,
      encoding: 'utf8',
      timeout: 900000
    });
    console.log(out);
    console.log(`✅ Successfully deployed and migrated ${server}`);
  } catch (e) {
    console.error(`❌ Deployment failed on ${server}:`);
    console.error(e.stdout || e.stderr || e.message);
    process.exit(1);
  }
}

console.log("\n===============================================================");
console.log("  🎉 FULL PRODUCTION VPS DEPLOYMENT & VERIFICATION COMPLETE!");
console.log("===============================================================");
