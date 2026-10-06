import fs from "node:fs";
import postgres from "postgres";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to-migration.sql> [informationSchemaCheckTable]");
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const host = new URL(env.DATABASE_URL.replace("postgresql://", "http://")).hostname;
  console.log("Applying", file, "to host:", host);
  const migrationSql = fs.readFileSync(file, "utf8");
  await sql.unsafe(migrationSql);
  console.log("Migration applied successfully.");
} catch (error) {
  console.error("Migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
