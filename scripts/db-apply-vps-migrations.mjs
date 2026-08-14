import fs from "node:fs";
import postgres from "postgres";

const vpsUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.southeast-1.supabase.com:5432/postgres";
// Use the tested working URL:
const workingVpsUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

const vpsSql = postgres(workingVpsUrl, { max: 1, prepare: false, connect_timeout: 30, ssl: { rejectUnauthorized: false } });

async function applyMigrations() {
  console.log("=======================================================================");
  console.log("                 APPLYING RECENT MIGRATIONS TO VPS DATABASE            ");
  console.log("=======================================================================\n");

  const migrationFiles = [
    "supabase/migrations/20260814_stock_movements.sql",
    "supabase/migrations/20260814_master_forms_completion.sql"
  ];

  for (const file of migrationFiles) {
    if (!fs.existsSync(file)) {
      console.log(`⚠ Skipping missing migration file: ${file}`);
      continue;
    }
    console.log(`▶ Applying ${file} to VPS...`);
    const sqlContent = fs.readFileSync(file, "utf8");
    try {
      await vpsSql.unsafe(sqlContent);
      console.log(`  ✓ Successfully applied ${file}`);
    } catch (err) {
      console.error(`  ❌ Failed applying ${file}:`, err.message);
    }
  }

  await vpsSql.end();
  process.exit(0);
}

applyMigrations();
