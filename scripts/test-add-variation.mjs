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
const sql = postgres(dbUrl, { max: 1 });

async function run() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'goods_variations';
  `;
  console.log("goods_variations columns:", cols.map(c => c.column_name));

  const [good] = await sql`
    SELECT id, goods_name 
    FROM public.goods 
    WHERE goods_name ILIKE '%Walnut Kernel%' AND deleted_at IS NULL 
    LIMIT 1;
  `;
  console.log("Found good:", good);

  if (good) {
    const [inserted] = await sql`
      INSERT INTO public.goods_variations (goods_id, variety, size, grade, brand, extra_details, is_active)
      VALUES (
        ${good.id},
        'Chandler',
        '30-32 mm',
        'Light Halves',
        'DGT.LLC',
        '[{"id":"ed-1","title":"Commercial Specification","lines":["Moisture: max 5%","Purity: 99.5%"]}]',
        true
      )
      RETURNING id, variety, size, grade, brand, extra_details;
    `;
    console.log("✅ Inserted variation:", inserted);
  }
  await sql.end();
}

run().catch(async (e) => {
  console.error("Failed:", e);
  await sql.end();
});
