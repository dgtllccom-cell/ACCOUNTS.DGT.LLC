
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
    const row = await sql`SELECT purchase_order_no, form_data FROM public.purchase_orders WHERE purchase_order_no = 'PO-PB-2026-001' LIMIT 1;`;
    console.log("PO-PB-2026-001 form_data:", JSON.stringify(row[0]?.form_data, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
