import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function getEnvConfig() {
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

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  idle_timeout: 20
});

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
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

    const manifest = {
      timestamp: new Date().toISOString(),
      schema: "public",
      tableCount: tables.length,
      tables: {}
    };

    for (const { table_name: tableName } of tables) {
      await sql`set statement_timeout = 0`.catch(() => []);
      const rows = await sql.unsafe(`select * from public.${quoteIdent(tableName)}`);
      const fileName = `${tableName}.json`;
      fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(rows, null, 2), "utf8");
      manifest.tables[tableName] = { count: rows.length, file: fileName };
    }

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
