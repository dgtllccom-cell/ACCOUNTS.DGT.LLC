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
    console.log("=== 1. DATABASE TABLES ===");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('products', 'goods', 'goods_variations', 'purchase_orders', 'purchase_order_items')
      ORDER BY table_name;
    `;
    console.table(tables);

    console.log("\n=== 2. TABLE: public.products ===");
    const prods = await sql`SELECT * FROM public.products ORDER BY product_code ASC LIMIT 10;`;
    console.table(prods);

    console.log("\n=== 3. TABLE: public.goods ===");
    const goods = await sql`SELECT * FROM public.goods ORDER BY goods_code ASC LIMIT 10;`;
    console.table(goods);

    console.log("\n=== 4. TABLE: public.goods_variations ===");
    const vars = await sql`SELECT * FROM public.goods_variations ORDER BY sku ASC LIMIT 10;`;
    console.table(vars);

    console.log("\n=== 5. TABLE: public.purchase_orders ===");
    const pos = await sql`
      SELECT id, purchase_order_no, purchase_contract_no, currency_code, order_total, advance_paid, remaining_due, payment_status, status
      FROM public.purchase_orders
      WHERE deleted_at IS NULL
      ORDER BY purchase_order_no ASC LIMIT 10;
    `;
    console.table(pos);

    console.log("\n=== 6. TABLE: public.purchase_order_items ===");
    const items = await sql`
      SELECT id, purchase_order_id, goods_name, brand, origin, quantity, unit_name, rate_original, total_original
      FROM public.purchase_order_items
      LIMIT 10;
    `;
    console.table(items);

  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
