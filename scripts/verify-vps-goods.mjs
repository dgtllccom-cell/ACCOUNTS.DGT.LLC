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
const sql = postgres(dbUrl);

async function run() {
  const count = await sql`SELECT count(*) FROM public.goods WHERE deleted_at IS NULL`;
  const cats = await sql`SELECT category, count(*) FROM public.goods WHERE deleted_at IS NULL GROUP BY category ORDER BY count DESC`;
  const transCount = await sql`SELECT count(*) FROM public.record_translations WHERE record_table = 'goods' AND deleted_at IS NULL`;
  console.log("=== VPS PRODUCTION DATABASE VERIFICATION ===");
  console.log("Goods count:", count[0].count);
  console.log("Categories:", cats);
  console.log("Goods Translations count:", transCount[0].count);

  const sample = await sql`SELECT goods_name, chs_code, category FROM public.goods WHERE deleted_at IS NULL LIMIT 5`;
  console.log("Sample goods:", sample);
  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
