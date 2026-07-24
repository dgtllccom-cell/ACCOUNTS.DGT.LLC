import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function loadEnvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional env file.
  }
}

await loadEnvFile(path.join(process.cwd(), ".env.local"));
await loadEnvFile(path.join(process.cwd(), ".env"));

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL, POSTGRES_URL, or SUPABASE_DB_URL is required.");
}

const migrationPath = path.join(process.cwd(), "supabase", "migrations", "0078_centralized_multilingual_master_data.sql");
const sqlText = (await fs.readFile(migrationPath, "utf8")).replace(/^\uFEFF/, "");
const sql = postgres(databaseUrl, { max: 1, ssl: "require" });
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(sqlText);
  });
  console.log("Applied 0078_centralized_multilingual_master_data.sql");
} finally {
  await sql.end({ timeout: 5 });
}

