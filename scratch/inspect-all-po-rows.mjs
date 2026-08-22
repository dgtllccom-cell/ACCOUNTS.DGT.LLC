
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
    const rows = await sql`
      SELECT id, purchase_order_no, purchase_contract_no, 
             form_data->'form'->>'supplierName' as supplier,
             form_data->'form'->>'purchaseAccountName' as purch_acc,
             form_data->'form'->>'salesAccountName' as sales_acc
      FROM public.purchase_orders 
      ORDER BY purchase_order_no ASC;
    `;
    console.log("Total rows:", rows.length);
    console.table(rows);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
