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
  const [good] = await sql`SELECT id, name FROM public.goods WHERE name ILIKE '%Walnut Kernel%' AND deleted_at IS NULL LIMIT 1`;
  console.log("Found good:", good);

  if (!good) {
    console.error("Good not found");
    await sql.end();
    return;
  }

  // Check if variation can be inserted with grade
  const [variation] = await sql`
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

  console.log("✅ Successfully inserted test variation with grade:", variation);
  await sql.end();
}

run().catch(async (e) => {
  console.error("Failed:", e);
  await sql.end();
});
