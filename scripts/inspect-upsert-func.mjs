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
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

async function check() {
  const funcs = await sql`
    SELECT routine_name, specific_name, data_type
    FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name LIKE '%upsert_record_translation%'
  `;
  console.log("Functions found:", funcs);

  const params = await sql`
    SELECT specific_name, parameter_name, data_type, parameter_mode, ordinal_position
    FROM information_schema.parameters
    WHERE specific_schema = 'public' AND specific_name IN (
      SELECT specific_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%upsert_record_translation%'
    )
    ORDER BY specific_name, ordinal_position
  `;
  console.log("Parameters:", params);
  await sql.end();
}

check().catch(console.error);
