import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

async function main() {
  console.log("Applying 20260828_settlement_reconciliation_engine.sql ...");
  const migrationSql = fs.readFileSync("supabase/migrations/20260828_settlement_reconciliation_engine.sql", "utf8");
  await sql.unsafe(migrationSql);
  console.log("Migration executed successfully!");

  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'settlement_%'
  `;
  console.log("Settlement tables/views in DB:", tables.map(r => r.table_name));

  const views = await sql`
    SELECT table_name FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name LIKE 'settlement_%'
  `;
  console.log("Settlement views in DB:", views.map(r => r.table_name));

  await sql.end();
  process.exit(0);
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
