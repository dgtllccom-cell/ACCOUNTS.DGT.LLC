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
  const varCount = await sql`SELECT count(*) FROM goods_variations`;
  const paramCount = await sql`SELECT count(*) FROM goods_master_parameters`;
  console.log("goods_variations total:", varCount[0].count);
  console.log("goods_master_parameters total:", paramCount[0].count);

  const sampleVars = await sql`
    SELECT gv.*, g.goods_name 
    FROM goods_variations gv 
    JOIN goods g ON g.id = gv.goods_id 
    LIMIT 10
  `;
  console.log("sample variations:", sampleVars);

  const sampleParams = await sql`
    SELECT mp.*, g.goods_name 
    FROM goods_master_parameters mp
    LEFT JOIN goods g ON g.id = mp.goods_id
    LIMIT 20
  `;
  console.log("sample goods_master_parameters:", sampleParams);

  // Check columns on goods table:
  const goodsCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'goods'
  `;
  console.log("goods columns:", goodsCols.map(c => c.column_name));

  const sampleGoods = await sql`
    SELECT id, name, brand, sizes, variety, extra_details 
    FROM goods 
    LIMIT 5
  `;
  console.log("sample goods fields:", sampleGoods);

  await sql.end();
}

run().catch(console.error);
