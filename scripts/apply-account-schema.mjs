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

function loadEnv() {
  return { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env or .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

try {
  console.log("Applying Account Multi-Linking Schema...");

  const migrationSql = fs.readFileSync("database/migrations/0070_accounts_multilinking_extension.sql", "utf8");
  await sql.unsafe(migrationSql);

  console.log("[SUCCESS] Account schema applied successfully!");
  console.log("Tables created:");
  console.log("  - accounts");
  console.log("  - account_companies");
  console.log("  - account_banks");
  console.log("  - account_warehouses");
  console.log("  - account_customer_owners");

  process.exit(0);
} catch (error) {
  console.error("[ERROR] Failed to apply migration:", error.message);
  process.exit(1);
}
