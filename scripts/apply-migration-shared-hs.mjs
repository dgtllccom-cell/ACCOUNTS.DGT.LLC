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

const sql = postgres(dbUrl);

async function run() {
  console.log("Applying shared HS code index migration...");
  await sql.unsafe("DROP INDEX IF EXISTS public.goods_chs_code_idx;");
  await sql.unsafe("CREATE INDEX IF NOT EXISTS goods_chs_code_idx ON public.goods USING btree (chs_code) WHERE (deleted_at IS NULL);");
  console.log("✅ Index successfully updated to standard non-unique index!");
  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
