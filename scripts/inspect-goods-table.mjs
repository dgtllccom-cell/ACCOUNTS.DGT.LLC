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
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'goods'
  `;
  console.log("Goods columns:", cols.map(c => c.column_name));
  const rows = await sql`SELECT * FROM public.goods LIMIT 10`;
  console.log("Goods sample rows:", rows);
  await sql.end();
}

run().catch(console.error);
