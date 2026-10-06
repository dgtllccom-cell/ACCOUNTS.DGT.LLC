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

async function main() {
  const trans = await sql`
    SELECT record_id, original_text, english_text, urdu_text, arabic_text, persian_text, pashto_text
    FROM record_translations
    WHERE record_table = 'goods' AND field_name = 'extra_details'
    ORDER BY created_at DESC
    LIMIT 4;
  `;
  console.log("Translations count in record_translations:", (await sql`SELECT count(*) FROM record_translations WHERE record_table = 'goods' AND field_name = 'extra_details'`)[0].count);
  for (const t of trans) {
    console.log("-----------------------------------------");
    console.log("EN:", t.english_text?.slice(0, 60) + "...");
    console.log("UR:", t.urdu_text?.slice(0, 60) + "...");
    console.log("AR:", t.arabic_text?.slice(0, 60) + "...");
    console.log("FA:", t.persian_text?.slice(0, 60) + "...");
    console.log("PS:", t.pashto_text?.slice(0, 60) + "...");
  }
  await sql.end();
}

main().catch(console.error);
