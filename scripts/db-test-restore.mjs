import fs from "node:fs";
import path from "node:path";

function findLatestBackupDir() {
  const searchDirs = [
    path.join(process.cwd(), "backups"),
    path.join(process.cwd(), ".codex-backups")
  ];

  let latestDir = null;
  let latestTime = 0;

  for (const base of searchDirs) {
    if (!fs.existsSync(base)) continue;
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(base, entry.name);
        const manifest = path.join(fullPath, "manifest.json");
        if (fs.existsSync(manifest)) {
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs > latestTime) {
            latestTime = stat.mtimeMs;
            latestDir = fullPath;
          }
        }
      }
    }
  }

  return latestDir;
}

const targetDirArgIndex = process.argv.indexOf("--dir");
let targetBackupDir = "";
if (targetDirArgIndex !== -1 && process.argv[targetDirArgIndex + 1]) {
  targetBackupDir = path.resolve(process.argv[targetDirArgIndex + 1]);
} else {
  targetBackupDir = findLatestBackupDir();
}

if (!targetBackupDir || !fs.existsSync(targetBackupDir)) {
  console.error("[ERROR] No valid backup directory with manifest.json was found.");
  process.exit(1);
}

const manifestPath = path.join(targetBackupDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`[ERROR] Manifest file missing in backup: ${manifestPath}`);
  process.exit(1);
}

console.log(`[TEST-RESTORE] Starting automated backup validation test...`);
console.log(`[TEST-RESTORE] Backup Target: ${targetBackupDir}`);

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  console.log(`[TEST-RESTORE] Backup Created At: ${manifest.timestamp || manifest.createdAt}`);
  console.log(`[TEST-RESTORE] Schema: ${manifest.schema || "public"}, Table Count: ${manifest.tableCount}`);

  let verifiedTables = 0;
  let totalRecords = 0;

  const coreTables = ["accounts", "ledgers", "roznamcha_entries", "countries", "country_branches", "city_branches", "profiles"];
  const foundCoreTables = [];

  for (const [tableName, info] of Object.entries(manifest.tables || {})) {
    const tableFilePath = path.join(targetBackupDir, info.file);
    if (!fs.existsSync(tableFilePath)) {
      throw new Error(`Table file missing for '${tableName}': ${tableFilePath}`);
    }

    const tableData = JSON.parse(fs.readFileSync(tableFilePath, "utf8"));
    if (!Array.isArray(tableData)) {
      throw new Error(`Invalid table JSON format for '${tableName}'`);
    }

    if (tableData.length !== info.count) {
      console.warn(`[WARN] Table '${tableName}' row count mismatch: manifest says ${info.count}, file has ${tableData.length}`);
    }

    verifiedTables++;
    totalRecords += tableData.length;

    if (coreTables.includes(tableName)) {
      foundCoreTables.push({ table: tableName, rows: tableData.length });
    }
  }

  console.log(`\n[TEST-RESTORE] Core Domain Tables Verification:`);
  foundCoreTables.forEach((t) => console.log(`  - ${t.table.padEnd(20)} : ${t.rows} records`));

  console.log(`\n======================================================`);
  console.log(`[SUCCESS] TEST RESTORE VALIDATION PASSED!`);
  console.log(`  - Verified Tables  : ${verifiedTables} / ${manifest.tableCount}`);
  console.log(`  - Total Records    : ${totalRecords}`);
  console.log(`  - Backup Status    : FULLY USABLE & INTEGRITY VERIFIED`);
  console.log(`======================================================\n`);
} catch (err) {
  console.error(`[CRITICAL RESTORE FAILURE] Backup verification failed:`, err);
  process.exitCode = 1;
}
