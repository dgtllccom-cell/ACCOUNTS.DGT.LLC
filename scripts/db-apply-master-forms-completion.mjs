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
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

async function applyMigration() {
  try {
    console.log("Applying 20260814_master_forms_completion.sql migration...");
    const migrationSql = fs.readFileSync("supabase/migrations/20260814_master_forms_completion.sql", "utf8");
    await sql.unsafe(migrationSql);
    console.log("✓ Migration executed successfully!");

    const tables = ["company_registration_types", "document_types", "contact_types", "account_types", "product_units", "ports"];
    for (const t of tables) {
      const check = await sql`
        SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=${t}) as exists;
      `;
      console.log(`Table check [${t}]: ${check[0].exists ? "✓ EXISTS" : "✗ FAILED"}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

applyMigration();
