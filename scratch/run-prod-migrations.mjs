import fs from "node:fs";
import { execSync } from "node:child_process";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
console.log("Applying migrations to PRODUCTION (additive / idempotent; per-file transactions)...\n");
try {
  execSync("node scripts/db-apply-all-migrations.mjs", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: PROD },
  });
} catch (e) {
  console.error("\n[MIGRATION RUNNER EXITED NON-ZERO] — inspect output above. Stopping.");
  process.exit(1);
}
