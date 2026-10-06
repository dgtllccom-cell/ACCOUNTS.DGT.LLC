import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function getEnvConfig() {
  // An explicitly supplied process URL is useful for one-off production
  // maintenance without rewriting any checked-out environment file.
  if (process.env.DATABASE_URL) return process.env;

  const envPaths = [".env.production", ".env.local", ".env"];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const map = {};
      for (const line of content.split(/\r?\n/)) {
        if (line.includes("=") && !line.trim().startsWith("#")) {
          const idx = line.indexOf("=");
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim().replace(/^[\'"]|[\'"]$/g, "");
          map[k] = v;
        }
      }
      if (map.DATABASE_URL) return map;
    }
  }
  return process.env;
}

const env = getEnvConfig();

if (!env.DATABASE_URL) {
  console.error("[ERROR] DATABASE_URL is missing in environment files.");
  process.exit(1);
}

// Target output directory argument or default
const customOutputArgIndex = process.argv.indexOf("--output");
let outputDir = "";
if (customOutputArgIndex !== -1 && process.argv[customOutputArgIndex + 1]) {
  outputDir = path.resolve(process.argv[customOutputArgIndex + 1]);
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  outputDir = path.join(process.cwd(), "backups", `erp-db-backup-${stamp}`);
}

fs.mkdirSync(outputDir, { recursive: true });

const manifestFile = path.join(outputDir, "manifest.json");
const progressFile = path.join(outputDir, "manifest.partial.json");

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  idle_timeout: 20
});

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function writeTableRows(tableName, rows) {
  const jsonFileName = `${tableName}.json`;
  const jsonFilePath = path.join(outputDir, jsonFileName);
  try {
    fs.writeFileSync(jsonFilePath, JSON.stringify(rows, null, 2), "utf8");
    return { fileName: jsonFileName, filePath: jsonFilePath, format: "json" };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    if (fs.existsSync(jsonFilePath)) fs.rmSync(jsonFilePath);
    const jsonlFileName = `${tableName}.jsonl`;
    const jsonlFilePath = path.join(outputDir, jsonlFileName);
    const fd = fs.openSync(jsonlFilePath, "w");
    try {
      const batchSize = 1000;
      for (let index = 0; index < rows.length; index += batchSize) {
        const chunk = rows
          .slice(index, index + batchSize)
          .map((row) => JSON.stringify(row))
          .join("\n");
        fs.writeSync(fd, `${chunk}\n`);
      }
    } finally {
      fs.closeSync(fd);
    }
    return { fileName: jsonlFileName, filePath: jsonlFilePath, format: "jsonl" };
  }
}


async function runBackup() {
  console.log(`[INFO] Starting Enterprise DB Backup...`);
  console.log(`[INFO] Destination: ${outputDir}`);

  try {
    await sql`set statement_timeout = 0`.catch(() => []);
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name
    `;

    const existingProgress = fs.existsSync(progressFile)
      ? JSON.parse(fs.readFileSync(progressFile, "utf8"))
      : null;
    const manifest = {
      timestamp: existingProgress?.timestamp ?? new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      schema: "public",
      tableCount: tables.length,
      tables: existingProgress?.tables ?? {}
    };

    for (const { table_name: tableName } of tables) {
      const existing = manifest.tables[tableName];
      const existingFile = existing?.file ? path.join(outputDir, existing.file) : "";
      if (
        existing?.status === "complete" &&
        existingFile &&
        fs.existsSync(existingFile) &&
        fs.statSync(existingFile).size === existing.bytes
      ) {
        console.log(`[SKIP] ${tableName} (${existing.count} rows already backed up)`);
        continue;
      }

      await sql`set statement_timeout = 0`.catch(() => []);
      const rows = await sql.unsafe(`select * from public.${quoteIdent(tableName)}`);
      const { fileName, filePath, format } = writeTableRows(tableName, rows);
      manifest.tables[tableName] = {
        status: "complete",
        count: rows.length,
        file: fileName,
        format,
        bytes: fs.statSync(filePath).size
      };
      fs.writeFileSync(progressFile, JSON.stringify(manifest, null, 2), "utf8");
      console.log(`[OK] ${tableName}: ${rows.length} rows`);
    }

    manifest.status = "complete";
    manifest.completedAt = new Date().toISOString();
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), "utf8");

    console.log(`[SUCCESS] Database backup completed cleanly.`);
    console.log(JSON.stringify({ status: "success", outputDir, manifestFile, tableCount: tables.length }, null, 2));
  } catch (err) {
    console.error("[CRITICAL ERROR] Database backup engine failed:", err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void runBackup();

