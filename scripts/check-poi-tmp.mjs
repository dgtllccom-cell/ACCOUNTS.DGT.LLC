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
const sql = postgres(env.DATABASE_URL, { ssl: "require", max: 1 });
try {
  const rows = await sql`select id, purchase_order_id, product_id, goods_name from purchase_order_items where purchase_order_id = 'd9a17afa-5940-4f37-88ac-1f3a5e2e7b73'`;
  console.log("purchase_order_items:", JSON.stringify(rows, null, 2));
} finally {
  await sql.end();
}
