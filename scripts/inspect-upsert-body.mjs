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

async function run() {
  const [fn] = await sql`
    SELECT pg_get_functiondef(oid) as def
    FROM pg_proc
    WHERE proname = 'upsert_record_translation'
  `;
  console.log(fn ? fn.def : "Function not found");
  await sql.end();
}

run().catch(console.error);
