import fs from "fs";
import path from "path";
import postgres from "postgres";

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const root = process.cwd();
const env = { ...parseEnv(path.join(root, ".env")), ...parseEnv(path.join(root, ".env.local")) };
const sql = postgres(env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1, prepare: false });

try {
  const rows = await sql`
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename like 'customers\_%'
    order by tablename, indexname
    limit 120
  `;
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
