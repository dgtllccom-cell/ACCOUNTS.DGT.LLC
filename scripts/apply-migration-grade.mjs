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

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local"), ...parseEnvFile(".env.production") };
const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL;

if (!dbUrl) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":***@");
console.log(`Connecting to: ${maskedUrl}`);

const sql = postgres(dbUrl, { max: 1 });

async function run() {
  console.log("Applying grade column migration to goods_variations...");
  await sql.unsafe("ALTER TABLE public.goods_variations ADD COLUMN IF NOT EXISTS grade text;");
  
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'goods_variations' AND column_name = 'grade';
  `;
  console.log("Verification of 'grade' column:", cols);
  console.log("✅ Grade column verified successfully!");
  await sql.end();
}

run().catch(async (err) => {
  console.error("Migration error:", err);
  await sql.end();
  process.exit(1);
});
