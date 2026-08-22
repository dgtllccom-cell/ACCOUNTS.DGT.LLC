
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
    console.log("=== CURRENT PRODUCTS, GOODS & CATEGORIES IN DB ===");

    const categories = await sql`SELECT id, category_code, category_name FROM public.product_categories;`;
    console.log("Categories Count:", categories.length);
    categories.forEach(c => console.log(`  - ${c.category_code}: ${c.category_name} (${c.id})`));

    const goods = await sql`SELECT id, chs_code, goods_name FROM public.goods LIMIT 20;`;
    console.log("\nGoods Count:", goods.length);
    goods.forEach(g => console.log(`  - ${g.chs_code}: ${g.goods_name} (${g.id})`));

    const products = await sql`SELECT id, product_code, product_name, hs_code, size FROM public.products LIMIT 20;`;
    console.log("\nProducts Count:", products.length);
    products.forEach(p => console.log(`  - ${p.product_code}: ${p.product_name} | HS: ${p.hs_code} | Size: ${p.size} (${p.id})`));
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
