import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^[\'"]|[\'"]$/g, "")];
    })
);

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const backupDir = path.join(process.cwd(), ".codex-backups");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(backupDir, `public-backup-${stamp}`);
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
    createdAt: new Date().toISOString(),
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
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), "utf8");
  }

  console.log(JSON.stringify({ status: "success", outputDir, manifestFile, tableCount: tables.length }, null, 2));
} catch (error) {
  console.error("DB_BACKUP_PUBLIC_JSON_FAILED", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
