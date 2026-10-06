import { resolveDbUrl } from "./lib/prod-db-url.mjs";
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

const localEnv = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const vpsEnv = {
  DATABASE_URL: resolveDbUrl("prod")
};

const localSql = postgres(localEnv.DATABASE_URL, { max: 1, prepare: false });
const vpsSql = postgres(vpsEnv.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });

async function main() {
  const tables = await localSql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const results = [];
  for (const { table_name } of tables) {
    let localCount = 0;
    let vpsCount = 0;
    try {
      const [r] = await localSql.unsafe(`SELECT count(*)::int as c FROM public."${table_name}"`);
      localCount = r.c;
    } catch (e) {
      localCount = -1;
    }

    try {
      const [r] = await vpsSql.unsafe(`SELECT count(*)::int as c FROM public."${table_name}"`);
      vpsCount = r.c;
    } catch (e) {
      vpsCount = -1;
    }

    if (localCount > 0 || vpsCount > 0) {
      results.push({ table: table_name, local: localCount, vps: vpsCount });
    }
  }

  console.log(JSON.stringify(results, null, 2));
  await localSql.end();
  await vpsSql.end();
}

main().catch(console.error);
