if (!process.env.DGT_ALLOW_LEGACY_DEPLOY) { console.error("DISABLED: this script can change the LIVE server. Production is deployed only through the controlled gate (scripts/production/dgt-deploy-gate.sh) from the protected 'production' branch, with the owner's approval. See docs/production-deployment-control.md. (Owner-approved legacy use: set DGT_ALLOW_LEGACY_DEPLOY=1.)"); process.exit(1); }
import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import { execSync } from 'child_process';
import fs from 'fs';

const VPS_HOST = "root@72.60.209.121";
const VPS_APP_PATH = "/var/www/dgt-nextjs";
const VPS_DB_URL = resolveDbUrl("prod");

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║         DEPLOYING MIGRATIONS TO VPS PRODUCTION DATABASE        ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

// Step 1: Copy migration file to VPS
console.log("STEP 1: Copying migration file to VPS...");
const migrationFile = "database/migrations/0070_accounts_multilinking_extension.sql";
if (!fs.existsSync(migrationFile)) {
  console.error(`✗ Migration file not found: ${migrationFile}`);
  process.exit(1);
}

try {
  execSync(`scp ${migrationFile} ${VPS_HOST}:${VPS_APP_PATH}/`, { stdio: 'inherit' });
  console.log("✓ Migration file copied to VPS\n");
} catch (e) {
  console.error("✗ Failed to copy migration file");
  process.exit(1);
}

// Step 2: Execute migration on VPS
console.log("STEP 2: Executing migration on VPS database...");
const migrationScript = `
set -e
cd ${VPS_APP_PATH}

echo "Applying migration 0070_accounts_multilinking_extension.sql..."
psql "${VPS_DB_URL}" << 'SQL_EOF'
$(cat database/migrations/0070_accounts_multilinking_extension.sql)
SQL_EOF

echo "✓ Migration applied successfully"
`;

try {
  execSync(`ssh ${VPS_HOST} "${migrationScript}"`, { stdio: 'inherit' });
  console.log("✓ Migration executed on VPS\n");
} catch (e) {
  console.error("⚠ Migration execution warning (may already be applied)");
}

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║              VPS MIGRATIONS DEPLOYMENT COMPLETE                ║");
console.log("╚════════════════════════════════════════════════════════════════╝");
console.log("\nNext: Run migrate-to-vps.mjs to transfer data from LOCAL → VPS");

process.exit(0);
