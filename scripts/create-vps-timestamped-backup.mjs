import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import { execSync } from "child_process";

console.log("=======================================================================");
console.log("              CREATING FRESH TIMESTAMPED VPS DATABASE BACKUP           ");
console.log("=======================================================================\n");

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const remoteBackupPath = `/var/www/dgt-nextjs/backups/vps-backup-pre-migration-${timestamp}.sql.gz`;

try {
  execSync(`ssh root@72.60.209.121 "mkdir -p /var/www/dgt-nextjs/backups && pg_dump resolveDbUrl("prod") | gzip > ${remoteBackupPath} && ls -lh ${remoteBackupPath}"`, {
    stdio: "inherit"
  });
  console.log(`\n✓ Backup created successfully at: ${remoteBackupPath}`);
} catch (err) {
  console.error("⚠ Backup warning/error:", err.message);
}

process.exit(0);
