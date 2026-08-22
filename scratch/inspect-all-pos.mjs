
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
    const orders = await sql`
      SELECT id, purchase_order_no, purchase_contract_no, country_id, order_total, payment_status, status, form_data, created_at
      FROM public.purchase_orders
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC;
    `;
    console.log("Total Active Purchase Orders in DB:", orders.length);
    orders.forEach((o, i) => {
      const fd = o.form_data || {};
      const f = fd.form || {};
      const items = fd.goodsEntries || [];
      console.log(`${i + 1}. [${o.purchase_order_no}] (${o.purchase_contract_no}) - Total: ${o.order_total} - Status: ${o.status} - Items: ${items.length} - Goods: ${items.map(it => it.goodsName).join(', ')}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
