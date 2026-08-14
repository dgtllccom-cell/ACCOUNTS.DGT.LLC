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
  try {
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    console.log("=== ALL DB TABLES ===");
    console.log(tables.map(t => t.tablename).join(", "));

    console.log("\n=== STOCK / INVENTORY / WAREHOUSE RELATED TABLES ===");
    const stockTables = tables.filter(t => 
      t.tablename.includes("stock") || 
      t.tablename.includes("inventory") || 
      t.tablename.includes("warehouse") || 
      t.tablename.includes("goods") || 
      t.tablename.includes("product")
    );
    console.log(stockTables.map(t => t.tablename).join(", "));

    for (const t of stockTables) {
      const cols = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = ${t.tablename}
      `;
      console.log(`\nTable [${t.tablename}]:`);
      console.log(cols.map(c => `  - ${c.column_name} (${c.data_type})`).join("\n"));
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
