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
const sql = postgres(env.DATABASE_URL, { max: 1 });

try {
  const rows = await sql`
    select id, customer_name, father_name, person_code, notes, created_at, deleted_at
    from customers
    where notes ilike '%Dawood%'
       or notes ilike '%Rehman%'
       or notes ilike '%Shahbaz%'
       or customer_name ilike '%Shahbaz%'
       or person_code ilike '%00000012%'
  `;
  console.log("Matched in DB:", rows.length);
  for (const r of rows) {
    console.log(JSON.stringify(r, null, 2));
  }
} catch (e) {
  console.error(e);
} finally {
  await sql.end();
}
