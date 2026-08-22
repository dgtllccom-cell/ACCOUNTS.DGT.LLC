
import postgres from "postgres";
import fs from "fs";

const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
let dbUrl = '';
for (const line of envLines) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function run() {
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    console.log("=== INSPECTING PRODUCTS & GOODS MASTER TABLES ===");

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('products', 'goods', 'categories', 'product_categories', 'brands', 'units', 'uoms', 'subcategories');
    `;
    console.log("Existing Master Tables:", tables.map(t => t.table_name));

    for (const t of tables) {
      const cols = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${t.table_name};
      `;
      console.log(`\nColumns for ${t.table_name}:`, cols.map(c => `${c.column_name} (${c.data_type})`));
    }
  } catch (e) {
    console.error("Inspection error:", e);
  } finally {
    await sql.end();
  }
}
run();
